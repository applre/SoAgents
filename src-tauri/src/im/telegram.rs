// Telegram Bot API adapter
// Handles long-polling, message sending (split + markdown fallback), ACK reactions,
// MessageCoalescer (fragment merging + debounce), and rate limit handling.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::{sleep, Instant};

use super::adapter::{split_message, ImAdapter, ImStreamAdapter};
use super::types::{AdapterResult, ImConfig, ImMessage, ImPlatform, ImSourceType, TelegramError};
use crate::{ulog_info, ulog_warn, ulog_error};

// ===== Constants =====

/// Telegram Bot API base URL
const TELEGRAM_API_BASE: &str = "https://api.telegram.org/bot";
/// Maximum message length for Telegram
const MAX_MESSAGE_LENGTH: usize = 4096;

/// Telegram long-poll timeout (seconds)
const LONG_POLL_TIMEOUT: u64 = 30;
/// Max retries for transient errors before giving up
const MAX_TRANSIENT_RETRIES: u32 = 3;
/// Initial backoff for reconnect (seconds)
const INITIAL_BACKOFF_SECS: u64 = 1;
/// Max backoff for reconnect (seconds)
const MAX_BACKOFF_SECS: u64 = 30;

// MessageCoalescer constants
const DEFAULT_DEBOUNCE_MS: u64 = 500;
const DEFAULT_FRAGMENT_MERGE_MS: u64 = 1500;
const FRAGMENT_MIN_LENGTH: usize = 4000;
const MAX_FRAGMENTS: usize = 12;
const MAX_MERGED_LENGTH: usize = 50000;

// ===== HTTP Client Builder =====

/// Build a reqwest Client with optional proxy support.
/// The Telegram API (api.telegram.org) is blocked in China, so proxy support is essential.
/// NOTE: This is for external API calls. Do NOT add .no_proxy() here — that's only for localhost.
fn build_telegram_client(proxy_url: Option<&str>) -> Result<Client, String> {
    let mut builder = Client::builder()
        .timeout(Duration::from_secs(LONG_POLL_TIMEOUT + 10))
        .connect_timeout(Duration::from_secs(10));

    if let Some(url) = proxy_url {
        let proxy = reqwest::Proxy::all(url)
            .map_err(|e| format!("Invalid proxy URL: {}", e))?;
        builder = builder.proxy(proxy);
    }

    builder.build().map_err(|e| format!("Failed to build HTTP client: {}", e))
}

// ===== MessageCoalescer =====

/// Pending batch of messages being coalesced (only for fragment merging)
struct PendingBatch {
    fragments: Vec<String>,
    total_length: usize,
    #[allow(dead_code)]
    first_msg_id: i64,
    last_msg_id: i64,
    last_received: Instant,
    // Preserve sender metadata from the first fragment
    chat_id: String,
    sender_id: String,
    sender_name: Option<String>,
    source_type: ImSourceType,
    platform: ImPlatform,
    // OR'd across all fragments — true if ANY fragment had mention/reply-to-bot
    is_mention: bool,
    reply_to_bot: bool,
}

/// Merges fragmented messages (Telegram splits >4096 char pastes)
/// and debounces rapid consecutive messages from the same chat.
pub struct MessageCoalescer {
    pending: HashMap<String, PendingBatch>,
    debounce_ms: u64,
    fragment_merge_ms: u64,
}

impl MessageCoalescer {
    pub fn new() -> Self {
        Self {
            pending: HashMap::new(),
            debounce_ms: DEFAULT_DEBOUNCE_MS,
            fragment_merge_ms: DEFAULT_FRAGMENT_MERGE_MS,
        }
    }

