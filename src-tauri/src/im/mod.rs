// IM Bot integration module
// Manages IM channel lifecycle, routing messages to AI Sidecars.

pub mod adapter;
pub mod buffer;
pub mod health;
pub mod router;
pub mod telegram;
pub mod types;
mod util;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde_json::json;
use tauri::AppHandle;
use tokio::sync::{mpsc, watch, Mutex, Semaphore};
use tokio::task::JoinHandle;

use crate::sidecar::ManagedSidecarState;
use crate::{ulog_error, ulog_info, ulog_warn};

use adapter::{ImAdapter, ImStreamAdapter};
use buffer::MessageBuffer;
use health::HealthManager;
use router::{create_sidecar_stream_client, SessionRouter, GLOBAL_CONCURRENCY};
use telegram::TelegramAdapter;
use types::{
    ImBotStatusResponse, ImConfig, ImMessage, ImPlatform, ImStatus, RouteError,
};

// ===== Channel Instance =====

/// A running IM channel instance (one per Agent+Channel pair)
pub struct ChannelInstance {
    pub agent_id: String,
    pub channel_id: String,
    pub shutdown_tx: watch::Sender<bool>,
    pub health: Arc<HealthManager>,
    pub router: Arc<Mutex<SessionRouter>>,
    pub buffer: Arc<Mutex<MessageBuffer>>,
    pub started_at: Instant,
    pub listen_handle: JoinHandle<()>,
    pub processing_handle: JoinHandle<()>,
    pub idle_handle: JoinHandle<()>,
    pub health_handle: JoinHandle<()>,
    pub config: ImConfig,
    /// Shared mutable whitelist
    pub allowed_users: Arc<tokio::sync::RwLock<Vec<String>>>,
}

// ===== IM Manager =====

/// ImManager holds all running IM channel instances.
pub struct ImManager {
    channels: HashMap<String, ChannelInstance>,
    concurrency_semaphore: Arc<Semaphore>,
}

/// Canonical key for a channel instance: "{agent_id}:{channel_id}"
fn channel_key(agent_id: &str, channel_id: &str) -> String {
    format!("{}:{}", agent_id, channel_id)
}

/// Managed state type for IM Manager
pub type ImManagerState = Arc<Mutex<ImManager>>;

impl ImManager {
    pub fn new() -> Self {
        Self {
            channels: HashMap::new(),
            concurrency_semaphore: Arc::new(Semaphore::new(GLOBAL_CONCURRENCY)),
        }
    }

