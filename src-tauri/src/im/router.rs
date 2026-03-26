// Session Router — maps IM peers to independent Sidecar processes.
//
// Each IM conversation (platform + chat_id) gets its own Bun Sidecar process,
// identified by a session_key like `im:{agentId}:{platform}:private:{chatId}`.
//
// The router handles:
//   - peer -> Sidecar mapping (ensure_sidecar)
//   - HTTP health checks for existing Sidecars
//   - Session reset (/new command)
//   - Idle session collection (30-min timeout)
//   - AI config sync to new Sidecars
//
// Concurrency model:
//   Global semaphore + per-peer locks live OUTSIDE the router (in the processing loop).
//   The router lock is only held briefly for data operations.
//   SSE streaming to Sidecars happens WITHOUT the router lock, enabling per-peer parallelism.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use reqwest::Client;
use serde_json::json;
use tauri::AppHandle;

use crate::sidecar::{
    find_bun_executable, find_server_script, start_sidecar, ManagedSidecarState, SidecarOwner,
};
use crate::{local_http, ulog_info, ulog_warn};

use super::types::{ActiveSessionInfo, ImConfig, ImMessage, PeerSession, RouteError};

/// Max concurrent AI requests across all peers
pub const GLOBAL_CONCURRENCY: usize = 8;

/// Idle session timeout (30 minutes)
const IDLE_TIMEOUT_SECS: u64 = 1800;

/// HTTP timeout for Sidecar API calls (5 minutes — covers long AI turns)
const SIDECAR_HTTP_TIMEOUT_SECS: u64 = 300;

/// Create an HTTP client configured for local Sidecar JSON API calls.
pub fn create_sidecar_http_client() -> Client {
    local_http::builder()
        .timeout(Duration::from_secs(SIDECAR_HTTP_TIMEOUT_SECS))
        .build()
        .expect("[im-router] Failed to create HTTP client")
}

/// Create an HTTP client for SSE streaming (idle timeout, no overall timeout).
/// read_timeout acts as idle timeout; no overall timeout so streams stay open until AI turn completes.
pub fn create_sidecar_stream_client() -> Client {
    local_http::builder()
        .read_timeout(Duration::from_secs(300))
        .tcp_nodelay(true)
        .http1_only()
        .build()
        .expect("[im-router] Failed to create SSE client")
}

pub struct SessionRouter {
    peer_sessions: HashMap<String, PeerSession>,
    default_workspace: PathBuf,
    http_client: Client,
    /// Agent ID — used in session key format: `im:{agentId}:{platform}:private:{chatId}`
    agent_id: String,
}

impl SessionRouter {
    /// Create a new SessionRouter for an Agent channel.
    pub fn new(default_workspace: PathBuf, agent_id: String) -> Self {
        Self {
            peer_sessions: HashMap::new(),
            default_workspace,
            http_client: create_sidecar_http_client(),
            agent_id,
        }
    }

    // ── Session Key ────────────────────────────────────────────────

    /// Generate session key from IM message.
    /// Format: `im:{agentId}:{platform}:private:{chatId}` (Phase 1: private chat only)
    pub fn session_key(&self, msg: &ImMessage) -> String {
        format!(
            "im:{}:{}:private:{}",
            self.agent_id, msg.platform, msg.chat_id
        )
    }

    // ── Ensure Sidecar ─────────────────────────────────────────────

