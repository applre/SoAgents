// IM Bot integration types (Rust side)

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::path::PathBuf;
use std::time::Instant;

// ===== Platform & Status Enums =====

/// IM platform type
#[derive(Debug, Clone, PartialEq)]
pub enum ImPlatform {
    Telegram,
    Feishu,
    Dingtalk,
}

impl Serialize for ImPlatform {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Telegram => serializer.serialize_str("telegram"),
            Self::Feishu => serializer.serialize_str("feishu"),
            Self::Dingtalk => serializer.serialize_str("dingtalk"),
        }
    }
}

impl<'de> Deserialize<'de> for ImPlatform {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        match s.as_str() {
            "telegram" => Ok(Self::Telegram),
            "feishu" => Ok(Self::Feishu),
            "dingtalk" => Ok(Self::Dingtalk),
            _ => Err(serde::de::Error::unknown_variant(
                &s,
                &["telegram", "feishu", "dingtalk"],
            )),
        }
    }
}

impl std::fmt::Display for ImPlatform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Telegram => write!(f, "telegram"),
            Self::Feishu => write!(f, "feishu"),
            Self::Dingtalk => write!(f, "dingtalk"),
        }
    }
}

/// IM Bot operational status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ImStatus {
    Online,
    Connecting,
    Error,
    Stopped,
}

/// IM source type (private chat vs group)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ImSourceType {
    Private,
    Group,
}

// ===== Incoming Message =====

/// Incoming IM message (from adapter)
#[derive(Debug, Clone)]
pub struct ImMessage {
    pub chat_id: String,
    pub message_id: String,
    pub text: String,
    pub sender_id: String,
    pub sender_name: Option<String>,
    pub source_type: ImSourceType,
    pub platform: ImPlatform,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// Whether this message triggers bot response (@mention, /ask, reply-to-bot)
    pub is_mention: bool,
    /// Whether this is specifically a reply to bot's message
    pub reply_to_bot: bool,
}

impl ImMessage {
    /// Canonical session key for routing (single source of truth for the format).
    pub fn session_key(&self) -> String {
        let source = match self.source_type {
            ImSourceType::Private => "private",
            ImSourceType::Group => "group",
        };
        format!("im:{}:{}:{}", self.platform, source, self.chat_id)
    }
}

// ===== Config =====

/// IM Bot configuration passed to adapter at runtime.
/// Merged from Agent + Channel config before adapter start.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImConfig {
    pub agent_id: String,
    pub channel_id: String,
    #[serde(default = "default_platform")]
    pub platform: ImPlatform,
    pub workspace_path: String,
    pub bot_token: String,
    #[serde(default)]
    pub telegram_use_draft: Option<bool>,
    pub allowed_users: Vec<String>,
    #[serde(default)]
    pub provider_id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub provider_env_json: Option<String>,
    pub permission_mode: String,
    #[serde(default)]
    pub mcp_enabled_servers: Option<Vec<String>>,
    #[serde(default)]
    pub mcp_servers_json: Option<String>,
    /// HTTP/SOCKS5 proxy URL for Telegram API requests (needed in China)
    #[serde(default)]
    pub proxy_url: Option<String>,
    // Feishu credentials
    #[serde(default)]
    pub feishu_app_id: Option<String>,
    #[serde(default)]
    pub feishu_app_secret: Option<String>,
    // DingTalk credentials
    #[serde(default)]
    pub dingtalk_client_id: Option<String>,
    #[serde(default)]
    pub dingtalk_client_secret: Option<String>,
    #[serde(default)]
    pub dingtalk_use_ai_card: Option<bool>,
    #[serde(default)]
    pub dingtalk_card_template_id: Option<String>,
    // Group permissions (persisted, passed to adapter on startup)
    #[serde(default)]
    pub group_permissions: Vec<GroupPermission>,
    // Group activation mode: "mention" or "always"
    #[serde(default)]
    pub group_activation: Option<String>,
}

fn default_platform() -> ImPlatform {
    ImPlatform::Telegram
}

// ===== Session Tracking =====