    /// Start a new IM channel.
    pub async fn start_channel(
        &mut self,
        app: AppHandle,
        sidecar_manager: ManagedSidecarState,
        config: ImConfig,
    ) -> Result<(), String> {
        let key = channel_key(&config.agent_id, &config.channel_id);

        // Stop existing channel if running
        if self.channels.contains_key(&key) {
            ulog_info!("[im] Channel {} already running, restarting...", key);
            self.stop_channel(&config.agent_id, &config.channel_id)
                .await?;
        }

        ulog_info!(
            "[im] Starting channel {} (platform={}, workspace={})",
            key,
            config.platform,
            config.workspace_path
        );

        // Initialize health manager
        let health_path =
            health::agent_channel_health_path(&config.agent_id, &config.channel_id);
        let health = Arc::new(HealthManager::new(health_path));
        health.set_status(ImStatus::Connecting).await;

        // Initialize message buffer
        let buffer_path =
            health::agent_channel_buffer_path(&config.agent_id, &config.channel_id);
        let buffer = Arc::new(Mutex::new(MessageBuffer::load_from_disk(&buffer_path)));

        // Initialize session router
        let default_workspace = std::path::PathBuf::from(&config.workspace_path);
        let mut router_inner =
            SessionRouter::new(default_workspace, config.agent_id.clone());

        // Restore peer sessions from previous run
        let prev_sessions = health.get_state().await.active_sessions;
        router_inner.restore_sessions(&prev_sessions);
        let router = Arc::new(Mutex::new(router_inner));

        // Shutdown channel
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        // Shared mutable whitelist
        let allowed_users =
            Arc::new(tokio::sync::RwLock::new(config.allowed_users.clone()));

        // Create mpsc channel for incoming messages
        let (msg_tx, msg_rx) = mpsc::channel::<ImMessage>(256);

        // Create platform adapter (Phase 1: Telegram only)
        let adapter: Arc<TelegramAdapter> = match config.platform {
            ImPlatform::Telegram => Arc::new(TelegramAdapter::new(
                &config,
                msg_tx.clone(),
                Arc::clone(&allowed_users),
            )),
            _ => {
                return Err(format!(
                    "Platform {:?} not yet supported",
                    config.platform
                ));
            }
        };

        // Verify bot connection
        match adapter.verify_connection().await {
            Ok(display_name) => {
                ulog_info!("[im] Bot verified: {}", display_name);
                let username = display_name
                    .strip_prefix('@')
                    .unwrap_or(&display_name)
                    .to_string();
                health.set_bot_username(username).await;
                health.set_status(ImStatus::Online).await;
            }
            Err(e) => {
                let err_msg = format!("Bot connection verification failed: {}", e);
                ulog_error!("[im] {}", err_msg);
                health.set_status(ImStatus::Error).await;
                health.set_error(err_msg.clone()).await;
                let _ = health.persist().await;
                return Err(err_msg);
            }
        }

        // Register bot commands
        if let Err(e) = adapter.register_commands().await {
            ulog_warn!("[im] Failed to register bot commands: {}", e);
        }

        // Start health persist loop
        let health_handle = Arc::clone(&health).start_persist_loop(shutdown_rx.clone());

        // Start listen loop (long-polling)
        let adapter_for_listen = Arc::clone(&adapter);
        let listen_shutdown_rx = shutdown_rx.clone();
        let listen_handle = tokio::spawn(async move {
            let _ = adapter_for_listen.listen_loop(listen_shutdown_rx).await;
        });

        // Start message processing loop
        let processing_handle = spawn_message_processing_loop(
            msg_rx,
            shutdown_rx.clone(),
            Arc::clone(&router),
            Arc::clone(&buffer),
            Arc::clone(&health),
            adapter.clone(),
            app.clone(),
            sidecar_manager.clone(),
            Arc::clone(&self.concurrency_semaphore),
            config.clone(),
        );

        // Start idle session collection loop
        let idle_handle = spawn_idle_collection_loop(
            shutdown_rx.clone(),
            Arc::clone(&router),
            sidecar_manager.clone(),
        );

        // Store channel instance
        self.channels.insert(
            key.clone(),
            ChannelInstance {
                agent_id: config.agent_id.clone(),
                channel_id: config.channel_id.clone(),
                shutdown_tx,
                health,
                router,
                buffer,
                started_at: Instant::now(),
                listen_handle,
                processing_handle,
                idle_handle,
                health_handle,
                config,
                allowed_users,
            },
        );

        ulog_info!("[im] Channel {} started successfully", key);
        Ok(())
    }

    /// Stop a running IM channel.
    pub async fn stop_channel(
        &mut self,
        agent_id: &str,
        channel_id: &str,
    ) -> Result<(), String> {
        let key = channel_key(agent_id, channel_id);
        let instance = match self.channels.remove(&key) {
            Some(inst) => inst,
            None => return Err(format!("Channel {} not found", key)),
        };

        ulog_info!("[im] Stopping channel {}...", key);

        // Signal shutdown
        let _ = instance.shutdown_tx.send(true);

        // Abort listen loop (cancel in-flight long-poll)
        instance.listen_handle.abort();

        // Wait for processing loop to finish gracefully (up to 10s)
        match tokio::time::timeout(Duration::from_secs(10), instance.processing_handle)
            .await
        {
            Ok(_) => ulog_info!("[im] Processing loop for {} exited gracefully", key),
            Err(_) => {
                ulog_warn!(
                    "[im] Processing loop for {} did not exit within 10s",
                    key
                )
            }
        }

        // Wait for idle loop
        instance.idle_handle.abort();
        let _ = tokio::time::timeout(Duration::from_secs(2), instance.idle_handle).await;

        // Wait for health loop
        let _ =
            tokio::time::timeout(Duration::from_secs(2), instance.health_handle).await;

        // Persist buffer
        if let Err(e) = instance.buffer.lock().await.save_to_disk() {
            ulog_warn!("[im] Failed to persist buffer on shutdown: {}", e);
        }

        // Persist active sessions in health state
        instance
            .health
            .set_active_sessions(instance.router.lock().await.get_active_sessions())
            .await;

        // Mark as stopped and persist
        instance.health.set_status(ImStatus::Stopped).await;
        let _ = instance.health.persist().await;

        ulog_info!("[im] Channel {} stopped", key);
        Ok(())
    }