    /// Ensure a Sidecar is running for the given session key.
    /// Returns `(port, is_new_sidecar)` — `is_new_sidecar` is true when a new Sidecar was created
    /// (caller should sync AI config like model/MCP after creation).
    ///
    /// Uses `SidecarOwner::Agent(session_key)` as the owner, so idle collection can release it.
    ///
    /// NOTE: `start_sidecar()` is a blocking function (health check loop). This method
    /// wraps it in `tokio::task::spawn_blocking` so it's safe to call from async context.
    pub async fn ensure_sidecar(
        &mut self,
        session_key: &str,
        app_handle: &AppHandle,
        sidecar_manager: &ManagedSidecarState,
        _config: &ImConfig,
    ) -> Result<(u16, bool), RouteError> {
        // Phase 1: Check existing peer session with healthy Sidecar
        if let Some(ps) = self.peer_sessions.get(session_key) {
            if ps.sidecar_port > 0 {
                if self.check_sidecar_health(ps.sidecar_port).await {
                    return Ok((ps.sidecar_port, false));
                }
                ulog_warn!(
                    "[im-router] Sidecar on port {} unhealthy for {}",
                    ps.sidecar_port,
                    session_key
                );
            }
        }

        // Phase 2: Create new Sidecar
        let session_id = self
            .peer_sessions
            .get(session_key)
            .map(|ps| ps.session_id.clone())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        let workspace = self
            .peer_sessions
            .get(session_key)
            .map(|ps| ps.workspace_path.clone())
            .unwrap_or_else(|| self.default_workspace.clone());

        let prev_count = self
            .peer_sessions
            .get(session_key)
            .map(|ps| ps.message_count)
            .unwrap_or(0);

        // Resolve bun and script paths
        let bun_path = find_bun_executable(app_handle)
            .map_err(|e| RouteError::Setup(format!("Bun not found: {}", e)))?;
        let script_path = find_server_script(app_handle)
            .map_err(|e| RouteError::Setup(format!("Server script not found: {}", e)))?;

        // start_sidecar is blocking (TCP health check loop), so use spawn_blocking
        let sidecar_id = session_id.clone();
        let agent_dir = Some(workspace.clone());
        let owner = SidecarOwner::Agent(session_key.to_string());
        let mgr = Arc::clone(sidecar_manager);
        let bun = bun_path.clone();
        let script = script_path.clone();

        let port = tokio::task::spawn_blocking(move || {
            start_sidecar(&mgr, sidecar_id, agent_dir, &bun, &script, Some(owner))
        })
        .await
        .map_err(|e| RouteError::Setup(format!("spawn_blocking failed: {}", e)))?
        .map_err(|e| RouteError::Setup(format!("Failed to start Sidecar: {}", e)))?;

        // Phase 3: Record in peer_sessions
        self.peer_sessions.insert(
            session_key.to_string(),
            PeerSession {
                session_key: session_key.to_string(),
                session_id,
                sidecar_port: port,
                workspace_path: workspace,
                message_count: prev_count,
                last_active: Instant::now(),
            },
        );

        ulog_info!(
            "[im-router] Sidecar ready for {} on port {} (workspace={})",
            session_key,
            port,
            self.peer_sessions
                .get(session_key)
                .map(|ps| ps.workspace_path.display().to_string())
                .unwrap_or_default()
        );

        Ok((port, true))
    }

    // ── Health Check ───────────────────────────────────────────────

