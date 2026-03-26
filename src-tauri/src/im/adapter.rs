use crate::im::types::*;
use async_trait::async_trait;
use tokio::sync::watch;

#[async_trait]
pub trait ImAdapter: Send + Sync + 'static {
    /// Verify bot token / credentials. Returns bot username.
    async fn verify_connection(&self) -> AdapterResult<String>;

    /// Register bot commands (e.g. Telegram /new menu).
    async fn register_commands(&self) -> AdapterResult<()>;

    /// Main listen loop. Runs until shutdown signal received.
    async fn listen_loop(&self, shutdown_rx: watch::Receiver<bool>) -> AdapterResult<()>;

    /// Send a text message (auto-splits if too long).
    async fn send_message(&self, chat_id: &str, text: &str) -> AdapterResult<()>;

    /// React with "received" indicator.
    async fn ack_received(&self, chat_id: &str, message_id: &str) -> AdapterResult<()>;

    /// React with "processing" indicator.
    async fn ack_processing(&self, chat_id: &str, message_id: &str) -> AdapterResult<()>;

    /// Clear reaction indicators.
    async fn ack_clear(&self, chat_id: &str, message_id: &str) -> AdapterResult<()>;

    /// Send typing indicator.
    async fn send_typing(&self, chat_id: &str) -> AdapterResult<()>;
}

#[async_trait]
pub trait ImStreamAdapter: ImAdapter {
    /// Send message and return its ID (for later editing).
    async fn send_message_returning_id(
        &self,
        chat_id: &str,
        text: &str,
    ) -> AdapterResult<Option<String>>;

    /// Edit an existing message.
    async fn edit_message(
        &self,
        chat_id: &str,
        message_id: &str,
        text: &str,
    ) -> AdapterResult<()>;

    /// Delete a message.
    async fn delete_message(&self, chat_id: &str, message_id: &str) -> AdapterResult<()>;

    /// Maximum message length for this platform.
    fn max_message_length(&self) -> usize;

    /// Whether to use draft-based streaming (Telegram-specific).
    fn use_draft_streaming(&self) -> bool {
        false
    }

    /// Throttle interval for streaming edits.
    fn preferred_throttle_ms(&self) -> u64 {
        1000
    }
}

/// Split long text at natural break points (paragraph, line, sentence, word).
pub fn split_message(text: &str, max_len: usize) -> Vec<String> {
    if text.len() <= max_len {
        return vec![text.to_string()];
    }

    let mut parts = Vec::new();
    let mut remaining = text;

    while !remaining.is_empty() {
        if remaining.len() <= max_len {
            parts.push(remaining.to_string());
            break;
        }

        let chunk = &remaining[..max_len];
        let split_at = chunk.rfind("\n\n")
            .or_else(|| chunk.rfind('\n'))
            .or_else(|| chunk.rfind(". "))
            .or_else(|| chunk.rfind(' '))
            .unwrap_or(max_len);

        let split_at = if split_at == 0 { max_len } else { split_at };

        parts.push(remaining[..split_at].to_string());
        remaining = remaining[split_at..].trim_start();
    }

    parts
}