    /// Stop all running channels (for app exit).
    pub async fn stop_all(&mut self) {
        let keys: Vec<String> = self.channels.keys().cloned().collect();
        for key in keys {
            if let Some(instance) = self.channels.remove(&key) {
                ulog_info!("[im] Shutting down channel {}", key);
                let _ = instance.shutdown_tx.send(true);
                instance.listen_handle.abort();
                instance.processing_handle.abort();
                instance.idle_handle.abort();
                instance.health_handle.abort();
            }
        }
    }

    /// Get status for a specific channel.
    pub async fn channel_status(
        &self,
        agent_id: &str,
        channel_id: &str,
    ) -> Result<ImBotStatusResponse, String> {
        let key = channel_key(agent_id, channel_id);
        let instance = self
            .channels
            .get(&key)
            .ok_or_else(|| format!("Channel {} not found", key))?;

        let health_state = instance.health.get_state().await;
        let active_sessions = instance.router.lock().await.get_active_sessions();
        let buffered = instance.buffer.lock().await.len();
        let uptime = instance.started_at.elapsed().as_secs();

        Ok(ImBotStatusResponse {
            bot_username: health_state.bot_username,
            status: health_state.status,
            uptime_seconds: uptime,
            active_sessions,
            error_message: health_state.error_message,
            restart_count: health_state.restart_count,
            buffered_messages: buffered,
        })
    }

    /// Get status for all running channels.
    pub async fn all_channels_status(
        &self,
    ) -> HashMap<String, ImBotStatusResponse> {
        let mut result = HashMap::new();
        for (key, instance) in &self.channels {
            let health_state = instance.health.get_state().await;
            let active_sessions = instance.router.lock().await.get_active_sessions();
            let buffered = instance.buffer.lock().await.len();
            let uptime = instance.started_at.elapsed().as_secs();

            result.insert(
                key.clone(),
                ImBotStatusResponse {
                    bot_username: health_state.bot_username,
                    status: health_state.status,
                    uptime_seconds: uptime,
                    active_sessions,
                    error_message: health_state.error_message,
                    restart_count: health_state.restart_count,
                    buffered_messages: buffered,
                },
            );
        }
        result
    }

    /// Update allowed users for a running channel.
    pub async fn update_channel_config(
        &mut self,
        agent_id: &str,
        channel_id: &str,
        config_json: &str,
    ) -> Result<(), String> {
        let key = channel_key(agent_id, channel_id);
        let instance = self
            .channels
            .get_mut(&key)
            .ok_or_else(|| format!("Channel {} not found", key))?;

        // Parse partial config update
        let patch: serde_json::Value = serde_json::from_str(config_json)
            .map_err(|e| format!("Invalid config JSON: {}", e))?;

        // Update allowed users if present
        if let Some(users) = patch.get("allowedUsers") {
            if let Some(arr) = users.as_array() {
                let new_users: Vec<String> = arr
                    .iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect();
                *instance.allowed_users.write().await = new_users;
                ulog_info!("[im] Updated allowed users for channel {}", key);
            }
        }

        Ok(())
    }

    /// Reset a session for a specific channel (e.g., /new command).
    pub async fn reset_session(
        &self,
        agent_id: &str,
        channel_id: &str,
        session_key: &str,
    ) -> Result<(), String> {
        let key = channel_key(agent_id, channel_id);
        let instance = self
            .channels
            .get(&key)
            .ok_or_else(|| format!("Channel {} not found", key))?;

        let mut router = instance.router.lock().await;
        router.reset_session(session_key).await;
        ulog_info!(
            "[im] Reset session {} for channel {}",
            session_key,
            key
        );
        Ok(())
    }
}

/// Signal all running channels to shut down (sync, for use in app exit handlers).
/// Best-effort: uses try_lock to avoid blocking if mutex is held.
pub fn signal_all_shutdown(im_state: &ImManagerState) {
    if let Ok(manager) = im_state.try_lock() {
        for (key, instance) in manager.channels.iter() {
            log::info!("[im] Signaling shutdown for channel {}", key);
            let _ = instance.shutdown_tx.send(true);
            instance.listen_handle.abort();
            instance.processing_handle.abort();
            instance.idle_handle.abort();
            instance.health_handle.abort();
        }
    } else {
        log::warn!(
            "[im] Could not acquire lock for shutdown signal, IM channels may linger"
        );
    }
}

// ===== Message Processing Loop =====

