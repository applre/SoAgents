//! Memory Auto-Update execution engine.
//!
//! Triggered by HeartbeatRunner after successful heartbeat.
//! Checks 6 gates, then spawns an async batch task that injects
//! UPDATE_MEMORY.md content into qualifying sessions via Sidecar API.

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Timelike, Utc};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::RwLock;

use crate::sidecar::{self, ManagedSidecarState, SidecarOwner};
use crate::{ulog_error, ulog_info, ulog_warn};

use crate::im::types::MemoryAutoUpdateConfig;

/// Cooldown: skip sessions with user activity in the last N minutes, retry once after waiting.
const ACTIVE_SESSION_COOLDOWN_MINUTES: i64 = 15;

/// Lightweight session metadata from sessions.json (only fields we need)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionMeta {
    id: String,
    #[serde(default)]
    agent_dir: Option<String>,
    #[serde(default)]
    last_active_at: Option<String>,
}

/// Minimal message line from session JSONL
#[derive(Debug, Deserialize)]
struct MessageLine {
    role: Option<String>,
    content: Option<serde_json::Value>,
}

/// Response from Bun POST /api/agent/memory-update
#[derive(Debug, Deserialize)]
struct MemoryUpdateResponse {
    status: String,
    #[allow(dead_code)]
    reason: Option<String>,
}

// ── Entry point ──

/// Check all gates and spawn a batch task if conditions are met.
/// Called by HeartbeatRunner after a successful heartbeat.
pub async fn check_and_spawn<R: Runtime>(
    agent_id: &str,
    workspace_path: &str,
    config: &Arc<RwLock<Option<MemoryAutoUpdateConfig>>>,
    is_running: &Arc<AtomicBool>,
    sidecar_manager: &ManagedSidecarState,
    app_handle: &AppHandle<R>,
    // Hot-reloadable AI config for syncing to temp sidecars
    current_model: &Arc<RwLock<Option<String>>>,
    current_provider_env: &Arc<RwLock<Option<serde_json::Value>>>,
    mcp_servers_json: &Arc<RwLock<Option<String>>>,
    heartbeat_timezone: Option<&str>,
) {
    // Gate 1: Config exists and enabled
    let mau_config = {
        let guard = config.read().await;
        match guard.as_ref() {
            Some(c) if c.enabled => {
                let mut cfg = c.clone();
                // Timezone fallback: memoryAutoUpdate → heartbeat.activeHours → Asia/Shanghai
                if cfg.update_window_timezone.is_none() {
                    cfg.update_window_timezone = heartbeat_timezone.map(|s| s.to_string());
                }
                cfg
            }
            _ => return,
        }
    };

    // Gate 2: Current time in update window
    if !is_in_update_window(&mau_config) {
        log::debug!("[MemoryUpdate] Skipped: outside update window");
        return;
    }

    // Gate 3: Interval since last batch
    if let Some(ref last_batch) = mau_config.last_batch_at {
        if let Ok(last_dt) = last_batch.parse::<DateTime<Utc>>() {
            let hours_since = (Utc::now() - last_dt).num_hours();
            if hours_since < mau_config.interval_hours as i64 {
                log::debug!(
                    "[MemoryUpdate] Skipped: only {}h since last batch (need {}h)",
                    hours_since,
                    mau_config.interval_hours
                );
                return;
            }
        }
    }

    // Gate 4: Not already running (atomic CAS)
    if is_running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        log::debug!("[MemoryUpdate] Skipped: batch already running");
        return;
    }

    // Gate 5: UPDATE_MEMORY.md exists and has content
    let update_md_path = Path::new(workspace_path).join("UPDATE_MEMORY.md");
    if !update_md_path.exists() {
        log::debug!("[MemoryUpdate] Skipped: UPDATE_MEMORY.md not found");
        is_running.store(false, Ordering::SeqCst);
        return;
    }
    match std::fs::read_to_string(&update_md_path) {
        Ok(content) => {
            let body = strip_yaml_frontmatter(&content);
            if body.trim().is_empty() {
                log::debug!("[MemoryUpdate] Skipped: UPDATE_MEMORY.md body is empty");
                is_running.store(false, Ordering::SeqCst);
                return;
            }
        }
        Err(e) => {
            ulog_warn!("[MemoryUpdate] Failed to read UPDATE_MEMORY.md: {}", e);
            is_running.store(false, Ordering::SeqCst);
            return;
        }
    }

    // Gate 6: Qualifying sessions exist
    let qualifying = collect_qualifying_sessions(workspace_path, &mau_config);
    if qualifying.is_empty() {
        log::debug!("[MemoryUpdate] Skipped: no qualifying sessions");
        is_running.store(false, Ordering::SeqCst);
        return;
    }

    ulog_info!(
        "[MemoryUpdate] Starting batch for agent {} — {} qualifying session(s)",
        agent_id,
        qualifying.len()
    );

    // Record lastBatchAt NOW (before spawning)
    update_config_field(app_handle, agent_id, |c| {
        c.last_batch_at = Some(Utc::now().to_rfc3339());
    })
    .await;

    // Spawn independent batch task
    let is_running_clone = Arc::clone(is_running);
    let agent_id_owned = agent_id.to_string();
    let sm = Arc::clone(sidecar_manager);
    let ah = app_handle.clone();
    let session_count = qualifying.len();
    let model = Arc::clone(current_model);
    let provider_env = Arc::clone(current_provider_env);
    let mcp_json = Arc::clone(mcp_servers_json);

    tokio::spawn(async move {
        let count = run_batch(&qualifying, &agent_id_owned, &sm, &ah, &model, &provider_env, &mcp_json).await;

        // Update lastBatchSessionCount
        update_config_field(&ah, &agent_id_owned, move |c| {
            c.last_batch_session_count = Some(count);
        })
        .await;

        is_running_clone.store(false, Ordering::SeqCst);
        ulog_info!(
            "[MemoryUpdate] Batch complete for agent {} — {}/{} sessions updated",
            agent_id_owned,
            count,
            session_count
        );
    });
}

