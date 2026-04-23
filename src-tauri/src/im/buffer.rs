// Message buffer — holds messages when Sidecar is unavailable
// Supports disk persistence for crash recovery
// Persist path convention: ~/.soagents/agents/{agentId}/channels/{channelId}/buffer.json

use std::collections::VecDeque;
use std::path::{Path, PathBuf};

use super::types::{BufferedMessage, ImMessage, MessageBufferData};
use crate::{ulog_info, ulog_warn};

/// Max buffered messages before oldest are dropped
const MAX_BUFFER_SIZE: usize = 100;

pub struct MessageBuffer {
    queue: VecDeque<BufferedMessage>,
    persist_path: Option<PathBuf>,
}

impl MessageBuffer {
    pub fn new(persist_path: Option<PathBuf>) -> Self {
        Self {
            queue: VecDeque::new(),
            persist_path,
        }
    }

    /// Load buffer from disk (if persist path exists)
    pub fn load_from_disk(path: &Path) -> Self {
        let queue = if path.exists() {
            match std::fs::read_to_string(path) {
                Ok(content) => match serde_json::from_str::<MessageBufferData>(&content) {
                    Ok(data) => {
                        ulog_info!(
                            "[im-buffer] Loaded {} buffered messages from disk",
                            data.messages.len()
                        );
                        data.messages
                    }
                    Err(e) => {
                        ulog_warn!("[im-buffer] Failed to parse buffer file: {}", e);
                        VecDeque::new()
                    }
                },
                Err(e) => {
                    ulog_warn!("[im-buffer] Failed to read buffer file: {}", e);
                    VecDeque::new()
                }
            }
        } else {
            VecDeque::new()
        };

        Self {
            queue,
            persist_path: Some(path.to_path_buf()),
        }
    }

    /// Push a message into the buffer
    pub fn push(&mut self, msg: &ImMessage) {
        // Drop oldest if at capacity
        if self.queue.len() >= MAX_BUFFER_SIZE {
            let dropped = self.queue.pop_front();
            if let Some(d) = dropped {
                ulog_warn!(
                    "[im-buffer] Buffer full, dropping oldest message from chat {}",
                    d.chat_id
                );
            }
        }

        self.queue.push_back(BufferedMessage::from_im_message(msg));
    }

    /// Pop the next message to process
    pub fn pop(&mut self) -> Option<BufferedMessage> {
        self.queue.pop_front()
    }

    /// Pop the first buffered message matching a session key (for same-peer replay).
    /// Returns None if no matching message is found.
    pub fn pop_for_session(&mut self, session_key: &str) -> Option<BufferedMessage> {
        let idx = self
            .queue
            .iter()
            .position(|m| m.session_key == session_key);
        idx.and_then(|i| self.queue.remove(i))
    }

    /// Persist buffer to disk
    pub fn save_to_disk(&self) -> Result<(), String> {
        let path = match &self.persist_path {
            Some(p) => p,
            None => return Ok(()),
        };

        let data = MessageBufferData {
            messages: self.queue.clone(),
        };

        let json = serde_json::to_string_pretty(&data)
            .map_err(|e| format!("Serialize error: {}", e))?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create buffer dir: {}", e))?;
        }

        std::fs::write(path, json).map_err(|e| format!("Failed to write buffer: {}", e))?;

        ulog_info!(
            "[im-buffer] Persisted {} messages to disk",
            self.queue.len()
        );
        Ok(())
    }

    /// Clear the buffer and remove disk file
    pub fn clear(&mut self) {
        self.queue.clear();
        if let Some(path) = &self.persist_path {
            let _ = std::fs::remove_file(path);
        }
    }

    /// Number of buffered messages
    pub fn len(&self) -> usize {
        self.queue.len()
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}