/// Spawn the message processing loop as a tokio task.
fn spawn_message_processing_loop(
    mut msg_rx: mpsc::Receiver<ImMessage>,
    mut shutdown_rx: watch::Receiver<bool>,
    router: Arc<Mutex<SessionRouter>>,
    buffer: Arc<Mutex<MessageBuffer>>,
    health: Arc<HealthManager>,
    adapter: Arc<TelegramAdapter>,
    app: AppHandle,
    sidecar_manager: ManagedSidecarState,
    semaphore: Arc<Semaphore>,
    config: ImConfig,
) -> JoinHandle<()> {
    let stream_client = create_sidecar_stream_client();
    let provider_env: Option<serde_json::Value> = config
        .provider_env_json
        .as_ref()
        .and_then(|json_str| serde_json::from_str(json_str).ok());

    tokio::spawn(async move {
        ulog_info!("[im] Message processing loop started");

        loop {
            let msg = tokio::select! {
                Some(msg) = msg_rx.recv() => msg,
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        ulog_info!("[im] Processing loop shutdown signal received");
                        break;
                    }
                    continue;
                }
            };

            let session_key = {
                let r = router.lock().await;
                r.session_key(&msg)
            };

            let chat_id = msg.chat_id.clone();
            let message_id = msg.message_id.clone();
            let text = msg.text.trim().to_string();

            // ── Bot command dispatch ──

            // /new — reset session
            if text == "/new" {
                let _ = adapter.ack_processing(&chat_id, &message_id).await;
                let result = router.lock().await.reset_session(&session_key).await;
                let _ = adapter.ack_clear(&chat_id, &message_id).await;
                match result {
                    Some(new_id) => {
                        let reply = format!(
                            "New conversation started ({})",
                            &new_id[..8.min(new_id.len())]
                        );
                        let _ = adapter.send_message(&chat_id, &reply).await;
                    }
                    None => {
                        let _ = adapter
                            .send_message(&chat_id, "Failed to reset session")
                            .await;
                    }
                }
                continue;
            }

            // /start — welcome message
            if text == "/start" {
                let _ = adapter
                    .send_message(
                        &chat_id,
                        "Hello! I'm a SoAgents Bot.\n\n\
                         Commands:\n\
                         /new - Start a new conversation\n\
                         /start - Show this message\n\n\
                         Send a message to start chatting.",
                    )
                    .await;
                continue;
            }

            // ── Regular message → process via Sidecar ──

            ulog_info!(
                "[im] Routing message from {} to Sidecar (session_key={}, {} chars)",
                msg.sender_name.as_deref().unwrap_or("?"),
                session_key,
                text.len(),
            );

            // Clone shared state for the processing task
            let task_router = Arc::clone(&router);
            let task_adapter = Arc::clone(&adapter);
            let task_app = app.clone();
            let task_manager = Arc::clone(&sidecar_manager);
            let task_buffer = Arc::clone(&buffer);
            let task_health = Arc::clone(&health);
            let task_sem = Arc::clone(&semaphore);
            let task_stream_client = stream_client.clone();
            let task_config = config.clone();
            let task_provider_env = provider_env.clone();

            // Spawn concurrent task for this message
            tokio::spawn(async move {
                // 1. Acquire global semaphore
                let _permit = match task_sem.acquire_owned().await {
                    Ok(p) => p,
                    Err(_) => {
                        ulog_error!("[im] Semaphore closed");
                        return;
                    }
                };

                // 2. ACK + typing
                let _ = task_adapter.ack_processing(&chat_id, &message_id).await;
                let _ = task_adapter.send_typing(&chat_id).await;

                // 3. Ensure Sidecar is running
                let (port, is_new_sidecar) = match task_router
                    .lock()
                    .await
                    .ensure_sidecar(
                        &session_key,
                        &task_app,
                        &task_manager,
                        &task_config,
                    )
                    .await
                {
                    Ok(result) => result,
                    Err(e) => {
                        let _ =
                            task_adapter.ack_clear(&chat_id, &message_id).await;
                        let err_msg = format!("Failed to start Sidecar: {}", e);
                        ulog_error!("[im] {}", err_msg);

                        // Buffer on unavailable
                        if matches!(e, RouteError::Unavailable(_)) {
                            task_buffer.lock().await.push(&msg);
                        }

                        let _ = task_adapter
                            .send_message(&chat_id, &format!("Error: {}", err_msg))
                            .await;
                        return;
                    }
                };

                // 4. Sync AI config to newly created Sidecar
                if is_new_sidecar {
                    let router_guard = task_router.lock().await;
                    router_guard
                        .sync_ai_config(
                            port,
                            task_config.model.as_deref(),
                            task_config.mcp_servers_json.as_deref(),
                            task_provider_env.as_ref(),
                        )
                        .await;
                    router_guard
                        .sync_permission_mode(port, &task_config.permission_mode)
                        .await;
                }

                // 5. POST to Sidecar and stream SSE response
                // Build request body
                let mut body = json!({
                    "message": text,
                    "agentDir": task_config.workspace_path,
                    "permissionMode": task_config.permission_mode,
                });
                if let Some(ref model) = task_config.model {
                    body["model"] = json!(model);
                }
                if let Some(ref penv) = task_provider_env {
                    body["providerEnv"] = penv.clone();
                }

                let url = format!("http://127.0.0.1:{}/api/im/chat", port);
                ulog_info!("[im-stream] POST {} (SSE)", url);

                let response = match task_stream_client
                    .post(&url)
                    .json(&body)
                    .send()
                    .await
                {
                    Ok(resp) => resp,
                    Err(e) => {
                        ulog_error!("[im] SSE request failed: {}", e);
                        let _ =
                            task_adapter.ack_clear(&chat_id, &message_id).await;
                        task_buffer.lock().await.push(&msg);
                        let _ = task_adapter
                            .send_message(
                                &chat_id,
                                &format!("Connection error: {}", e),
                            )
                            .await;
                        return;
                    }
                };

                if !response.status().is_success() {
                    let status = response.status().as_u16();
                    let error_text =
                        response.text().await.unwrap_or_default();
                    ulog_error!(
                        "[im] Sidecar returned {}: {}",
                        status,
                        error_text
                    );
                    let _ =
                        task_adapter.ack_clear(&chat_id, &message_id).await;
                    let _ = task_adapter
                        .send_message(
                            &chat_id,
                            &format!("Sidecar error ({}): {}", status, error_text),
                        )
                        .await;
                    return;
                }

                // 6. Consume SSE stream
                let stream_result = consume_sse_stream(
                    response,
                    task_adapter.as_ref(),
                    &chat_id,
                )
                .await;

                match stream_result {
                    Ok(_) => {
                        ulog_info!(
                            "[im] Stream complete for {}",
                            session_key,
                        );
                    }
                    Err(e) => {
                        ulog_error!(
                            "[im] Stream error for {}: {}",
                            session_key,
                            e
                        );
                        let _ = task_adapter
                            .send_message(
                                &chat_id,
                                &format!("Error: {}", e),
                            )
                            .await;
                    }
                }

                // 7. Clear ACK
                let _ =
                    task_adapter.ack_clear(&chat_id, &message_id).await;

                // 8. Record response
                task_router.lock().await.record_response(&session_key);

                // 9. Update health
                task_health
                    .set_last_message_at(chrono::Utc::now().to_rfc3339())
                    .await;
                task_health
                    .set_active_sessions(
                        task_router.lock().await.get_active_sessions(),
                    )
                    .await;
                task_health
                    .set_buffered_messages(task_buffer.lock().await.len())
                    .await;
            });
        }

        ulog_info!("[im] Message processing loop exited");
    })
}