    /// Check if Sidecar is healthy via HTTP GET /health.
    /// Retry once with longer timeout to avoid false positives during
    /// heavy MCP processing or GC pauses.
    async fn check_sidecar_health(&self, port: u16) -> bool {
        let url = format!("http://127.0.0.1:{}/health", port);

        // First attempt: 1.5s (handles normal load)
        // Retry: 3s (handles heavy processing / GC pauses)
        for timeout_ms in [1500u64, 3000] {
            match self
                .http_client
                .get(&url)
                .timeout(Duration::from_millis(timeout_ms))
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => return true,
                _ => {}
            }
        }
        false
    }

    // ── Record Response ────────────────────────────────────────────

    /// Get the session_id for a given session_key (for passing to Sidecar).
    pub fn get_session_id(&self, session_key: &str) -> Option<String> {
        self.peer_sessions.get(session_key).map(|ps| ps.session_id.clone())
    }

    /// Record a successful AI response — increment message_count and refresh activity.
    pub fn record_response(&mut self, session_key: &str) {
        if let Some(ps) = self.peer_sessions.get_mut(session_key) {
            ps.message_count += 1;
            ps.last_active = Instant::now();
        }
    }

    // ── Reset Session (/new command) ───────────────────────────────

    /// Handle /new command — reset session for a peer.
    /// Generates a new session_id but keeps the Sidecar alive (reuse port).
    /// If the Sidecar has a `/api/im/session/new` endpoint, calls it to reset server-side state.
    /// Returns the new session_id.
    pub async fn reset_session(&mut self, session_key: &str) -> Option<String> {
        let new_session_id = uuid::Uuid::new_v4().to_string();

        if let Some(ps) = self.peer_sessions.get_mut(session_key) {
            // Try to notify Sidecar about the reset
            if ps.sidecar_port > 0 {
                let url = format!(
                    "http://127.0.0.1:{}/api/im/session/new",
                    ps.sidecar_port
                );
                let _ = self
                    .http_client
                    .post(&url)
                    .json(&json!({}))
                    .send()
                    .await;
            }

            ps.session_id = new_session_id.clone();
            ps.message_count = 0;
            ps.last_active = Instant::now();
            Some(new_session_id)
        } else {
            // No existing session — return a fresh ID for the caller
            Some(new_session_id)
        }
    }

    // ── Idle Session Collection ────────────────────────────────────

    /// Collect idle sessions that haven't been active for IDLE_TIMEOUT_SECS.
    /// Releases the Sidecar process but preserves the PeerSession (with port=0)
    /// so the stable session_id can be reused for resume on next message.
    /// Returns the list of collected session keys.
    pub fn collect_idle_sessions(
        &mut self,
        sidecar_manager: &ManagedSidecarState,
    ) -> Vec<String> {
        let now = Instant::now();

        let idle_keys: Vec<String> = self
            .peer_sessions
            .iter()
            .filter(|(_, ps)| {
                ps.sidecar_port > 0
                    && now.duration_since(ps.last_active).as_secs() >= IDLE_TIMEOUT_SECS
            })
            .map(|(k, _)| k.clone())
            .collect();

        let mut collected = Vec::new();

        for key in idle_keys {
            if let Some(ps) = self.peer_sessions.get_mut(&key) {
                ulog_info!(
                    "[im-router] Collecting idle session {} (inactive for {}s, preserving session_id={})",
                    key,
                    now.duration_since(ps.last_active).as_secs(),
                    &ps.session_id,
                );

                // Release the Sidecar via SidecarManager
                let owner = SidecarOwner::Agent(key.clone());
                if let Ok(mut mgr) = sidecar_manager.lock() {
                    let _ = mgr.release_sidecar(&ps.session_id, &owner);
                }

                ps.sidecar_port = 0; // Sidecar released, but session preserved for resume
                collected.push(key);
            }
        }

        collected
    }

    // ── Status & Lookup ────────────────────────────────────────────

    /// Get active session info for status display.
    pub fn get_active_sessions(&self) -> Vec<ActiveSessionInfo> {
        self.peer_sessions
            .values()
            .map(|ps| ActiveSessionInfo {
                session_key: ps.session_key.clone(),
                session_id: ps.session_id.clone(),
                message_count: ps.message_count,
                last_active: chrono::Utc::now().to_rfc3339(), // Approximate
            })
            .collect()
    }

    /// Get a reference to a peer session by session_key.
    pub fn get_peer_session(&self, session_key: &str) -> Option<&PeerSession> {
        self.peer_sessions.get(session_key)
    }

    /// Remove a peer session entry.
    pub fn remove_peer_session(&mut self, session_key: &str) {
        self.peer_sessions.remove(session_key);
    }

    // ── AI Config Sync ─────────────────────────────────────────────

    /// Sync AI config (model + MCP + provider) to a newly created Sidecar.
    /// Called after ensure_sidecar returns is_new=true.
    pub async fn sync_ai_config(
        &self,
        port: u16,
        model: Option<&str>,
        mcp_servers_json: Option<&str>,
        provider_env: Option<&serde_json::Value>,
    ) {
        // 1. Provider env (sync BEFORE model so pre-warm uses the correct provider)
        if let Some(penv) = provider_env {
            let url = format!("http://127.0.0.1:{}/api/provider/set", port);
            match self
                .http_client
                .post(&url)
                .json(&json!({ "providerEnv": penv }))
                .send()
                .await
            {
                Ok(_) => ulog_info!("[im-router] Synced provider env to port {}", port),
                Err(e) => {
                    ulog_warn!("[im-router] Failed to sync provider env to port {}: {}", port, e)
                }
            }
        }

        // 2. Model
        if let Some(model_id) = model {
            let url = format!("http://127.0.0.1:{}/api/model/set", port);
            match self
                .http_client
                .post(&url)
                .json(&json!({ "model": model_id }))
                .send()
                .await
            {
                Ok(_) => ulog_info!("[im-router] Synced model {} to port {}", model_id, port),
                Err(e) => {
                    ulog_warn!("[im-router] Failed to sync model to port {}: {}", port, e)
                }
            }
        }

        // 3. MCP servers
        if let Some(mcp_json) = mcp_servers_json {
            if let Ok(servers) = serde_json::from_str::<Vec<serde_json::Value>>(mcp_json) {
                let url = format!("http://127.0.0.1:{}/api/mcp/set", port);
                match self
                    .http_client
                    .post(&url)
                    .json(&json!({ "servers": servers }))
                    .send()
                    .await
                {
                    Ok(_) => ulog_info!(
                        "[im-router] Synced {} MCP server(s) to port {}",
                        servers.len(),
                        port
                    ),
                    Err(e) => ulog_warn!(
                        "[im-router] Failed to sync MCP to port {}: {}",
                        port,
                        e
                    ),
                }
            }
        }
    }

    /// Sync permission mode to a Sidecar.
    pub async fn sync_permission_mode(&self, port: u16, mode: &str) {
        let url = format!("http://127.0.0.1:{}/api/session/permission-mode", port);
        match self
            .http_client
            .post(&url)
            .json(&json!({ "permissionMode": mode }))
            .send()
            .await
        {
            Ok(_) => ulog_info!(
                "[im-router] Synced permission mode '{}' to port {}",
                mode,
                port
            ),
            Err(e) => ulog_warn!(
                "[im-router] Failed to sync permission mode to port {}: {}",
                port,
                e
            ),
        }
    }

    // ── Accessors ──────────────────────────────────────────────────

    /// Get a reference to the HTTP client (for callers that need to make requests outside the lock).
    pub fn http_client(&self) -> &Client {
        &self.http_client
    }

    /// Get the default workspace path.
    pub fn default_workspace(&self) -> &PathBuf {
        &self.default_workspace
    }

    /// Update default workspace path (hot-reload, only affects new sessions).
    pub fn set_default_workspace(&mut self, path: PathBuf) {
        self.default_workspace = path;
    }

    /// Get all unique active Sidecar ports (for broadcasting config changes).
    pub fn active_sidecar_ports(&self) -> Vec<u16> {
        let mut seen = std::collections::HashSet::new();
        self.peer_sessions
            .values()
            .filter(|ps| ps.sidecar_port > 0)
            .filter_map(|ps| {
                if seen.insert(ps.sidecar_port) {
                    Some(ps.sidecar_port)
                } else {
                    None
                }
            })
            .collect()
    }

    /// Release all sessions (shutdown).
    pub fn release_all(&mut self, sidecar_manager: &ManagedSidecarState) {
        let keys: Vec<String> = self.peer_sessions.keys().cloned().collect();
        for key in keys {
            if let Some(ps) = self.peer_sessions.remove(&key) {
                let owner = SidecarOwner::Agent(key);
                if let Ok(mut mgr) = sidecar_manager.lock() {
                    let _ = mgr.release_sidecar(&ps.session_id, &owner);
                }
            }
        }
    }

    /// Restore peer sessions from persisted health state (startup recovery).
    /// Sidecar ports are set to 0 — the first message will trigger re-creation.
    /// Session IDs are restored so Bun can resume conversation via --session-id.
    pub fn restore_sessions(&mut self, sessions: &[ActiveSessionInfo]) {
        for s in sessions {
            self.peer_sessions.insert(
                s.session_key.clone(),
                PeerSession {
                    session_key: s.session_key.clone(),
                    session_id: s.session_id.clone(),
                    sidecar_port: 0, // Sidecar not running; ensure_sidecar will start it
                    workspace_path: self.default_workspace.clone(),
                    message_count: s.message_count,
                    last_active: Instant::now(),
                },
            );
        }
        if !sessions.is_empty() {
            ulog_info!(
                "[im-router] Restored {} peer session(s) from previous run (workspace={})",
                sessions.len(),
                self.default_workspace.display(),
            );
        }
    }

    /// Touch session activity timestamp to prevent idle collection.
    pub fn touch_session_activity(&mut self, session_key: &str) {
        if let Some(ps) = self.peer_sessions.get_mut(session_key) {
            ps.last_active = Instant::now();
        }
    }
}