// ── Batch execution ──

async fn run_batch<R: Runtime>(
    sessions: &[String],
    agent_id: &str,
    sidecar_manager: &ManagedSidecarState,
    app_handle: &AppHandle<R>,
    current_model: &Arc<RwLock<Option<String>>>,
    current_provider_env: &Arc<RwLock<Option<serde_json::Value>>>,
    mcp_servers_json: &Arc<RwLock<Option<String>>>,
) -> u32 {
    let http_client = crate::local_http::builder()
        .timeout(Duration::from_secs(3660)) // 61 min (Bun waits 60 min internally)
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let mut updated = 0u32;
    let mut deferred: Vec<String> = Vec::new();

    // Phase 1: process idle sessions, defer recently active ones
    let active_map = read_session_last_active_map();
    let cutoff = Utc::now() - chrono::Duration::minutes(ACTIVE_SESSION_COOLDOWN_MINUTES);

    for session_id in sessions {
        if let Some(last_active) = active_map.get(session_id.as_str()) {
            if *last_active > cutoff {
                let ago = (Utc::now() - *last_active).num_minutes();
                ulog_info!(
                    "[MemoryUpdate] Session {} active {}min ago (cooldown {}min), deferring",
                    session_id,
                    ago,
                    ACTIVE_SESSION_COOLDOWN_MINUTES
                );
                deferred.push(session_id.clone());
                continue;
            }
        }

        match update_single_session(session_id, agent_id, sidecar_manager, app_handle, &http_client, current_model, current_provider_env, mcp_servers_json)
            .await
        {
            Ok(()) => {
                updated += 1;
                ulog_info!("[MemoryUpdate] Session {} updated successfully", session_id);
            }
            Err(e) => {
                ulog_error!("[MemoryUpdate] Session {} failed: {}", session_id, e);
            }
        }
    }

    // Phase 2: retry deferred sessions after cooldown
    if !deferred.is_empty() {
        ulog_info!(
            "[MemoryUpdate] {} session(s) deferred, retrying in {}min",
            deferred.len(),
            ACTIVE_SESSION_COOLDOWN_MINUTES
        );
        tokio::time::sleep(Duration::from_secs(
            ACTIVE_SESSION_COOLDOWN_MINUTES as u64 * 60,
        ))
        .await;

        // Re-read fresh timestamps
        let fresh_map = read_session_last_active_map();
        let fresh_cutoff = Utc::now() - chrono::Duration::minutes(ACTIVE_SESSION_COOLDOWN_MINUTES);

        for session_id in &deferred {
            if let Some(last_active) = fresh_map.get(session_id.as_str()) {
                if *last_active > fresh_cutoff {
                    ulog_info!(
                        "[MemoryUpdate] Session {} still active after wait, skipping",
                        session_id
                    );
                    continue;
                }
            }

            match update_single_session(
                session_id,
                agent_id,
                sidecar_manager,
                app_handle,
                &http_client,
                current_model,
                current_provider_env,
                mcp_servers_json,
            )
            .await
            {
                Ok(()) => {
                    updated += 1;
                    ulog_info!(
                        "[MemoryUpdate] Session {} updated successfully (deferred)",
                        session_id
                    );
                }
                Err(e) => {
                    ulog_error!(
                        "[MemoryUpdate] Session {} failed (deferred): {}",
                        session_id,
                        e
                    );
                }
            }
        }
    }

    updated
}