// ===== SSE Stream Consumption =====

/// Consume SSE stream from Sidecar and relay AI response to IM.
/// Uses draft-based streaming: sends initial message, then edits with updates.
async fn consume_sse_stream(
    response: reqwest::Response,
    adapter: &TelegramAdapter,
    chat_id: &str,
) -> Result<(), String> {
    let mut byte_stream = response.bytes_stream();
    let mut sse_buffer = String::new();

    // Current text block state
    let mut block_text = String::new();
    let mut draft_id: Option<String> = None;
    let mut last_edit = Instant::now();
    let mut any_text_sent = false;

    // Placeholder state
    let mut placeholder_id: Option<String> = None;
    let mut first_content_sent = false;

    while let Some(chunk_result) = byte_stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("SSE stream error: {}", e))?;
        sse_buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = sse_buffer.find("\n\n") {
            let event_str: String = sse_buffer.drain(..pos).collect();
            sse_buffer.drain(..2); // consume "\n\n"

            // Skip heartbeat comments
            if event_str.starts_with(':') {
                continue;
            }

            let data = extract_sse_data(&event_str);
            if data.is_empty() {
                continue;
            }

            let json_val: serde_json::Value = match serde_json::from_str(&data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            match json_val["type"].as_str().unwrap_or("") {
                "partial" => {
                    if let Some(text) = json_val["text"].as_str() {
                        block_text = text.to_string();

                        // First meaningful text: create draft
                        if draft_id.is_none()
                            && !block_text.trim().is_empty()
                            && has_sentence_boundary(&block_text)
                        {
                            if let Some(pid) = placeholder_id.take() {
                                // Adopt placeholder as draft
                                draft_id = Some(pid);
                                let display = format_draft_text(
                                    &block_text,
                                    adapter.max_message_length(),
                                );
                                let _ = adapter
                                    .edit_message(
                                        chat_id,
                                        draft_id.as_ref().unwrap(),
                                        &display,
                                    )
                                    .await;
                                last_edit = Instant::now();
                            } else {
                                let display = format_draft_text(
                                    &block_text,
                                    adapter.max_message_length(),
                                );
                                match adapter
                                    .send_message_returning_id(chat_id, &display)
                                    .await
                                {
                                    Ok(Some(id)) => {
                                        draft_id = Some(id);
                                        last_edit = Instant::now();
                                    }
                                    _ => {}
                                }
                            }
                            first_content_sent = true;
                        }

                        // Throttled edit
                        if let Some(ref did) = draft_id {
                            let throttle = Duration::from_millis(
                                adapter.preferred_throttle_ms(),
                            );
                            if last_edit.elapsed() >= throttle {
                                last_edit = Instant::now();
                                let display = format_draft_text(
                                    &block_text,
                                    adapter.max_message_length(),
                                );
                                let _ = adapter
                                    .edit_message(chat_id, did, &display)
                                    .await;
                            }
                        }
                    }
                }
                "activity" => {
                    // Non-text block started (thinking, tool_use)
                    if !first_content_sent {
                        match adapter
                            .send_message_returning_id(chat_id, "Generating...")
                            .await
                        {
                            Ok(Some(id)) => {
                                placeholder_id = Some(id);
                            }
                            _ => {}
                        }
                        first_content_sent = true;
                    }
                }
                "block-end" => {
                    let final_text = json_val["text"]
                        .as_str()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| block_text.clone());

                    if final_text.trim().is_empty() {
                        // Delete orphaned draft
                        if let Some(ref did) = draft_id {
                            let _ = adapter.delete_message(chat_id, did).await;
                        }
                    } else {
                        finalize_block(adapter, chat_id, draft_id.clone(), &final_text)
                            .await;
                        any_text_sent = true;
                    }
                    block_text.clear();
                    draft_id = None;
                }
                "complete" => {
                    // Flush any remaining text
                    if !block_text.trim().is_empty() {
                        finalize_block(
                            adapter,
                            chat_id,
                            draft_id.clone(),
                            &block_text,
                        )
                        .await;
                        any_text_sent = true;
                    } else if let Some(ref did) = draft_id {
                        let _ = adapter.delete_message(chat_id, did).await;
                    }

                    if !any_text_sent {
                        if let Some(ref pid) = placeholder_id {
                            if adapter
                                .edit_message(chat_id, pid, "(No response)")
                                .await
                                .is_err()
                            {
                                let _ =
                                    adapter.delete_message(chat_id, pid).await;
                                let _ = adapter
                                    .send_message(chat_id, "(No response)")
                                    .await;
                            }
                        } else {
                            let _ = adapter
                                .send_message(chat_id, "(No response)")
                                .await;
                        }
                    }
                    return Ok(());
                }
                "error" => {
                    let error =
                        json_val["error"].as_str().unwrap_or("Unknown error");
                    // Clean up draft and placeholder
                    if let Some(ref did) = draft_id {
                        let _ = adapter.delete_message(chat_id, did).await;
                    }
                    if let Some(ref pid) = placeholder_id {
                        let _ = adapter.delete_message(chat_id, pid).await;
                    }
                    return Err(error.to_string());
                }
                _ => {} // Ignore unknown types
            }
        }
    }

    // Stream disconnected unexpectedly — flush remaining text
    if !block_text.trim().is_empty() {
        finalize_block(adapter, chat_id, draft_id.clone(), &block_text).await;
        any_text_sent = true;
    } else if let Some(ref did) = draft_id {
        let _ = adapter.delete_message(chat_id, did).await;
    }

    if !any_text_sent {
        if let Some(ref pid) = placeholder_id {
            if adapter
                .edit_message(chat_id, pid, "(No response)")
                .await
                .is_err()
            {
                let _ = adapter.delete_message(chat_id, pid).await;
                let _ = adapter.send_message(chat_id, "(No response)").await;
            }
        } else {
            let _ = adapter.send_message(chat_id, "(No response)").await;
        }
    }

    Ok(())
}

