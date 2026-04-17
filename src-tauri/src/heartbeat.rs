//! Heartbeat Backend Scheduler.
//!
//! Per-Agent tokio timer that periodically executes HEARTBEAT.md via the Sidecar API.
//! After a successful heartbeat, triggers Memory Auto-Update check.

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;

use chrono::Timelike;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tokio::sync::{oneshot, Mutex, RwLock};

use crate::im::types::{ActiveHours, AgentConfigRust, HeartbeatConfig, MemoryAutoUpdateConfig};
use crate::sidecar::{self, ManagedSidecarState, SidecarOwner};
use crate::{ulog_error, ulog_info, ulog_warn};

const MAX_CONSECUTIVE_ERRORS: u32 = 3;

// ── Types ──

/// Response from Sidecar POST /api/agent/heartbeat
#[derive(Debug, Deserialize)]
struct HeartbeatResponse {
    status: String, // "silent" | "content" | "error"
    #[allow(dead_code)]
    text: Option<String>,
    #[allow(dead_code)]
    reason: Option<String>,
}

/// Heartbeat execution result
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum HeartbeatResult {
    Success {
        finished_at: String,
        duration_ms: u64,
    },
    Error {
        finished_at: String,
        error: String,
    },
    Skipped {
        reason: String,
    },
}

/// Heartbeat runtime state (not persisted)
#[derive(Debug)]
struct HeartbeatState {
    last_run_at: Option<std::time::Instant>,
    last_result: Option<HeartbeatResult>,
    consecutive_errors: u32,
    paused: bool,
    executing: bool,
}

impl Default for HeartbeatState {
    fn default() -> Self {
        Self {
            last_run_at: None,
            last_result: None,
            consecutive_errors: 0,
            paused: false,
            executing: false,
        }
    }
}

/// Status returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatRunStatus {
    pub agent_id: String,
    pub running: bool,
    pub paused: bool,
    pub last_run_at: Option<String>,
    pub last_result: Option<String>, // "success" | "error" | "skipped"
    pub last_error: Option<String>,
    pub consecutive_errors: u32,
}

// ── HeartbeatRunner ──

struct RunnerHandle {
    shutdown_tx: oneshot::Sender<()>,
    join_handle: tokio::task::JoinHandle<()>,
    state: Arc<Mutex<HeartbeatState>>,
    // Hot-reloadable config
    config: Arc<RwLock<HeartbeatConfig>>,
    // Memory auto-update
    mau_config: Arc<RwLock<Option<MemoryAutoUpdateConfig>>>,
    mau_running: Arc<AtomicBool>,
    // Hot-reloadable AI config (for memory update sidecar sync)
    current_model: Arc<RwLock<Option<String>>>,
    current_provider_env: Arc<RwLock<Option<serde_json::Value>>>,
    mcp_servers_json: Arc<RwLock<Option<String>>>,
}