// ── Single session update ──

async fn update_single_session<R: Runtime>(
    session_id: &str,
    agent_id: &str,
    sidecar_manager: &ManagedSidecarState,
    app_handle: &AppHandle<R>,
    http_client: &reqwest::Client,
    current_model: &Arc<RwLock<Option<String>>>,
    current_provider_env: &Arc<RwLock<Option<serde_json::Value>>>,
    mcp_servers_json: &Arc<RwLock<Option<String>>>,
) -> Result<(), String> {
    // Check if sidecar already has a port for this session
    let existing_port = {
        let mut guard = sidecar_manager
            .lock()
            .map_err(|e| format!("lock: {}", e))?;
        if let Some(instance) = guard.get_instance_mut(session_id) {
            if instance.is_running() {
                Some(instance.port)
            } else {
                None
            }
        } else {
            None
        }
    };

    let memory_update_key = format!("memory_update:{}:{}", agent_id, session_id);
    let owner = SidecarOwner::Agent(memory_update_key.clone());

    let (port, was_temp) = if let Some(port) = existing_port {
        (port, false)
    } else {
        // Spawn temporary sidecar
        let sm = Arc::clone(sidecar_manager);
        let sid = session_id.to_string();
        let own = owner.clone();
        let ah = app_handle.clone();

        let result = tokio::task::spawn_blocking(move || {
            let bun_path = sidecar::find_bun_executable(&ah)?;
            let script_path = sidecar::find_server_script(&ah)?;
            sidecar::start_sidecar(&sm, sid, None, &bun_path, &script_path, Some(own))
        })
        .await
        .map_err(|e| format!("spawn_blocking: {}", e))?
        .map_err(|e| format!("start_sidecar: {}", e))?;

        // Sync AI config to newly created sidecar
        sync_ai_config_to_port(result, current_model, current_provider_env, mcp_servers_json).await;

        (result, true)
    };

    // POST /api/agent/memory-update — release temp sidecar on ALL exit paths
    let update_result: Result<(), String> = async {
        let url = format!("http://127.0.0.1:{}/api/agent/memory-update", port);
        let resp = http_client
            .post(&url)
            .json(&serde_json::json!({ "source": "auto" }))
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let body: MemoryUpdateResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        match body.status.as_str() {
            "completed" => Ok(()),
            "timeout" => {
                ulog_warn!(
                    "[MemoryUpdate] Session {} timed out (AI took too long)",
                    session_id
                );
                Ok(()) // Still count as attempted — don't retry immediately
            }
            "skipped" => Err(format!("Skipped: {:?}", body.reason)),
            _ => Err(format!("Unexpected status: {}", body.status)),
        }
    }
    .await;

    // Always release temp sidecar, regardless of success/failure
    if was_temp {
        let mut guard = sidecar_manager
            .lock()
            .map_err(|e| format!("lock: {}", e))?;
        let _ = guard.release_sidecar(session_id, &owner);
    }

    update_result
}

// ── Session qualification ──