// ===== SSE Helper Functions =====

/// Extract data payload from SSE event string.
fn extract_sse_data(event_str: &str) -> String {
    event_str
        .lines()
        .filter(|line| line.starts_with("data:"))
        .map(|line| {
            line.strip_prefix("data: ")
                .or_else(|| line.strip_prefix("data:"))
                .unwrap_or("")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Finalize a text block: edit draft with final text or send new message.
async fn finalize_block(
    adapter: &TelegramAdapter,
    chat_id: &str,
    draft_id: Option<String>,
    text: &str,
) {
    if text.is_empty() {
        return;
    }

    let is_draft = draft_id
        .as_ref()
        .map_or(false, |id| id.starts_with("draft:"));
    if is_draft {
        // Draft mode: delete draft + send permanent message
        if let Some(ref did) = draft_id {
            let _ = adapter.delete_message(chat_id, did).await;
        }
        let _ = adapter.send_message(chat_id, text).await;
    } else if let Some(ref mid) = draft_id {
        // Standard mode: edit the message with final text using finalize_message
        if let Err(e) = adapter.edit_message(chat_id, mid, text).await {
            ulog_warn!("[im-stream] finalize edit failed: {}, sending new message", e);
            let _ = adapter.send_message(chat_id, text).await;
        }
    } else {
        // No draft — send new message
        let _ = adapter.send_message(chat_id, text).await;
    }
}

/// Format text for draft display (truncate if too long).
fn format_draft_text(text: &str, max_len: usize) -> String {
    let limit = max_len.saturating_sub(10);
    if text.len() > limit {
        let mut truncate_at = limit.min(text.len());
        while !text.is_char_boundary(truncate_at) && truncate_at > 0 {
            truncate_at -= 1;
        }
        format!("{}...", &text[..truncate_at])
    } else {
        text.to_string()
    }
}

/// Check if text has enough content for a meaningful first send.
fn has_sentence_boundary(text: &str) -> bool {
    const MIN_FIRST_SEND_LEN: usize = 20;
    if text.chars().count() >= MIN_FIRST_SEND_LEN {
        return true;
    }
    let trimmed = text.trim_end();
    trimmed.ends_with('\n')
        || trimmed.ends_with('.')
        || trimmed.ends_with('!')
        || trimmed.ends_with('?')
        || trimmed.ends_with(',')
        || trimmed.ends_with(';')
        || trimmed.ends_with(':')
}

// ===== Idle Session Collection Loop =====

/// Periodically collect idle sessions (30-min timeout).
fn spawn_idle_collection_loop(
    mut shutdown_rx: watch::Receiver<bool>,
    router: Arc<Mutex<SessionRouter>>,
    sidecar_manager: ManagedSidecarState,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(60)) => {}
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        ulog_info!("[im] Idle collection loop shutting down");
                        break;
                    }
                    continue;
                }
            }

            let collected = router.lock().await.collect_idle_sessions(&sidecar_manager);
            if !collected.is_empty() {
                ulog_info!(
                    "[im] Collected {} idle session(s): {:?}",
                    collected.len(),
                    collected
                );
            }
        }
    })
}