async fn run_loop<R: Runtime>(
    agent_id: String,
    config: Arc<RwLock<HeartbeatConfig>>,
    workspace_path: String,
    sidecar_manager: ManagedSidecarState,
    app_handle: AppHandle<R>,
    state: Arc<Mutex<HeartbeatState>>,
    mau_config: Arc<RwLock<Option<MemoryAutoUpdateConfig>>>,
    mau_running: Arc<AtomicBool>,
    current_model: Arc<RwLock<Option<String>>>,
    current_provider_env: Arc<RwLock<Option<serde_json::Value>>>,
    mcp_servers_json: Arc<RwLock<Option<String>>>,
    mut shutdown_rx: oneshot::Receiver<()>,
) {
    // Read initial config
    let interval_mins = {
        let cfg = config.read().await;
        cfg.interval_minutes.max(5) // minimum 5 minutes
    };
    let mut interval = tokio::time::interval(Duration::from_secs(interval_mins as u64 * 60));

    // Skip first tick (don't execute immediately on startup)
    interval.tick().await;

    ulog_info!(
        "[Heartbeat] Runner started for agent {} (interval={}min, workspace={})",
        agent_id,
        interval_mins,
        workspace_path
    );

    loop {
        tokio::select! {
            _ = interval.tick() => {
                // Check if interval changed (hot-reload)
                let new_mins = {
                    let cfg = config.read().await;
                    cfg.interval_minutes.max(5)
                };
                if new_mins != interval_mins {
                    ulog_info!("[Heartbeat] Agent {} interval changed {}→{}min", agent_id, interval_mins, new_mins);
                    interval = tokio::time::interval(Duration::from_secs(new_mins as u64 * 60));
                    interval.tick().await; // consume first tick
                    // Reset error state on config change (fresh start)
                    {
                        let mut s = state.lock().await;
                        s.consecutive_errors = 0;
                        s.paused = false;
                    }
                    continue;
                }

                let success = run_once(
                    &agent_id,
                    &config,
                    &workspace_path,
                    &sidecar_manager,
                    &app_handle,
                    &state,
                ).await;

                // Memory auto-update check after successful heartbeat
                if success {
                    let tz = {
                        let cfg = config.read().await;
                        cfg.active_hours.as_ref().map(|ah| ah.timezone.clone())
                    };
                    crate::memory_update::check_and_spawn(
                        &agent_id,
                        &workspace_path,
                        &mau_config,
                        &mau_running,
                        &sidecar_manager,
                        &app_handle,
                        &current_model,
                        &current_provider_env,
                        &mcp_servers_json,
                        tz.as_deref(),
                    ).await;
                }
            }
            _ = &mut shutdown_rx => {
                ulog_info!("[Heartbeat] Runner for agent {} shutting down", agent_id);
                break;
            }
        }
    }
}

async fn run_once<R: Runtime>(
    agent_id: &str,
    config: &Arc<RwLock<HeartbeatConfig>>,
    workspace_path: &str,
    sidecar_manager: &ManagedSidecarState,
    app_handle: &AppHandle<R>,
    state: &Arc<Mutex<HeartbeatState>>,
) -> bool {
    let cfg = config.read().await;

    // Gate 1: Enabled
    if !cfg.enabled {
        return true; // Not a failure
    }

    // Gate 2: Paused due to errors
    {
        let s = state.lock().await;
        if s.paused {
            log::debug!("[Heartbeat] Agent {} paused after {} consecutive errors", agent_id, s.consecutive_errors);
            return true;
        }
    }

    // Gate 3: Active hours
    if let Some(ref active_hours) = cfg.active_hours {
        if !is_in_active_hours(active_hours) {
            log::debug!("[Heartbeat] Agent {} skipped: outside active hours", agent_id);
            return true;
        }
    }

    // Gate 4: Concurrent execution guard
    {
        let mut s = state.lock().await;
        if s.executing {
            log::debug!("[Heartbeat] Agent {} skipped: previous run still executing", agent_id);
            return true;
        }
        s.executing = true;
    }

    let ack_max_chars = cfg.ack_max_chars.unwrap_or(300);
    drop(cfg); // Release config lock before HTTP call

    let start = std::time::Instant::now();
    let result = execute_heartbeat(agent_id, workspace_path, sidecar_manager, app_handle, ack_max_chars).await;
    let duration_ms = start.elapsed().as_millis() as u64;

    let mut s = state.lock().await;
    s.executing = false;
    s.last_run_at = Some(start);

    match result {
        Ok(()) => {
            s.consecutive_errors = 0;
            s.last_result = Some(HeartbeatResult::Success {
                finished_at: chrono::Utc::now().to_rfc3339(),
                duration_ms,
            });
            ulog_info!(
                "[Heartbeat] Agent {} tick: success (duration={}ms)",
                agent_id,
                duration_ms
            );
            true
        }
        Err(e) => {
            s.consecutive_errors += 1;
            s.last_result = Some(HeartbeatResult::Error {
                finished_at: chrono::Utc::now().to_rfc3339(),
                error: e.clone(),
            });

            if s.consecutive_errors >= MAX_CONSECUTIVE_ERRORS {
                s.paused = true;
                ulog_warn!(
                    "[Heartbeat] Agent {} paused after {} consecutive errors. Last: {}",
                    agent_id,
                    s.consecutive_errors,
                    e
                );
            } else {
                ulog_warn!(
                    "[Heartbeat] Agent {} tick: error ({}/{}): {}",
                    agent_id,
                    s.consecutive_errors,
                    MAX_CONSECUTIVE_ERRORS,
                    e
                );
            }
            false
        }
    }
}