fn collect_qualifying_sessions(
    workspace_path: &str,
    config: &MemoryAutoUpdateConfig,
) -> Vec<String> {
    let soagents_dir = match dirs::home_dir() {
        Some(home) => home.join(".soagents"),
        None => return vec![],
    };

    // Read sessions.json
    let sessions_path = soagents_dir.join("sessions.json");
    let sessions_content = match std::fs::read_to_string(&sessions_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let all_sessions: Vec<SessionMeta> = match serde_json::from_str(&sessions_content) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let normalized_workspace = workspace_path.replace('\\', "/");
    let cutoff = Utc::now() - chrono::Duration::hours(config.interval_hours as i64);

    let mut qualifying = Vec::new();

    for session in &all_sessions {
        // Filter: belongs to this workspace
        let agent_dir = match &session.agent_dir {
            Some(d) => d.replace('\\', "/"),
            None => continue,
        };
        if agent_dir != normalized_workspace {
            continue;
        }

        // Filter: active within time window
        if let Some(ref last_active) = session.last_active_at {
            if let Ok(dt) = last_active.parse::<DateTime<Utc>>() {
                if dt < cutoff {
                    continue;
                }
            }
        } else {
            continue; // No lastActiveAt → skip
        }

        // Filter: query count >= threshold
        let query_count = count_queries_since_last_update(&soagents_dir, &session.id);
        if query_count < config.query_threshold {
            continue;
        }

        qualifying.push(session.id.clone());
    }

    qualifying
}

fn count_queries_since_last_update(soagents_dir: &Path, session_id: &str) -> u32 {
    let jsonl_path = soagents_dir
        .join("sessions")
        .join(format!("{}.jsonl", session_id));
    let content = match std::fs::read_to_string(&jsonl_path) {
        Ok(c) => c,
        Err(_) => return 0,
    };

    let lines: Vec<&str> = content.lines().collect();
    let mut last_update_idx: Option<usize> = None;

    // Find last memory update marker (scan from end)
    for (i, line) in lines.iter().enumerate().rev() {
        if let Ok(msg) = serde_json::from_str::<MessageLine>(line) {
            if msg.role.as_deref() == Some("user") {
                if let Some(ref c) = msg.content {
                    let text = match c {
                        serde_json::Value::String(s) => s.as_str(),
                        _ => continue,
                    };
                    if text.contains("<MEMORY_UPDATE>") || text.contains("/UPDATE_MEMORY") {
                        last_update_idx = Some(i);
                        break;
                    }
                }
            }
        }
    }

    // Count user messages after the marker (excluding system injections)
    let start = last_update_idx.map(|i| i + 1).unwrap_or(0);
    let mut count = 0u32;

    for line in &lines[start..] {
        if let Ok(msg) = serde_json::from_str::<MessageLine>(line) {
            if msg.role.as_deref() == Some("user") {
                if let Some(ref c) = msg.content {
                    let text = match c {
                        serde_json::Value::String(s) => s.as_str(),
                        _ => continue,
                    };
                    // Exclude system-injected messages
                    if text.contains("<MEMORY_UPDATE>")
                        || text.contains("<HEARTBEAT>")
                        || text.starts_with("<system-reminder>")
                    {
                        continue;
                    }
                    count += 1;
                }
            }
        }
    }

    count
}

// ── Time window ──

fn is_in_update_window(config: &MemoryAutoUpdateConfig) -> bool {
    let tz_name = config
        .update_window_timezone
        .as_deref()
        .unwrap_or("Asia/Shanghai");
    let tz: chrono_tz::Tz = match tz_name.parse() {
        Ok(tz) => tz,
        Err(_) => {
            ulog_warn!(
                "[MemoryUpdate] Invalid timezone '{}', assuming in-window",
                tz_name
            );
            return true;
        }
    };

    let now = Utc::now().with_timezone(&tz);
    let now_minutes = now.hour() * 60 + now.minute();

    let start = parse_hhmm(&config.update_window_start).unwrap_or(0);
    let end = parse_hhmm(&config.update_window_end).unwrap_or(360); // 06:00

    if start <= end {
        // Normal range: e.g. 00:00 - 06:00
        now_minutes >= start && now_minutes < end
    } else {
        // Wrapping range: e.g. 22:00 - 06:00
        now_minutes >= start || now_minutes < end
    }
}

fn parse_hhmm(s: &str) -> Option<u32> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let h: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    Some(h * 60 + m)
}

// ── Helpers ──

fn strip_yaml_frontmatter(content: &str) -> &str {
    let trimmed = content.trim();
    if !trimmed.starts_with("---") {
        return trimmed;
    }
    // Find second ---
    if let Some(end_idx) = trimmed[3..].find("---") {
        let after = &trimmed[3 + end_idx + 3..];
        after.trim()
    } else {
        trimmed
    }
}