/// Per-peer session tracking in SessionRouter
#[derive(Debug)]
pub struct PeerSession {
    pub session_key: String,
    pub session_id: String,
    pub sidecar_port: u16,
    pub workspace_path: PathBuf,
    pub message_count: u32,
    pub last_active: Instant,
}

// ===== Buffer =====

/// Buffered message (when Sidecar is unavailable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferedMessage {
    pub session_key: String,
    pub chat_id: String,
    pub text: String,
    pub sender_id: String,
    pub sender_name: Option<String>,
    pub timestamp: String,
}

impl BufferedMessage {
    pub fn from_im_message(msg: &ImMessage) -> Self {
        Self {
            session_key: msg.session_key(),
            chat_id: msg.chat_id.clone(),
            text: msg.text.clone(),
            sender_id: msg.sender_id.clone(),
            sender_name: msg.sender_name.clone(),
            timestamp: msg.timestamp.to_rfc3339(),
        }
    }
}

/// Persistent message buffer (serializable for disk persistence)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MessageBufferData {
    pub messages: VecDeque<BufferedMessage>,
}

// ===== Status Response =====

/// Active session info for status display
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveSessionInfo {
    pub session_key: String,
    pub session_id: String,
    pub message_count: u32,
    pub last_active: String,
}

/// Group permission status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GroupPermissionStatus {
    Pending,
    Approved,
}

/// Group permission entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupPermission {
    pub group_id: String,
    pub group_name: String,
    pub platform: ImPlatform,
    pub status: GroupPermissionStatus,
    pub discovered_at: String,
}

/// IM Bot runtime status returned to frontend
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImBotStatusResponse {
    pub bot_username: Option<String>,
    pub status: ImStatus,
    pub uptime_seconds: u64,
    pub active_sessions: Vec<ActiveSessionInfo>,
    pub error_message: Option<String>,
    pub restart_count: u32,
    pub buffered_messages: usize,
    pub group_permissions: Vec<GroupPermission>,
}

// ===== Health State =====

/// Health state for persistence (written to im_state.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImHealthState {
    pub bot_username: Option<String>,
    pub status: ImStatus,
    pub uptime_seconds: u64,
    pub last_message_at: Option<String>,
    pub active_sessions: Vec<ActiveSessionInfo>,
    pub error_message: Option<String>,
    pub restart_count: u32,
    pub buffered_messages: usize,
    pub last_persisted: String,
}

impl Default for ImHealthState {
    fn default() -> Self {
        Self {
            bot_username: None,
            status: ImStatus::Stopped,
            uptime_seconds: 0,
            last_message_at: None,
            active_sessions: Vec::new(),
            error_message: None,
            restart_count: 0,
            buffered_messages: 0,
            last_persisted: chrono::Utc::now().to_rfc3339(),
        }
    }
}

// ===== Error Types =====

/// Telegram API error types
#[derive(Debug)]
pub enum TelegramError {
    /// Network timeout during API call
    NetworkTimeout,
    /// Rate limited by Telegram (retry after N seconds)
    RateLimited(u64),
    /// Markdown parsing failed (should retry as plain text)
    MarkdownParseError,
    /// Message content didn't change (safe to ignore)
    MessageNotModified,
    /// Message exceeds 4096 char limit
    MessageTooLong,
    /// Bot was kicked from group
    BotKicked,
    /// Bot token is invalid
    TokenUnauthorized,
    /// Draft peer invalid (sendMessageDraft not supported for this chat)
    DraftPeerInvalid,
    /// Other API error
    Other(String),
}

impl std::fmt::Display for TelegramError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NetworkTimeout => write!(f, "Network timeout"),
            Self::RateLimited(secs) => write!(f, "Rate limited, retry after {}s", secs),
            Self::MarkdownParseError => write!(f, "Markdown parse error"),
            Self::MessageNotModified => write!(f, "Message not modified"),
            Self::MessageTooLong => write!(f, "Message too long"),
            Self::BotKicked => write!(f, "Bot kicked from group"),
            Self::TokenUnauthorized => write!(f, "Token unauthorized"),
            Self::DraftPeerInvalid => write!(f, "Draft peer invalid"),
            Self::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for TelegramError {}