// ===== Tauri Commands =====

#[tauri::command]
pub async fn cmd_start_agent_channel(
    app: AppHandle,
    im_state: tauri::State<'_, ImManagerState>,
    sidecar_state: tauri::State<'_, crate::commands::SidecarState>,
    config_json: String,
) -> Result<(), String> {
    let config: ImConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("Invalid config JSON: {}", e))?;

    let sidecar_manager = (*sidecar_state).clone();
    let mut manager = im_state.lock().await;
    manager
        .start_channel(app, sidecar_manager, config)
        .await
}

#[tauri::command]
pub async fn cmd_stop_agent_channel(
    im_state: tauri::State<'_, ImManagerState>,
    agent_id: String,
    channel_id: String,
) -> Result<(), String> {
    let mut manager = im_state.lock().await;
    manager.stop_channel(&agent_id, &channel_id).await
}

#[tauri::command]
pub async fn cmd_agent_channel_status(
    im_state: tauri::State<'_, ImManagerState>,
    agent_id: String,
    channel_id: String,
) -> Result<types::ImBotStatusResponse, String> {
    let manager = im_state.lock().await;
    manager.channel_status(&agent_id, &channel_id).await
}

#[tauri::command]
pub async fn cmd_all_agent_channels_status(
    im_state: tauri::State<'_, ImManagerState>,
) -> Result<HashMap<String, types::ImBotStatusResponse>, String> {
    let manager = im_state.lock().await;
    Ok(manager.all_channels_status().await)
}