async fn execute_heartbeat<R: Runtime>(
    agent_id: &str,
    workspace_path: &str,
    sidecar_manager: &ManagedSidecarState,
    app_handle: &AppHandle<R>,
    ack_max_chars: u32,
) -> Result<(), String> {
    // Ensure sidecar is running for this agent
    let session_id = format!("heartbeat-{}", agent_id);
    let owner = SidecarOwner::Agent(format!("heartbeat:{}", agent_id));

    // Phase 1: Check existing sidecar (brief lock)
    let existing_port = {
        let mut guard = sidecar_manager.lock().map_err(|e| format!("lock: {}", e))?;
        if let Some(instance) = guard.get_instance_mut(&session_id) {
            if instance.is_running() {
                Some(instance.port)
            } else {
                None
            }
        } else {
            None
        }
    }; // guard dropped here

    // Phase 2: Start sidecar if needed (no lock held, may block)
    let port = match existing_port {
        Some(p) => p,
        None => {
            let sm = Arc::clone(sidecar_manager);
            let sid = session_id.clone();
            let own = owner.clone();
            let ah = app_handle.clone();
            let ws = workspace_path.to_string();
            tokio::task::spawn_blocking(move || {
                let bun_path = sidecar::find_bun_executable(&ah)?;
                let script_path = sidecar::find_server_script(&ah)?;
                sidecar::start_sidecar(
                    &sm,
                    sid,
                    Some(std::path::PathBuf::from(ws)),
                    &bun_path,
                    &script_path,
                    Some(own),
                )
            })
            .await
            .map_err(|e| format!("spawn: {}", e))?
            .map_err(|e| format!("start_sidecar: {}", e))?
        }
    };

    // POST /api/agent/heartbeat
    let client = crate::local_http::builder()
        .timeout(Duration::from_secs(330)) // 5.5 min
        .build()
        .map_err(|e| format!("client: {}", e))?;

    let url = format!("http://127.0.0.1:{}/api/agent/heartbeat", port);
    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "agentId": agent_id,
            "workspacePath": workspace_path,
            "ackMaxChars": ack_max_chars,
        }))
        .send()
        .await
        .map_err(|e| format!("HTTP: {}", e))?;

    let body: HeartbeatResponse = resp
        .json()
        .await
        .map_err(|e| format!("parse: {}", e))?;

    match body.status.as_str() {
        "silent" | "content" => Ok(()),
        "error" => Err(body.text.unwrap_or_else(|| "Unknown error".to_string())),
        other => Err(format!("Unknown status: {}", other)),
    }
}

// ── Active Hours ──