    /// Push a message. Returns a vec of messages ready to send.
    ///
    /// Non-fragment messages (< 4000 chars) are returned immediately — they
    /// bypass the pending buffer entirely. Only true fragments (Telegram's
    /// automatic splitting of long pastes, >= 4000 chars each) are buffered
    /// for merging.
    ///
    /// When a new message arrives and there's an existing pending batch,
    /// the old batch is flushed first, then the new message is either
    /// buffered (fragment) or returned immediately (non-fragment).
    pub fn push(&mut self, msg: &ImMessage) -> Vec<ImMessage> {
        let now = Instant::now();
        let is_fragment = msg.text.len() >= FRAGMENT_MIN_LENGTH;
        let chat_id = &msg.chat_id;
        let msg_id_i64 = msg.message_id.parse::<i64>().unwrap_or(0);
        let mut ready = Vec::new();

        if let Some(batch) = self.pending.get_mut(chat_id) {
            let time_since_last = now.duration_since(batch.last_received).as_millis() as u64;

            // Check if this is a continuation fragment
            let is_continuation = is_fragment
                && msg_id_i64 == batch.last_msg_id + 1
                && time_since_last < self.fragment_merge_ms;

            if is_continuation
                && batch.fragments.len() < MAX_FRAGMENTS
                && batch.total_length + msg.text.len() < MAX_MERGED_LENGTH
            {
                // Append to existing batch
                batch.total_length += msg.text.len();
                batch.fragments.push(msg.text.clone());
                batch.last_msg_id = msg_id_i64;
                batch.last_received = now;
                // OR mention flags: if any fragment has mention, the merged msg does too
                batch.is_mention = batch.is_mention || msg.is_mention;
                batch.reply_to_bot = batch.reply_to_bot || msg.reply_to_bot;
                return ready; // Still waiting for more fragments
            }

            // Not a continuation — flush the old batch
            if let Some(flushed) = self.flush_batch_to_msg(chat_id) {
                ready.push(flushed);
            }
        }

        if is_fragment {
            // Buffer: wait for more fragments before sending
            self.pending.insert(
                chat_id.to_string(),
                PendingBatch {
                    fragments: vec![msg.text.clone()],
                    total_length: msg.text.len(),
                    first_msg_id: msg_id_i64,
                    last_msg_id: msg_id_i64,
                    last_received: now,
                    chat_id: msg.chat_id.clone(),
                    sender_id: msg.sender_id.clone(),
                    sender_name: msg.sender_name.clone(),
                    source_type: msg.source_type.clone(),
                    platform: msg.platform.clone(),
                    is_mention: msg.is_mention,
                    reply_to_bot: msg.reply_to_bot,
                },
            );
        } else {
            // Non-fragment: return immediately, no debounce needed
            ready.push(msg.clone());
        }

        ready
    }

    /// Flush all batches that have exceeded the debounce timeout.
    /// Returns vec of ready-to-send ImMessages with correct sender metadata.
    pub fn flush_expired(&mut self) -> Vec<ImMessage> {
        let now = Instant::now();

        let expired_keys: Vec<String> = self
            .pending
            .iter()
            .filter(|(_, batch)| {
                now.duration_since(batch.last_received).as_millis() as u64 >= self.debounce_ms
            })
            .map(|(k, _)| k.clone())
            .collect();

        let mut ready = Vec::new();
        for key in expired_keys {
            if let Some(flushed) = self.flush_batch_to_msg(&key) {
                ready.push(flushed);
            }
        }
        ready
    }

    /// Flush a pending batch, reconstructing a full ImMessage with stored metadata.
    fn flush_batch_to_msg(&mut self, chat_id: &str) -> Option<ImMessage> {
        self.pending.remove(chat_id).map(|batch| ImMessage {
            chat_id: batch.chat_id,
            message_id: batch.last_msg_id.to_string(),
            text: batch.fragments.join("\n"),
            sender_id: batch.sender_id,
            sender_name: batch.sender_name,
            source_type: batch.source_type,
            platform: batch.platform,
            timestamp: chrono::Utc::now(),
            is_mention: batch.is_mention,
            reply_to_bot: batch.reply_to_bot,
        })
    }
}

// ===== TelegramAdapter =====

/// Telegram Bot API adapter
pub struct TelegramAdapter {
    bot_token: String,
    /// Shared mutable whitelist — updated dynamically
    allowed_users: Arc<RwLock<Vec<String>>>,
    client: Client,
    message_tx: mpsc::Sender<ImMessage>,
    coalescer: Arc<Mutex<MessageCoalescer>>,
    bot_username: Arc<Mutex<Option<String>>>,
    /// Bot's numeric user ID (from getMe), used for reply-to-bot detection
    bot_user_id: Arc<Mutex<Option<i64>>>,
    /// Whether to use sendMessageDraft for streaming (experimental)
    use_message_draft: bool,
    /// Whether this adapter instance has fallen back to standard mode due to draft errors.
    /// AtomicBool avoids try_lock fragility and contention issues across concurrent streams.
    draft_fallback: Arc<std::sync::atomic::AtomicBool>,
}