/// Convenience result alias for adapter operations
pub type AdapterResult<T> = Result<T, String>;

/// Routing error variants
#[derive(Debug)]
pub enum RouteError {
    /// Setup/configuration error
    Setup(String),
    /// Sidecar unavailable
    Unavailable(String),
    /// Upstream responded with HTTP error
    Response(u16, String),
}

impl std::fmt::Display for RouteError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Setup(msg) => write!(f, "Setup error: {}", msg),
            Self::Unavailable(msg) => write!(f, "Unavailable: {}", msg),
            Self::Response(code, msg) => write!(f, "HTTP {}: {}", code, msg),
        }
    }
}

impl std::error::Error for RouteError {}

// ===== Agent + Channel Architecture =====

/// Channel-level config overrides (None = inherit from Agent)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelOverrides {
    pub provider_id: Option<String>,
    pub provider_env_json: Option<String>,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub tools_deny: Option<Vec<String>>,
}

/// Channel configuration within an Agent
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelConfigRust {
    pub id: String,
    #[serde(rename = "type")]
    pub channel_type: ImPlatform,
    #[serde(default)]
    pub name: Option<String>,
    pub enabled: bool,

    // Platform credentials
    #[serde(default)]
    pub bot_token: Option<String>,
    #[serde(default)]
    pub telegram_use_draft: Option<bool>,
    #[serde(default)]
    pub feishu_app_id: Option<String>,
    #[serde(default)]
    pub feishu_app_secret: Option<String>,
    #[serde(default)]
    pub dingtalk_client_id: Option<String>,
    #[serde(default)]
    pub dingtalk_client_secret: Option<String>,

    // DingTalk AI Card settings
    #[serde(default)]
    pub dingtalk_use_ai_card: Option<bool>,
    #[serde(default)]
    pub dingtalk_card_template_id: Option<String>,

    // User management
    #[serde(default)]
    pub allowed_users: Vec<String>,

    // Group permissions (persisted)
    #[serde(default)]
    pub group_permissions: Vec<GroupPermission>,

    // Group activation: "mention" or "always"
    #[serde(default)]
    pub group_activation: Option<String>,

    // Overrides
    #[serde(default)]
    pub overrides: Option<ChannelOverrides>,

    #[serde(default)]
    pub setup_completed: Option<bool>,

    /// HTTP/SOCKS5 proxy URL (Telegram API needs proxy in China)
    #[serde(default)]
    pub proxy_url: Option<String>,
}

/// Agent configuration (read from config.json agents[])
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfigRust {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub icon: Option<String>,
    pub enabled: bool,

    pub workspace_path: String,

    // AI config (Agent-level defaults)
    #[serde(default)]
    pub provider_id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub provider_env_json: Option<String>,
    #[serde(default = "default_permission_mode")]
    pub permission_mode: String,
    #[serde(default)]
    pub mcp_enabled_servers: Option<Vec<String>>,
    #[serde(default)]
    pub mcp_servers_json: Option<String>,

    // Heartbeat & Memory Auto-Update
    #[serde(default)]
    pub heartbeat: Option<HeartbeatConfig>,
    #[serde(default)]
    pub memory_auto_update: Option<MemoryAutoUpdateConfig>,

    // Channels
    #[serde(default)]
    pub channels: Vec<ChannelConfigRust>,

    #[serde(default)]
    pub setup_completed: Option<bool>,
}

fn default_permission_mode() -> String {
    "plan".to_string()
}

// ===== Heartbeat & Memory Auto-Update Config =====

/// Active hours window for heartbeat scheduling
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveHours {
    /// Start time in HH:MM format (inclusive)
    pub start: String,
    /// End time in HH:MM format (exclusive)
    pub end: String,
    /// IANA timezone name (e.g. "Asia/Shanghai")
    pub timezone: String,
}