fn is_in_active_hours(hours: &ActiveHours) -> bool {
    let tz: chrono_tz::Tz = match hours.timezone.parse() {
        Ok(tz) => tz,
        Err(_) => {
            ulog_warn!(
                "[Heartbeat] Invalid timezone '{}', assuming active",
                hours.timezone
            );
            return true;
        }
    };

    let now = chrono::Utc::now().with_timezone(&tz);
    let now_minutes = now.hour() * 60 + now.minute();

    let start = parse_hhmm(&hours.start).unwrap_or(0);
    let end = parse_hhmm(&hours.end).unwrap_or(24 * 60);

    if start <= end {
        now_minutes >= start && now_minutes < end
    } else {
        // Cross-midnight: e.g. 22:00-06:00
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

// ── HeartbeatManager ──

pub struct HeartbeatManager {
    runners: Mutex<HashMap<String, RunnerHandle>>,
    sidecar_manager: ManagedSidecarState,
}

impl HeartbeatManager {
    pub fn new(sidecar_manager: ManagedSidecarState) -> Self {
        Self {
            runners: Mutex::new(HashMap::new()),
            sidecar_manager,
        }
    }

    /// Start runners for all agents with heartbeat enabled.
    /// Called at app startup.
    pub async fn start<R: Runtime>(&self, app_handle: &AppHandle<R>) {
        let agents = match read_agent_configs() {
            Some(a) => a,
            None => return,
        };

        for agent in &agents {
            if !agent.enabled {
                continue;
            }
            if let Some(ref hb) = agent.heartbeat {
                if hb.enabled {
                    self.start_runner(
                        &agent.id,
                        hb.clone(),
                        &agent.workspace_path,
                        agent.memory_auto_update.clone(),
                        app_handle,
                    )
                    .await;
                }
            }
        }
    }

    /// Sync a single agent's heartbeat state (start/stop/restart).
    /// Called when config changes.
    pub async fn sync_agent<R: Runtime>(
        &self,
        agent_id: &str,
        config: Option<HeartbeatConfig>,
        workspace_path: &str,
        mau_config: Option<MemoryAutoUpdateConfig>,
        app_handle: &AppHandle<R>,
    ) {
        let should_run = config.as_ref().map(|c| c.enabled).unwrap_or(false);

        if should_run {
            // Stop existing runner if any (will restart with new config)
            self.stop_runner(agent_id).await;
            self.start_runner(
                agent_id,
                config.unwrap(),
                workspace_path,
                mau_config,
                app_handle,
            )
            .await;
        } else {
            self.stop_runner(agent_id).await;
        }
    }

    /// Resume a paused agent.
    pub async fn resume(&self, agent_id: &str) {
        let runners = self.runners.lock().await;
        if let Some(handle) = runners.get(agent_id) {
            let mut s = handle.state.lock().await;
            s.paused = false;
            s.consecutive_errors = 0;
            ulog_info!("[Heartbeat] Agent {} resumed by user", agent_id);
        }
    }

    /// Update memory auto-update config for a running agent.
    pub async fn update_mau_config(
        &self,
        agent_id: &str,
        mau: Option<MemoryAutoUpdateConfig>,
    ) {
        let runners = self.runners.lock().await;
        if let Some(handle) = runners.get(agent_id) {
            *handle.mau_config.write().await = mau;
        }
    }

    /// Get status for a single agent.
    pub async fn get_status(&self, agent_id: &str) -> Option<HeartbeatRunStatus> {
        let runners = self.runners.lock().await;
        let handle = runners.get(agent_id)?;
        let s = handle.state.lock().await;

        Some(HeartbeatRunStatus {
            agent_id: agent_id.to_string(),
            running: !s.paused,
            paused: s.paused,
            last_run_at: s.last_run_at.map(|_| chrono::Utc::now().to_rfc3339()), // approximate
            last_result: s.last_result.as_ref().map(|r| match r {
                HeartbeatResult::Success { .. } => "success".to_string(),
                HeartbeatResult::Error { .. } => "error".to_string(),
                HeartbeatResult::Skipped { .. } => "skipped".to_string(),
            }),
            last_error: s.last_result.as_ref().and_then(|r| match r {
                HeartbeatResult::Error { error, .. } => Some(error.clone()),
                _ => None,
            }),
            consecutive_errors: s.consecutive_errors,
        })
    }

    /// Get status for all agents.
    pub async fn get_all_status(&self) -> Vec<HeartbeatRunStatus> {
        let runners = self.runners.lock().await;
        let mut result = Vec::new();
        for (agent_id, handle) in runners.iter() {
            let s = handle.state.lock().await;
            result.push(HeartbeatRunStatus {
                agent_id: agent_id.clone(),
                running: !s.paused,
                paused: s.paused,
                last_run_at: s.last_run_at.map(|_| chrono::Utc::now().to_rfc3339()),
                last_result: s.last_result.as_ref().map(|r| match r {
                    HeartbeatResult::Success { .. } => "success".to_string(),
                    HeartbeatResult::Error { .. } => "error".to_string(),
                    HeartbeatResult::Skipped { .. } => "skipped".to_string(),
                }),
                last_error: s.last_result.as_ref().and_then(|r| match r {
                    HeartbeatResult::Error { error, .. } => Some(error.clone()),
                    _ => None,
                }),
                consecutive_errors: s.consecutive_errors,
            });
        }
        result
    }

    /// Shutdown all runners gracefully.
    pub async fn shutdown(&self) {
        let mut runners = self.runners.lock().await;
        for (agent_id, handle) in runners.drain() {
            ulog_info!("[Heartbeat] Stopping runner for agent {}", agent_id);
            let _ = handle.shutdown_tx.send(());
            // Give it a moment to clean up
            let _ = tokio::time::timeout(Duration::from_secs(5), handle.join_handle).await;
        }
    }

    // ── Private ──

    async fn start_runner<R: Runtime>(
        &self,
        agent_id: &str,
        config: HeartbeatConfig,
        workspace_path: &str,
        mau_config: Option<MemoryAutoUpdateConfig>,
        app_handle: &AppHandle<R>,
    ) {
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let state = Arc::new(Mutex::new(HeartbeatState::default()));
        let config_arc = Arc::new(RwLock::new(config));
        let mau_config_arc = Arc::new(RwLock::new(mau_config));
        let mau_running_arc = Arc::new(AtomicBool::new(false));
        let current_model = Arc::new(RwLock::new(None::<String>));
        let current_provider_env = Arc::new(RwLock::new(None::<serde_json::Value>));
        let mcp_servers_json = Arc::new(RwLock::new(None::<String>));

        let agent_id_owned = agent_id.to_string();
        let workspace_owned = workspace_path.to_string();
        let sm = Arc::clone(&self.sidecar_manager);
        let ah = app_handle.clone();
        let state_clone = Arc::clone(&state);
        let config_clone = Arc::clone(&config_arc);
        let mau_config_clone = Arc::clone(&mau_config_arc);
        let mau_running_clone = Arc::clone(&mau_running_arc);
        let model_clone = Arc::clone(&current_model);
        let provider_clone = Arc::clone(&current_provider_env);
        let mcp_clone = Arc::clone(&mcp_servers_json);

        let join_handle = tokio::spawn(async move {
            run_loop(
                agent_id_owned,
                config_clone,
                workspace_owned,
                sm,
                ah,
                state_clone,
                mau_config_clone,
                mau_running_clone,
                model_clone,
                provider_clone,
                mcp_clone,
                shutdown_rx,
            )
            .await;
        });

        let mut runners = self.runners.lock().await;
        runners.insert(
            agent_id.to_string(),
            RunnerHandle {
                shutdown_tx,
                join_handle,
                state,
                config: config_arc,
                mau_config: mau_config_arc,
                mau_running: mau_running_arc,
                current_model,
                current_provider_env,
                mcp_servers_json,
            },
        );

        ulog_info!("[Heartbeat] Runner started for agent {}", agent_id);
    }

    async fn stop_runner(&self, agent_id: &str) {
        let mut runners = self.runners.lock().await;
        if let Some(handle) = runners.remove(agent_id) {
            let _ = handle.shutdown_tx.send(());
            let _ = tokio::time::timeout(Duration::from_secs(5), handle.join_handle).await;
            ulog_info!("[Heartbeat] Runner stopped for agent {}", agent_id);
        }
    }
}

// ── Helpers ──

/// Read agent configs from ~/.soagents/config.json
fn read_agent_configs() -> Option<Vec<AgentConfigRust>> {
    let config_path = dirs::home_dir()?.join(".soagents").join("config.json");
    let content = std::fs::read_to_string(&config_path).ok()?;
    let config: serde_json::Value = serde_json::from_str(&content).ok()?;
    let agents = config.get("agents")?.as_array()?;
    let mut result = Vec::new();
    for agent in agents {
        if let Ok(a) = serde_json::from_value::<AgentConfigRust>(agent.clone()) {
            result.push(a);
        }
    }
    Some(result)
}