#[tauri::command]
pub async fn cmd_update_agent_channel_config(
    im_state: tauri::State<'_, ImManagerState>,
    agent_id: String,
    channel_id: String,
    config_json: String,
) -> Result<(), String> {
    let mut manager = im_state.lock().await;
    manager
        .update_channel_config(&agent_id, &channel_id, &config_json)
        .await
}

#[tauri::command]
pub async fn cmd_im_reset_session(
    im_state: tauri::State<'_, ImManagerState>,
    agent_id: String,
    channel_id: String,
    session_key: String,
) -> Result<(), String> {
    let manager = im_state.lock().await;
    manager
        .reset_session(&agent_id, &channel_id, &session_key)
        .await
}

#[tauri::command]
pub async fn cmd_im_verify_token(
    platform: String,
    token: String,
    proxy_url: Option<String>,
) -> Result<String, String> {
    match platform.as_str() {
        "telegram" => {
            // Build a temporary client to verify the token
            let mut builder = reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .connect_timeout(Duration::from_secs(5));

            if let Some(ref url) = proxy_url {
                let proxy = reqwest::Proxy::all(url)
                    .map_err(|e| format!("Invalid proxy URL: {}", e))?;
                builder = builder.proxy(proxy);
            }

            let client = builder
                .build()
                .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

            let url = format!("https://api.telegram.org/bot{}/getMe", token);
            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Connection failed: {}", e))?;

            let body: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("Invalid response: {}", e))?;

            if body["ok"].as_bool() == Some(true) {
                let username = body["result"]["username"]
                    .as_str()
                    .unwrap_or("unknown");
                Ok(format!("@{}", username))
            } else {
                let desc = body["description"]
                    .as_str()
                    .unwrap_or("Unknown error");
                Err(format!("Token verification failed: {}", desc))
            }
        }
        _ => Err(format!("Unsupported platform: {}", platform)),
    }
}

// ===== Auto-Start on App Boot =====

/// Read agent configs from ~/.soagents/config.json
fn read_agent_configs_from_disk() -> Vec<types::AgentConfigRust> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Vec::new(),
    };
    let config_path = home.join(".soagents").join("config.json");
    let content = match std::fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    match serde_json::from_value::<Vec<types::AgentConfigRust>>(
        json["agents"].clone(),
    ) {
        Ok(agents) => agents,
        Err(e) => {
            log::warn!("[im] Failed to parse agents from config: {}", e);
            Vec::new()
        }
    }
}

/// Schedule auto-start of enabled agent channels after app initialization.
/// Delayed by 4 seconds to let Sidecar manager and other services initialize first.
pub fn schedule_agent_auto_start(
    app_handle: tauri::AppHandle,
) {
    use tauri::Manager;
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(4)).await;

        let agents = read_agent_configs_from_disk();
        if agents.is_empty() {
            return;
        }

        let im_state: ImManagerState = (*app_handle.state::<ImManagerState>()).clone();
        let sidecar_state: ManagedSidecarState =
            (*app_handle.state::<crate::commands::SidecarState>()).clone();

        for agent in &agents {
            if !agent.enabled {
                continue;
            }
            for channel in &agent.channels {
                if !channel.enabled {
                    continue;
                }
                // Check credentials
                let has_credentials = match channel.channel_type {
                    types::ImPlatform::Telegram => {
                        channel.bot_token.as_ref().map_or(false, |t| !t.is_empty())
                    }
                    _ => false, // Phase 1: only Telegram
                };
                if !has_credentials {
                    continue;
                }

                let key = channel_key(&agent.id, &channel.id);

                // Skip if already running
                {
                    let manager = im_state.lock().await;
                    if manager.channels.contains_key(&key) {
                        continue;
                    }
                }

                let config = channel.to_im_config(agent);
                ulog_info!(
                    "[im] Auto-starting channel {} (agent={}, platform={})",
                    key,
                    agent.name,
                    channel.channel_type
                );

                let sidecar_manager = sidecar_state.clone();
                let mut manager: tokio::sync::MutexGuard<'_, ImManager> = im_state.lock().await;
                if let Err(e) = manager
                    .start_channel(app_handle.clone(), sidecar_manager, config)
                    .await
                {
                    ulog_error!(
                        "[im] Auto-start failed for channel {}: {}",
                        key,
                        e
                    );
                }
            }
        }
    });
}