fn read_session_last_active_map() -> HashMap<String, DateTime<Utc>> {
    let soagents_dir = match dirs::home_dir() {
        Some(home) => home.join(".soagents"),
        None => return Default::default(),
    };

    let sessions_path = soagents_dir.join("sessions.json");
    let content = match std::fs::read_to_string(&sessions_path) {
        Ok(c) => c,
        Err(_) => return Default::default(),
    };

    let sessions: Vec<SessionMeta> = match serde_json::from_str(&content) {
        Ok(s) => s,
        Err(_) => return Default::default(),
    };

    let mut map = HashMap::new();
    for session in sessions {
        if let Some(ref last_active) = session.last_active_at {
            if let Ok(dt) = last_active.parse::<DateTime<Utc>>() {
                map.insert(session.id.clone(), dt);
            }
        }
    }
    map
}

/// Atomic update of a MemoryAutoUpdateConfig field in config.json.
/// Reads latest from disk, applies mutation, writes atomically (tmp+rename).
async fn update_config_field<R: Runtime>(
    app_handle: &AppHandle<R>,
    agent_id: &str,
    f: impl FnOnce(&mut MemoryAutoUpdateConfig) + Send + 'static,
) {
    let agent_id_owned = agent_id.to_string();
    let result = tokio::task::spawn_blocking(move || -> Result<(), String> {
        let config_path = dirs::home_dir()
            .ok_or("No home dir")?
            .join(".soagents")
            .join("config.json");

        let content =
            std::fs::read_to_string(&config_path).map_err(|e| format!("Read config: {}", e))?;
        let mut config: serde_json::Value =
            serde_json::from_str(&content).map_err(|e| format!("Parse config: {}", e))?;

        if let Some(agents) = config.get_mut("agents").and_then(|a| a.as_array_mut()) {
            for agent in agents.iter_mut() {
                if agent.get("id").and_then(|v| v.as_str()) == Some(&agent_id_owned) {
                    let mut mau: MemoryAutoUpdateConfig = agent
                        .get("memoryAutoUpdate")
                        .and_then(|v| serde_json::from_value(v.clone()).ok())
                        .unwrap_or_default();
                    f(&mut mau);
                    agent["memoryAutoUpdate"] =
                        serde_json::to_value(&mau).unwrap_or(serde_json::Value::Null);
                    break;
                }
            }
        }

        // Atomic write: tmp file + rename
        let tmp_path = config_path.with_extension("json.tmp");
        std::fs::write(
            &tmp_path,
            serde_json::to_string_pretty(&config).unwrap_or_default(),
        )
        .map_err(|e| format!("Write tmp: {}", e))?;
        std::fs::rename(&tmp_path, &config_path).map_err(|e| format!("Rename: {}", e))?;

        Ok(())
    })
    .await;

    match result {
        Ok(Ok(())) => {}
        Ok(Err(e)) => ulog_error!("[MemoryUpdate] Failed to update config: {}", e),
        Err(e) => ulog_error!("[MemoryUpdate] spawn_blocking error: {}", e),
    }

    // Notify frontend
    let _ = app_handle.emit("agent:config-changed", serde_json::json!({}));
}

/// Sync AI config (model, provider, MCP) to a sidecar port.
async fn sync_ai_config_to_port(
    port: u16,
    current_model: &Arc<RwLock<Option<String>>>,
    current_provider_env: &Arc<RwLock<Option<serde_json::Value>>>,
    mcp_servers_json: &Arc<RwLock<Option<String>>>,
) {
    let client = match crate::local_http::builder()
        .timeout(Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(_) => return,
    };

    let model = current_model.read().await.clone();
    let provider_env = current_provider_env.read().await.clone();
    let mcp = mcp_servers_json.read().await.clone();

    let mut payload = serde_json::Map::new();
    if let Some(m) = model {
        payload.insert("model".into(), serde_json::Value::String(m));
    }
    if let Some(env) = provider_env {
        payload.insert("providerEnv".into(), env);
    }
    if let Some(mcp_json) = mcp {
        payload.insert("mcpServersJson".into(), serde_json::Value::String(mcp_json));
    }

    if !payload.is_empty() {
        let url = format!("http://127.0.0.1:{}/api/config/sync", port);
        let _ = client
            .post(&url)
            .json(&serde_json::Value::Object(payload))
            .send()
            .await;
    }
}