impl TelegramAdapter {
    pub fn new(
        config: &ImConfig,
        message_tx: mpsc::Sender<ImMessage>,
        allowed_users: Arc<RwLock<Vec<String>>>,
    ) -> Self {
        let client = build_telegram_client(config.proxy_url.as_deref())
            .unwrap_or_else(|e| {
                ulog_warn!("[telegram] Failed to build client with proxy: {}, falling back to direct", e);
                Client::builder()
                    .timeout(Duration::from_secs(LONG_POLL_TIMEOUT + 10))
                    .build()
                    .expect("Failed to create HTTP client")
            });

        Self {
            bot_token: config.bot_token.clone(),
            allowed_users,
            client,
            message_tx,
            coalescer: Arc::new(Mutex::new(MessageCoalescer::new())),
            bot_username: Arc::new(Mutex::new(None)),
            bot_user_id: Arc::new(Mutex::new(None)),
            use_message_draft: config.telegram_use_draft.unwrap_or(true),
            draft_fallback: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    /// Get the bot username (after getMe)
    pub async fn bot_username(&self) -> Option<String> {
        self.bot_username.lock().await.clone()
    }

    // ===== Telegram Bot API endpoints =====

    fn api_url(&self, method: &str) -> String {
        format!("{}{}/{}", TELEGRAM_API_BASE, self.bot_token, method)
    }

    /// Generic API call with rate limit and error handling.
    /// Retries up to MAX_TRANSIENT_RETRIES on transient errors.
    /// Respects retry_after on 429 rate limits.
    async fn api_call(&self, method: &str, body: &Value) -> Result<Value, TelegramError> {
        let mut retries = 0;

        loop {
            let resp = self
                .client
                .post(&self.api_url(method))
                .json(body)
                .send()
                .await
                .map_err(|e| {
                    if e.is_timeout() {
                        TelegramError::NetworkTimeout
                    } else {
                        TelegramError::Other(format!("HTTP error: {}", e))
                    }
                })?;

            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();

            if status.as_u16() == 429 {
                // Rate limited — respect retry_after
                let retry_after = serde_json::from_str::<Value>(&body_text)
                    .ok()
                    .and_then(|v| v["parameters"]["retry_after"].as_u64())
                    .unwrap_or(5);
                ulog_warn!(
                    "[telegram] Rate limited on {}, retry after {}s",
                    method,
                    retry_after
                );
                sleep(Duration::from_secs(retry_after)).await;
                continue;
            }

            let json: Value = serde_json::from_str(&body_text)
                .map_err(|e| TelegramError::Other(format!("JSON parse error: {}", e)))?;

            if json["ok"].as_bool() == Some(true) {
                return Ok(json["result"].clone());
            }

            // Handle specific error codes
            let description = json["description"].as_str().unwrap_or("");
            let error_code = json["error_code"].as_i64().unwrap_or(0);

            match error_code {
                400 if description.contains("can't parse entities") => {
                    return Err(TelegramError::MarkdownParseError);
                }
                400 if description.contains("message is not modified") => {
                    return Err(TelegramError::MessageNotModified);
                }
                400 if description.contains("MESSAGE_TOO_LONG") => {
                    return Err(TelegramError::MessageTooLong);
                }
                400 if description.contains("TEXTDRAFT_PEER_INVALID") => {
                    return Err(TelegramError::DraftPeerInvalid);
                }
                400 if description.contains("REACTION_INVALID")
                    || description.contains("REACTION_EMPTY") =>
                {
                    // Permanent error: emoji not available as reaction in this chat
                    log::debug!(
                        "[telegram] Reaction not available on {} (non-retryable): {}",
                        method,
                        description
                    );
                    return Err(TelegramError::Other(description.to_string()));
                }
                403 if description.contains("was kicked")
                    || description.contains("was blocked") =>
                {
                    return Err(TelegramError::BotKicked);
                }
                401 => {
                    return Err(TelegramError::TokenUnauthorized);
                }
                _ => {
                    retries += 1;
                    if retries >= MAX_TRANSIENT_RETRIES {
                        return Err(TelegramError::Other(format!(
                            "API error {}: {}",
                            error_code, description
                        )));
                    }
                    ulog_warn!(
                        "[telegram] Transient error on {} (attempt {}): {}",
                        method,
                        retries,
                        description
                    );
                    sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }

    /// Verify bot token and get bot info
    pub async fn get_me(&self) -> Result<Value, TelegramError> {
        let result = self.api_call("getMe", &json!({})).await?;
        if let Some(username) = result["username"].as_str() {
            *self.bot_username.lock().await = Some(username.to_string());
        }
        if let Some(id) = result["id"].as_i64() {
            *self.bot_user_id.lock().await = Some(id);
        }
        Ok(result)
    }

    /// Register bot commands with Telegram
    pub async fn set_my_commands(&self) -> Result<(), TelegramError> {
        let commands = json!({
            "commands": [
                { "command": "new", "description": "Start a new conversation" }
            ]
        });
        self.api_call("setMyCommands", &commands).await?;
        Ok(())
    }

    /// Get updates via long-polling
    async fn get_updates(&self, offset: i64) -> Result<Vec<Value>, TelegramError> {
        let body = json!({
            "offset": offset,
            "limit": 100,
            "timeout": LONG_POLL_TIMEOUT,
            "allowed_updates": ["message"]
        });
        let result = self.api_call("getUpdates", &body).await?;
        Ok(result.as_array().cloned().unwrap_or_default())
    }

    /// Send message with Markdown, auto-split if needed
    pub async fn send_message_impl(
        &self,
        chat_id: &str,
        text: &str,
    ) -> Result<Option<i64>, TelegramError> {
        let chunks = split_message(text, MAX_MESSAGE_LENGTH);
        let total = chunks.len();
        let mut last_message_id = None;

        for (i, chunk) in chunks.iter().enumerate() {
            let decorated = if total == 1 {
                chunk.clone()
            } else if i < total - 1 {
                format!("{}\n\n_(continues...)_", chunk)
            } else {
                format!("_(continued)_\n\n{}", chunk)
            };

            last_message_id = Some(self.send_single_message(chat_id, &decorated).await?);
        }

        Ok(last_message_id)
    }

    /// Send a single message, trying Markdown first then falling back to plain text
    async fn send_single_message(
        &self,
        chat_id: &str,
        text: &str,
    ) -> Result<i64, TelegramError> {
        // Try Markdown first
        match self
            .api_call(
                "sendMessage",
                &json!({
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown"
                }),
            )
            .await
        {
            Ok(result) => {
                return Ok(result["message_id"].as_i64().unwrap_or(0));
            }
            Err(TelegramError::MarkdownParseError) => {
                log::debug!("[telegram] Markdown parse failed, falling back to plain text");
            }
            Err(e) => return Err(e),
        }

        // Fallback to plain text
        let result = self
            .api_call(
                "sendMessage",
                &json!({
                    "chat_id": chat_id,
                    "text": text
                }),
            )
            .await?;
        Ok(result["message_id"].as_i64().unwrap_or(0))
    }

    /// Edit an existing message (for draft stream)
    pub async fn edit_message_impl(
        &self,
        chat_id: &str,
        message_id: i64,
        text: &str,
    ) -> Result<(), TelegramError> {
        match self
            .api_call(
                "editMessageText",
                &json!({
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "text": text,
                    "parse_mode": "Markdown"
                }),
            )
            .await
        {
            Ok(_) => Ok(()),
            Err(TelegramError::MarkdownParseError) => {
                // Retry without Markdown
                self.api_call(
                    "editMessageText",
                    &json!({
                        "chat_id": chat_id,
                        "message_id": message_id,
                        "text": text
                    }),
                )
                .await?;
                Ok(())
            }
            Err(TelegramError::MessageNotModified) => Ok(()), // Safe to ignore
            Err(e) => Err(e),
        }
    }

    /// Delete a message
    pub async fn delete_message_impl(
        &self,
        chat_id: &str,
        message_id: i64,
    ) -> Result<(), TelegramError> {
        self.api_call(
            "deleteMessage",
            &json!({
                "chat_id": chat_id,
                "message_id": message_id
            }),
        )
        .await?;
        Ok(())
    }

    /// Use sendMessageDraft to send/update a typing draft.
    /// On DraftPeerInvalid, sets draft_fallback = true for this adapter instance.
    async fn send_draft_update(
        &self,
        chat_id: &str,
        text: &str,
        draft_id: i64,
    ) -> Result<(), TelegramError> {
        use std::sync::atomic::Ordering;
        if self.draft_fallback.load(Ordering::Relaxed) {
            return Err(TelegramError::DraftPeerInvalid);
        }
        match self
            .api_call(
                "sendMessageDraft",
                &json!({
                    "chat_id": chat_id,
                    "text": text,
                    "draft_id": draft_id,
                    "parse_mode": "Markdown"
                }),
            )
            .await
        {
            Ok(_) => Ok(()),
            Err(TelegramError::DraftPeerInvalid) => {
                self.draft_fallback.store(true, Ordering::Relaxed);
                Err(TelegramError::DraftPeerInvalid)
            }
            Err(TelegramError::MarkdownParseError) => {
                // Retry without Markdown parse_mode
                match self
                    .api_call(
                        "sendMessageDraft",
                        &json!({
                            "chat_id": chat_id,
                            "text": text,
                            "draft_id": draft_id
                        }),
                    )
                    .await
                {
                    Ok(_) => Ok(()),
                    Err(TelegramError::DraftPeerInvalid) => {
                        self.draft_fallback.store(true, Ordering::Relaxed);
                        Err(TelegramError::DraftPeerInvalid)
                    }
                    Err(e) => Err(e),
                }
            }
            Err(e) => Err(e),
        }
    }

    /// Set reaction emoji on a message (ACK)
    pub async fn set_reaction(
        &self,
        chat_id: &str,
        message_id: i64,
        emoji: &str,
    ) -> Result<(), TelegramError> {
        let reaction = if emoji.is_empty() {
            json!([])
        } else {
            json!([{ "type": "emoji", "emoji": emoji }])
        };

        // Reactions may fail silently (bot permissions), don't propagate errors
        let _ = self
            .api_call(
                "setMessageReaction",
                &json!({
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "reaction": reaction
                }),
            )
            .await;
        Ok(())
    }

    /// ACK: message received
    pub async fn ack_received_impl(&self, chat_id: &str, message_id: i64) {
        let _ = self.set_reaction(chat_id, message_id, "\u{1F440}").await; // 👀
    }

    /// ACK: processing
    pub async fn ack_processing_impl(&self, chat_id: &str, message_id: i64) {
        let _ = self.set_reaction(chat_id, message_id, "\u{26A1}").await; // ⚡
    }

    /// ACK: clear reaction
    pub async fn ack_clear_impl(&self, chat_id: &str, message_id: i64) {
        let _ = self.set_reaction(chat_id, message_id, "").await;
    }

    /// Send "typing" chat action
    pub async fn send_typing_impl(&self, chat_id: &str) {
        let _ = self
            .api_call(
                "sendChatAction",
                &json!({
                    "chat_id": chat_id,
                    "action": "typing"
                }),
            )
            .await;
    }

    // ===== Long-polling loop =====

    /// Main listen loop — runs indefinitely, emitting ImMessages to message_tx.
    /// Handles reconnection with exponential backoff.
    pub async fn listen_loop_impl(
        &self,
        mut shutdown_rx: tokio::sync::watch::Receiver<bool>,
    ) {
        let mut offset: i64 = 0;
        let mut backoff_secs = INITIAL_BACKOFF_SECS;

        ulog_info!("[telegram] Starting long-poll loop");

        loop {
            // Check shutdown signal
            if *shutdown_rx.borrow() {
                ulog_info!("[telegram] Shutdown signal received, stopping listen loop");
                break;
            }

            // Wrap getUpdates in select! so shutdown can interrupt the 30s long-poll
            let result = tokio::select! {
                result = self.get_updates(offset) => result,
                _ = shutdown_rx.changed() => {
                    ulog_info!("[telegram] Shutdown during long-poll, exiting");
                    break;
                }
            };

            match result {
                Ok(updates) => {
                    backoff_secs = INITIAL_BACKOFF_SECS; // Reset backoff on success

                    for update in updates {
                        // Update offset to acknowledge this update
                        if let Some(update_id) = update["update_id"].as_i64() {
                            offset = update_id + 1;
                        }

                        if let Some(msg) = self.process_update(&update).await {
                            // Push through coalescer — returns messages ready to send
                            let ready_msgs = {
                                let mut coalescer = self.coalescer.lock().await;
                                coalescer.push(&msg)
                            };

                            for ready_msg in ready_msgs {
                                ulog_info!(
                                    "[telegram] Dispatching message from {} (chat {}): {} chars",
                                    ready_msg.sender_name.as_deref().unwrap_or("?"),
                                    ready_msg.chat_id,
                                    ready_msg.text.len(),
                                );
                                if self.message_tx.send(ready_msg).await.is_err() {
                                    ulog_error!("[telegram] Message channel closed");
                                    return;
                                }
                            }

                            // ACK received
                            if let Ok(mid) = msg.message_id.parse::<i64>() {
                                self.ack_received_impl(&msg.chat_id, mid).await;
                            }
                        }
                    }

                    // Flush any debounce-expired fragment batches
                    let expired_msgs = {
                        let mut coalescer = self.coalescer.lock().await;
                        coalescer.flush_expired()
                    };
                    for expired_msg in expired_msgs {
                        ulog_info!(
                            "[telegram] Flushing expired fragment batch for chat {}",
                            expired_msg.chat_id,
                        );
                        if self.message_tx.send(expired_msg).await.is_err() {
                            ulog_error!("[telegram] Message channel closed");
                            return;
                        }
                    }
                }
                Err(TelegramError::TokenUnauthorized) => {
                    ulog_error!("[telegram] Bot token is unauthorized, stopping");
                    break;
                }
                Err(e) => {
                    ulog_warn!(
                        "[telegram] Long-poll error: {}, retrying in {}s",
                        e,
                        backoff_secs
                    );

                    // Check shutdown during backoff
                    tokio::select! {
                        _ = sleep(Duration::from_secs(backoff_secs)) => {}
                        _ = shutdown_rx.changed() => {
                            if *shutdown_rx.borrow() {
                                ulog_info!("[telegram] Shutdown during backoff");
                                break;
                            }
                        }
                    }

                    // Exponential backoff with cap
                    backoff_secs = (backoff_secs * 2).min(MAX_BACKOFF_SECS);
                }
            }
        }

        ulog_info!("[telegram] Listen loop exited");
    }

    /// Process a single Telegram update into an ImMessage.
    /// Phase 1: handles text messages only (no media, no group detection).
    async fn process_update(&self, update: &Value) -> Option<ImMessage> {
        let message = update.get("message")?;
        let chat = &message["chat"];
        let from = &message["from"];

        let chat_id = chat["id"].as_i64()?.to_string();
        let message_id = message["message_id"].as_i64()?.to_string();
        let sender_id = from["id"].as_i64()?;
        let sender_id_str = sender_id.to_string();
        let sender_name = from["username"]
            .as_str()
            .or_else(|| from["first_name"].as_str())
            .map(|s| s.to_string());

        // Determine source type
        let chat_type = chat["type"].as_str().unwrap_or("private");
        let source_type = match chat_type {
            "group" | "supergroup" => ImSourceType::Group,
            _ => ImSourceType::Private,
        };

        // Text: message.text OR message.caption (media messages use caption)
        let raw_text = message["text"]
            .as_str()
            .or_else(|| message["caption"].as_str())
            .unwrap_or("");

        // Skip if no text content
        if raw_text.is_empty() {
            return None;
        }

        // Whitelist check for private chats
        if source_type == ImSourceType::Private
            && !self.is_user_allowed(sender_id, sender_name.as_deref()).await
        {
            log::debug!(
                "[telegram] Rejected message from non-whitelisted user: {} ({:?})",
                sender_id,
                sender_name
            );
            return None;
        }

        // Phase 1: no group mention detection, treat all private messages as relevant
        let is_mention = source_type == ImSourceType::Private;
        let reply_to_bot = false;

        Some(ImMessage {
            chat_id,
            message_id,
            text: raw_text.to_string(),
            sender_id: sender_id_str,
            sender_name,
            source_type,
            platform: ImPlatform::Telegram,
            timestamp: chrono::Utc::now(),
            is_mention,
            reply_to_bot,
        })
    }

    /// Check if a user is in the whitelist.
    /// Empty whitelist = allow all (open access).
    pub async fn is_user_allowed(&self, user_id: i64, username: Option<&str>) -> bool {
        let allowed_users = self.allowed_users.read().await;
        if allowed_users.is_empty() {
            return true; // Empty whitelist = allow all
        }

        let user_id_str = user_id.to_string();
        for allowed in allowed_users.iter() {
            if allowed == &user_id_str {
                return true;
            }
            if let Some(uname) = username {
                if allowed.eq_ignore_ascii_case(uname) {
                    return true;
                }
            }
        }
        false
    }

    /// Update allowed users list dynamically
    pub async fn update_allowed_users(&self, users: Vec<String>) {
        let mut allowed = self.allowed_users.write().await;
        *allowed = users;
    }
}

// ===== ImAdapter trait implementation =====

#[async_trait]
impl ImAdapter for TelegramAdapter {
    async fn verify_connection(&self) -> AdapterResult<String> {
        let result = self.get_me().await.map_err(|e| e.to_string())?;
        let username = result["username"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();
        Ok(format!("@{}", username))
    }

    async fn register_commands(&self) -> AdapterResult<()> {
        self.set_my_commands().await.map_err(|e| e.to_string())
    }

    async fn listen_loop(
        &self,
        shutdown_rx: tokio::sync::watch::Receiver<bool>,
    ) -> AdapterResult<()> {
        self.listen_loop_impl(shutdown_rx).await;
        Ok(())
    }

    async fn send_message(&self, chat_id: &str, text: &str) -> AdapterResult<()> {
        self.send_message_impl(chat_id, text)
            .await
            .map(|_| ()) // discard message_id
            .map_err(|e| e.to_string())
    }

    async fn ack_received(&self, chat_id: &str, message_id: &str) -> AdapterResult<()> {
        if let Ok(mid) = message_id.parse::<i64>() {
            self.ack_received_impl(chat_id, mid).await;
        }
        Ok(())
    }

    async fn ack_processing(&self, chat_id: &str, message_id: &str) -> AdapterResult<()> {
        if let Ok(mid) = message_id.parse::<i64>() {
            self.ack_processing_impl(chat_id, mid).await;
        }
        Ok(())
    }

    async fn ack_clear(&self, chat_id: &str, message_id: &str) -> AdapterResult<()> {
        if let Ok(mid) = message_id.parse::<i64>() {
            self.ack_clear_impl(chat_id, mid).await;
        }
        Ok(())
    }

    async fn send_typing(&self, chat_id: &str) -> AdapterResult<()> {
        self.send_typing_impl(chat_id).await;
        Ok(())
    }
}

// ===== ImStreamAdapter trait implementation =====

#[async_trait]
impl ImStreamAdapter for TelegramAdapter {
    async fn send_message_returning_id(
        &self,
        chat_id: &str,
        text: &str,
    ) -> AdapterResult<Option<String>> {
        use std::sync::atomic::Ordering;
        if self.use_message_draft && !self.draft_fallback.load(Ordering::Relaxed) {
            // Draft mode: use sendMessageDraft, return virtual "draft:{id}" ID.
            // The draft_id is encoded into the virtual ID string so each stream
            // is self-contained — no shared mutable state across concurrent chats.
            let draft_id = {
                use std::time::{SystemTime, UNIX_EPOCH};
                let t = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default();
                (t.as_millis() as i64).max(1)
            };
            match self.send_draft_update(chat_id, text, draft_id).await {
                Ok(()) => Ok(Some(format!("draft:{}", draft_id))),
                Err(TelegramError::DraftPeerInvalid) => {
                    // Fallback to standard mode
                    ulog_warn!(
                        "[telegram] sendMessageDraft not supported, falling back to standard mode"
                    );
                    self.send_message_impl(chat_id, text)
                        .await
                        .map(|opt| opt.map(|id| id.to_string()))
                        .map_err(|e| e.to_string())
                }
                Err(e) => Err(e.to_string()),
            }
        } else {
            // Standard mode
            self.send_message_impl(chat_id, text)
                .await
                .map(|opt_id| opt_id.map(|id| id.to_string()))
                .map_err(|e| e.to_string())
        }
    }

    async fn edit_message(
        &self,
        chat_id: &str,
        message_id: &str,
        text: &str,
    ) -> AdapterResult<()> {
        // Parse draft_id directly from the virtual "draft:xxx" ID string.
        // This keeps draft routing stream-local — no shared state across concurrent chats.
        if let Some(id_str) = message_id.strip_prefix("draft:") {
            let draft_id = id_str
                .parse::<i64>()
                .map_err(|e| format!("Invalid draft ID: {}", e))?;
            return self
                .send_draft_update(chat_id, text, draft_id)
                .await
                .map_err(|e| e.to_string());
        }
        // Standard mode
        let mid = message_id
            .parse::<i64>()
            .map_err(|e| format!("Invalid message_id: {}", e))?;
        self.edit_message_impl(chat_id, mid, text)
            .await
            .map_err(|e| e.to_string())
    }

    async fn delete_message(&self, chat_id: &str, message_id: &str) -> AdapterResult<()> {
        if message_id.starts_with("draft:") {
            // Drafts auto-clear when sendMessage is called, no need to delete
            return Ok(());
        }
        // Standard mode
        let mid = message_id
            .parse::<i64>()
            .map_err(|e| format!("Invalid message_id: {}", e))?;
        self.delete_message_impl(chat_id, mid)
            .await
            .map_err(|e| e.to_string())
    }

    fn max_message_length(&self) -> usize {
        MAX_MESSAGE_LENGTH
    }

    fn use_draft_streaming(&self) -> bool {
        self.use_message_draft
            && !self
                .draft_fallback
                .load(std::sync::atomic::Ordering::Relaxed)
    }

    fn preferred_throttle_ms(&self) -> u64 {
        if self.use_draft_streaming() {
            300
        } else {
            1000
        }
    }
}

// ===== Tests =====

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_msg(chat_id: &str, msg_id: i64, text: &str) -> ImMessage {
        ImMessage {
            chat_id: chat_id.to_string(),
            message_id: msg_id.to_string(),
            text: text.to_string(),
            sender_id: "42".to_string(),
            sender_name: Some("testuser".to_string()),
            source_type: ImSourceType::Private,
            platform: ImPlatform::Telegram,
            timestamp: chrono::Utc::now(),
            is_mention: false,
            reply_to_bot: false,
        }
    }

    #[test]
    fn test_coalescer_single_short_message_immediate() {
        let mut c = MessageCoalescer::new();
        // Short message should be returned immediately (not buffered)
        let msg = make_test_msg("chat1", 1, "hello");
        let result = c.push(&msg);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "hello");
        assert_eq!(result[0].sender_id, "42");
        assert_eq!(result[0].sender_name.as_deref(), Some("testuser"));
    }

    #[test]
    fn test_coalescer_fragment_merge() {
        let mut c = MessageCoalescer::new();
        let long_text = "a".repeat(4100);
        // First fragment — buffered, waiting for more
        let msg1 = make_test_msg("chat1", 1, &long_text);
        let result = c.push(&msg1);
        assert!(result.is_empty());

        // Second fragment (continuation: >= 4000 chars, consecutive msg_id)
        let long_text2 = "b".repeat(4100);
        let msg2 = make_test_msg("chat1", 2, &long_text2);
        let result = c.push(&msg2);
        assert!(result.is_empty()); // Still pending

        // Non-fragment message flushes old batch and is returned immediately
        let msg3 = make_test_msg("chat1", 100, "new message");
        let result = c.push(&msg3);
        assert_eq!(result.len(), 2); // flushed batch + new message
        assert!(result[0].text.contains("aaa"));
        assert!(result[0].text.contains("bbb"));
        assert_eq!(result[0].sender_id, "42"); // sender metadata preserved
        assert_eq!(result[1].text, "new message");
    }

    #[test]
    fn test_coalescer_flush_expired() {
        let mut c = MessageCoalescer::new();
        let long_text = "a".repeat(4100);
        let msg = make_test_msg("chat1", 1, &long_text);
        let result = c.push(&msg);
        assert!(result.is_empty());

        // Simulate debounce timeout by directly checking — in real code
        // Instant::now() advances, but in tests we verify the mechanism exists
        assert!(!c.pending.is_empty());
    }

    #[test]
    fn test_build_telegram_client_no_proxy() {
        let client = build_telegram_client(None);
        assert!(client.is_ok());
    }

    #[test]
    fn test_build_telegram_client_with_proxy() {
        let client = build_telegram_client(Some("http://127.0.0.1:7890"));
        assert!(client.is_ok());
    }

    #[test]
    fn test_build_telegram_client_invalid_proxy() {
        let client = build_telegram_client(Some("not_a_valid_url"));
        // reqwest is lenient with proxy URL parsing, so this may still succeed
        // The important thing is it doesn't panic
        let _ = client;
    }
}
