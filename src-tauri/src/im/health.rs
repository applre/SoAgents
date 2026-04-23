// IM Health State — periodic persistence to ~/.soagents/agents/{agentId}/channels/{channelId}/state.json
// Used for Desktop UI status display, restart recovery, and diagnostics.

use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

use super::types::{ActiveSessionInfo, ImHealthState, ImStatus};
use crate::{ulog_info, ulog_warn};

/// Persist interval (seconds)
const PERSIST_INTERVAL_SECS: u64 = 5;

/// Managed health state with periodic persistence.
/// Persist path convention: ~/.soagents/agents/{agentId}/channels/{channelId}/state.json
pub struct HealthManager {
    state: Arc<Mutex<ImHealthState>>,
    persist_path: PathBuf,
}

impl HealthManager {
    pub fn new(persist_path: PathBuf) -> Self {
        // Try to load existing state, or start fresh
        let state = if persist_path.exists() {
            match std::fs::read_to_string(&persist_path) {
                Ok(content) => {
                    serde_json::from_str::<ImHealthState>(&content).unwrap_or_default()
                }
                Err(_) => ImHealthState::default(),
            }
        } else {
            ImHealthState::default()
        };

        Self {
            state: Arc::new(Mutex::new(state)),
            persist_path,
        }
    }

    /// Get a clone of current health state
    pub async fn get_state(&self) -> ImHealthState {
        self.state.lock().await.clone()
    }

    /// Update status
    pub async fn set_status(&self, status: ImStatus) {
        self.state.lock().await.status = status;
    }

    /// Set bot username
    pub async fn set_bot_username(&self, username: String) {
        self.state.lock().await.bot_username = Some(username);
    }

    /// Set error message
    pub async fn set_error(&self, message: String) {
        self.state.lock().await.error_message = Some(message);
    }

    /// Increment restart count
    pub async fn increment_restart_count(&self) {
        self.state.lock().await.restart_count += 1;
    }

    /// Update uptime
    pub async fn set_uptime(&self, seconds: u64) {
        self.state.lock().await.uptime_seconds = seconds;
    }

    /// Update last message timestamp
    pub async fn set_last_message_at(&self, timestamp: String) {
        self.state.lock().await.last_message_at = Some(timestamp);
    }

    /// Update active sessions list
    pub async fn set_active_sessions(&self, sessions: Vec<ActiveSessionInfo>) {
        self.state.lock().await.active_sessions = sessions;
    }

    /// Update buffered messages count
    pub async fn set_buffered_messages(&self, count: usize) {
        self.state.lock().await.buffered_messages = count;
    }

    /// Persist current state to disk (atomic: write .tmp then rename)
    pub async fn persist(&self) -> Result<(), String> {
        let mut state = self.state.lock().await;
        state.last_persisted = chrono::Utc::now().to_rfc3339();

        let json = serde_json::to_string_pretty(&*state)
            .map_err(|e| format!("Serialize error: {}", e))?;

        // Ensure parent directory exists
        if let Some(parent) = self.persist_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create health dir: {}", e))?;
        }

        // Atomic write: write to .tmp then rename
        let tmp_path = self.persist_path.with_extension("json.tmp");
        std::fs::write(&tmp_path, &json)
            .map_err(|e| format!("Failed to write health state tmp: {}", e))?;
        std::fs::rename(&tmp_path, &self.persist_path)
            .map_err(|e| format!("Failed to rename health state tmp: {}", e))?;

        Ok(())
    }

    /// Start periodic persistence task (runs until shutdown signal is received).
    /// Returns a JoinHandle for the spawned task.
    pub fn start_persist_loop(
        self: Arc<Self>,
        mut shutdown_rx: tokio::sync::watch::Receiver<bool>,
    ) -> tokio::task::JoinHandle<()> {
        let state = Arc::clone(&self.state);
        let persist_path = self.persist_path.clone();

        tokio::spawn(async move {
            let mut tick = interval(Duration::from_secs(PERSIST_INTERVAL_SECS));

            loop {
                tokio::select! {
                    _ = tick.tick() => {
                        let mut s = state.lock().await;
                        s.last_persisted = chrono::Utc::now().to_rfc3339();
                        let json = serde_json::to_string_pretty(&*s).unwrap_or_default();
                        drop(s);

                        if let Some(parent) = persist_path.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }

                        // Atomic write: tmp then rename
                        let tmp_path = persist_path.with_extension("json.tmp");
                        if std::fs::write(&tmp_path, &json).is_ok() {
                            if let Err(e) = std::fs::rename(&tmp_path, &persist_path) {
                                ulog_warn!("[im-health] Failed to rename health state: {}", e);
                            }
                        } else if let Err(e) = std::fs::write(&persist_path, &json) {
                            ulog_warn!("[im-health] Failed to persist: {}", e);
                        }
                    }
                    _ = shutdown_rx.changed() => {
                        if *shutdown_rx.borrow() {
                            ulog_info!("[im-health] Persist loop shutting down");
                            break;
                        }
                    }
                }
            }
        })
    }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/// ~/.soagents/
fn soagents_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".soagents")
}

/// ~/.soagents/agents/{agentId}/channels/{channelId}/
pub fn agent_channel_data_dir(agent_id: &str, channel_id: &str) -> PathBuf {
    debug_assert!(
        !agent_id.is_empty()
            && !agent_id.contains('/')
            && !agent_id.contains('\\')
            && !agent_id.contains(".."),
        "[im-health] Invalid agent_id for path construction: {:?}",
        agent_id
    );
    debug_assert!(
        !channel_id.is_empty()
            && !channel_id.contains('/')
            && !channel_id.contains('\\')
            && !channel_id.contains(".."),
        "[im-health] Invalid channel_id for path construction: {:?}",
        channel_id
    );
    soagents_dir()
        .join("agents")
        .join(agent_id)
        .join("channels")
        .join(channel_id)
}

/// ~/.soagents/agents/{agentId}/channels/{channelId}/state.json
pub fn agent_channel_health_path(agent_id: &str, channel_id: &str) -> PathBuf {
    agent_channel_data_dir(agent_id, channel_id).join("state.json")
}

/// ~/.soagents/agents/{agentId}/channels/{channelId}/buffer.json
pub fn agent_channel_buffer_path(agent_id: &str, channel_id: &str) -> PathBuf {
    agent_channel_data_dir(agent_id, channel_id).join("buffer.json")
}

/// ~/.soagents/agents/{agentId}/channels/{channelId}/dedup.json
pub fn agent_channel_dedup_path(agent_id: &str, channel_id: &str) -> PathBuf {
    agent_channel_data_dir(agent_id, channel_id).join("dedup.json")
}