/// Heartbeat configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatConfig {
    #[serde(default = "default_hb_enabled")]
    pub enabled: bool,
    #[serde(default = "default_hb_interval")]
    pub interval_minutes: u32,
    #[serde(default)]
    pub active_hours: Option<ActiveHours>,
    /// Max chars for HEARTBEAT_OK detection (default: 300)
    #[serde(default)]
    pub ack_max_chars: Option<u32>,
}

fn default_hb_enabled() -> bool { true }
fn default_hb_interval() -> u32 { 30 }

impl Default for HeartbeatConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_minutes: 30,
            active_hours: None,
            ack_max_chars: None,
        }
    }
}

/// Memory auto-update configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryAutoUpdateConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_mau_interval")]
    pub interval_hours: u32,
    #[serde(default = "default_mau_threshold")]
    pub query_threshold: u32,
    #[serde(default = "default_mau_window_start")]
    pub update_window_start: String,
    #[serde(default = "default_mau_window_end")]
    pub update_window_end: String,
    #[serde(default)]
    pub update_window_timezone: Option<String>,
    #[serde(default)]
    pub last_batch_at: Option<String>,
    #[serde(default)]
    pub last_batch_session_count: Option<u32>,
}

fn default_mau_interval() -> u32 { 24 }
fn default_mau_threshold() -> u32 { 5 }
fn default_mau_window_start() -> String { "00:00".to_string() }
fn default_mau_window_end() -> String { "06:00".to_string() }

impl Default for MemoryAutoUpdateConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_hours: 24,
            query_threshold: 5,
            update_window_start: "00:00".to_string(),
            update_window_end: "06:00".to_string(),
            update_window_timezone: None,
            last_batch_at: None,
            last_batch_session_count: None,
        }
    }
}

impl ChannelConfigRust {
    /// Convert to ImConfig for adapter startup.
    pub fn to_im_config(&self, agent: &AgentConfigRust) -> ImConfig {
        let overrides = self.overrides.as_ref();
        ImConfig {
            agent_id: agent.id.clone(),
            channel_id: self.id.clone(),
            platform: self.channel_type.clone(),
            workspace_path: agent.workspace_path.clone(),
            bot_token: self.bot_token.clone().unwrap_or_default(),
            telegram_use_draft: self.telegram_use_draft,
            allowed_users: self.allowed_users.clone(),
            provider_id: overrides
                .and_then(|o| o.provider_id.clone())
                .or_else(|| agent.provider_id.clone()),
            model: overrides
                .and_then(|o| o.model.clone())
                .or_else(|| agent.model.clone()),
            provider_env_json: overrides
                .and_then(|o| o.provider_env_json.clone())
                .or_else(|| agent.provider_env_json.clone()),
            permission_mode: overrides
                .and_then(|o| o.permission_mode.clone())
                .unwrap_or_else(|| agent.permission_mode.clone()),
            mcp_enabled_servers: agent.mcp_enabled_servers.clone(),
            mcp_servers_json: agent.mcp_servers_json.clone(),
            proxy_url: self.proxy_url.clone(),
            feishu_app_id: self.feishu_app_id.clone(),
            feishu_app_secret: self.feishu_app_secret.clone(),
            dingtalk_client_id: self.dingtalk_client_id.clone(),
            dingtalk_client_secret: self.dingtalk_client_secret.clone(),
            dingtalk_use_ai_card: self.dingtalk_use_ai_card,
            dingtalk_card_template_id: self.dingtalk_card_template_id.clone(),
            group_permissions: self.group_permissions.clone(),
            group_activation: self.group_activation.clone(),
        }
    }
}

/// Agent-level status (aggregates all channel statuses)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub agent_id: String,
    pub agent_name: String,
    pub enabled: bool,
    pub channels: Vec<ChannelStatus>,
}

/// Per-channel runtime status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelStatus {
    pub channel_id: String,
    pub channel_type: ImPlatform,
    pub name: Option<String>,
    pub status: ImStatus,
    pub bot_username: Option<String>,
    pub uptime_seconds: u64,
    pub last_message_at: Option<String>,
    pub active_sessions: Vec<ActiveSessionInfo>,
    pub error_message: Option<String>,
    pub restart_count: u32,
    pub buffered_messages: usize,
}
