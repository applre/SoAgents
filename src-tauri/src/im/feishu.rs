// Feishu (Lark) Bot adapter
// Handles WebSocket long connection using binary protobuf frames,
// message sending (text format), edit/delete, and group discovery.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::sync::atomic::{AtomicU64, Ordering};

use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::sleep;

use prost::Message as ProstMessage;

use super::adapter::{ImAdapter, ImStreamAdapter};
use super::types::{
    AdapterResult, GroupPermission, GroupPermissionStatus,
    ImConfig, ImMessage, ImPlatform, ImSourceType,
};
use crate::{proxy_config, ulog_error, ulog_info, ulog_warn};

// ── Feishu WebSocket Protobuf Frame ──────────────────────────────────────────
// Matches the official larksuite/oapi-sdk-go Frame definition (pbbp2.pb.go).
// Feishu WS sends ONLY binary protobuf frames — text frames are never used.

#[derive(Clone, PartialEq, ProstMessage)]
struct WsFrame {
    #[prost(uint64, tag = "1")]
    seq_id: u64,
    #[prost(uint64, tag = "2")]
    log_id: u64,
    #[prost(int32, tag = "3")]
    service: i32,
    #[prost(int32, tag = "4")]
    method: i32,
    #[prost(message, repeated, tag = "5")]
    headers: Vec<WsHeader>,
    #[prost(string, optional, tag = "6")]
    payload_encoding: Option<String>,
    #[prost(string, optional, tag = "7")]
    payload_type: Option<String>,
    #[prost(bytes = "vec", optional, tag = "8")]
    payload: Option<Vec<u8>>,
    #[prost(string, optional, tag = "9")]
    log_id_new: Option<String>,
}

#[derive(Clone, PartialEq, ProstMessage)]
struct WsHeader {
    #[prost(string, tag = "1")]
    key: String,
    #[prost(string, tag = "2")]
    value: String,
}

const FRAME_METHOD_CONTROL: i32 = 0;
const FRAME_METHOD_DATA: i32 = 1;

// ── Constants ─────────────────────────────────────────────────────────────────

const DEDUP_TTL_SECS: u64 = 72 * 60 * 60;
const DEDUP_MAX_SIZE: usize = 5000;
const DEDUP_PERSIST_INTERVAL_MS: u64 = 500;

const FEISHU_API_BASE: &str = "https://open.feishu.cn/open-apis";
const TOKEN_REFRESH_MARGIN_SECS: u64 = 600;
const TOKEN_VALIDITY_SECS: u64 = 7200;
const WS_INITIAL_BACKOFF_SECS: u64 = 1;
const WS_MAX_BACKOFF_SECS: u64 = 60;
const WS_READ_TIMEOUT_SECS: u64 = 120;
const WS_PING_INTERVAL_SECS: u64 = 30;
const MAX_MESSAGE_LENGTH: usize = 30000;

// ── Dedup cache persistence ───────────────────────────────────────────────────

fn save_dedup_cache_to_disk(path: &std::path::Path, cache: &HashMap<String, u64>) {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let tmp = path.with_extension("json.tmp.dedup");
    if let Ok(s) = serde_json::to_string(cache) {
        if std::fs::write(&tmp, &s).is_ok() {
            let _ = std::fs::rename(&tmp, path);
        }
    }
}

// ── Token cache ───────────────────────────────────────────────────────────────

struct TokenCache {
    access_token: String,
    expires_at: Instant,
}

// ── Adapter ───────────────────────────────────────────────────────────────────

pub struct FeishuAdapter {
    app_id: String,
    app_secret: String,
    client: Client,
    token_cache: Arc<RwLock<Option<TokenCache>>>,
    token_refresh_lock: Arc<Mutex<()>>,
    msg_tx: mpsc::Sender<ImMessage>,
    allowed_users: Arc<RwLock<Vec<String>>>,
    bot_open_id: Arc<RwLock<Option<String>>>,
    bot_name: Arc<RwLock<Option<String>>>,
    /// Shared group permissions — adapter adds new pending groups here
    group_permissions: Arc<RwLock<Vec<GroupPermission>>>,
    /// Known group chat_ids (pre-populated from persisted permissions on startup)
    known_groups: Arc<Mutex<HashSet<String>>>,
    /// "mention" or "always"
    group_activation: String,
    dedup_cache: Arc<Mutex<HashMap<String, u64>>>,
    dedup_persist_path: Option<PathBuf>,
    dedup_last_persist_ms: AtomicU64,
}

impl FeishuAdapter {
    pub fn new(
        config: &ImConfig,
        msg_tx: mpsc::Sender<ImMessage>,
        allowed_users: Arc<RwLock<Vec<String>>>,
        group_permissions: Arc<RwLock<Vec<GroupPermission>>>,
        dedup_path: Option<PathBuf>,
    ) -> Self {
        let client = proxy_config::build_client_with_proxy(
            Client::builder().timeout(Duration::from_secs(30)),
        )
        .unwrap_or_else(|_| Client::new());

        let dedup_cache = Self::load_dedup_cache(dedup_path.as_deref());

        // Pre-populate known groups from persisted permissions (sync read from config)
        let known_groups: HashSet<String> = config
            .group_permissions
            .iter()
            .map(|gp| gp.group_id.clone())
            .collect();

        Self {
            app_id: config.feishu_app_id.clone().unwrap_or_default(),
            app_secret: config.feishu_app_secret.clone().unwrap_or_default(),
            client,
            token_cache: Arc::new(RwLock::new(None)),
            token_refresh_lock: Arc::new(Mutex::new(())),
            msg_tx,
            allowed_users,
            bot_open_id: Arc::new(RwLock::new(None)),
            bot_name: Arc::new(RwLock::new(None)),
            group_permissions,
            known_groups: Arc::new(Mutex::new(known_groups)),
            group_activation: config
                .group_activation
                .clone()
                .unwrap_or_else(|| "mention".to_string()),
            dedup_cache: Arc::new(Mutex::new(dedup_cache)),
            dedup_persist_path: dedup_path,
            dedup_last_persist_ms: AtomicU64::new(0),
        }
    }

    fn load_dedup_cache(path: Option<&std::path::Path>) -> HashMap<String, u64> {
        let path = match path {
            Some(p) if p.exists() => p,
            _ => return HashMap::new(),
        };
        match std::fs::read_to_string(path) {
            Ok(content) => match serde_json::from_str::<HashMap<String, u64>>(&content) {
                Ok(mut cache) => {
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    cache.retain(|_, ts| now.saturating_sub(*ts) < DEDUP_TTL_SECS);
                    cache
                }
                Err(_) => HashMap::new(),
            },
            Err(_) => HashMap::new(),
        }
    }

    async fn maybe_persist_dedup(&self) {
        let Some(path) = &self.dedup_persist_path else {
            return;
        };
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let last = self.dedup_last_persist_ms.load(Ordering::Relaxed);
        if now_ms.saturating_sub(last) < DEDUP_PERSIST_INTERVAL_MS {
            return;
        }
        self.dedup_last_persist_ms.store(now_ms, Ordering::Relaxed);
        let snapshot = self.dedup_cache.lock().await.clone();
        let path = path.clone();
        tokio::task::spawn_blocking(move || save_dedup_cache_to_disk(&path, &snapshot));
    }

    /// Returns true if this is a NEW message (not a duplicate).
    async fn dedup_check(&self, msg_id: &str) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let mut cache = self.dedup_cache.lock().await;
        if cache.len() > DEDUP_MAX_SIZE {
            cache.retain(|_, ts| now.saturating_sub(*ts) < DEDUP_TTL_SECS);
        }
        if cache.contains_key(msg_id) {
            return false;
        }
        cache.insert(msg_id.to_string(), now);
        drop(cache);
        self.maybe_persist_dedup().await;
        true
    }

    // ── Token management ─────────────────────────────────────────────────────

    async fn get_token(&self) -> Result<String, String> {
        {
            let cache = self.token_cache.read().await;
            if let Some(ref tc) = *cache {
                if Instant::now() < tc.expires_at {
                    return Ok(tc.access_token.clone());
                }
            }
        }
        self.refresh_token().await
    }

    async fn refresh_token(&self) -> Result<String, String> {
        let _guard = self.token_refresh_lock.lock().await;
        {
            let cache = self.token_cache.read().await;
            if let Some(ref tc) = *cache {
                if Instant::now() < tc.expires_at {
                    return Ok(tc.access_token.clone());
                }
            }
        }

        let url = format!("{}/auth/v3/tenant_access_token/internal", FEISHU_API_BASE);
        let body = json!({ "app_id": self.app_id, "app_secret": self.app_secret });

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Token request failed: {}", e))?;

        let text = resp.text().await.unwrap_or_default();
        let json: Value =
            serde_json::from_str(&text).map_err(|e| format!("Token parse error: {}", e))?;

        let code = json["code"].as_i64().unwrap_or(-1);
        if code != 0 {
            return Err(format!(
                "Token error {}: {}",
                code,
                json["msg"].as_str().unwrap_or("unknown")
            ));
        }

        let token = json["tenant_access_token"]
            .as_str()
            .ok_or("No tenant_access_token")?
            .to_string();
        let expire = json["expire"].as_u64().unwrap_or(TOKEN_VALIDITY_SECS);
        let expires_at =
            Instant::now() + Duration::from_secs(expire.saturating_sub(TOKEN_REFRESH_MARGIN_SECS));

        *self.token_cache.write().await = Some(TokenCache {
            access_token: token.clone(),
            expires_at,
        });

        ulog_info!("[feishu] Token refreshed, expires in {}s", expire);
        Ok(token)
    }

    // ── API call helper ───────────────────────────────────────────────────────

    async fn api_call(
        &self,
        method: &str,
        url: &str,
        body: Option<&Value>,
    ) -> Result<Value, String> {
        let mut retries = 0;
        loop {
            let token = self.get_token().await?;
            let mut req = match method {
                "GET" => self.client.get(url),
                "PUT" => self.client.put(url),
                "DELETE" => self.client.delete(url),
                _ => self.client.post(url),
            };
            req = req.header("Authorization", format!("Bearer {}", token));
            if let Some(b) = body {
                req = req.json(b);
            }

            let resp = req
                .send()
                .await
                .map_err(|e| format!("Feishu API error: {}", e))?;
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();

            if status.as_u16() == 401 && retries == 0 {
                ulog_warn!("[feishu] Got 401, refreshing token");
                *self.token_cache.write().await = None;
                retries += 1;
                continue;
            }

            let json: Value = serde_json::from_str(&text)
                .map_err(|e| format!("API response parse error: {}", e))?;

            let code = json["code"].as_i64().unwrap_or(-1);
            if code == 0 {
                return Ok(json);
            }

            if (code == 99991663 || code == 99991661) && retries == 0 {
                ulog_warn!("[feishu] Token invalid (code {}), refreshing", code);
                *self.token_cache.write().await = None;
                retries += 1;
                continue;
            }

            return Err(format!(
                "Feishu API code {}: {}",
                code,
                json["msg"].as_str().unwrap_or("unknown")
            ));
        }
    }

    // ── Bot info ──────────────────────────────────────────────────────────────

    async fn get_bot_info(&self) -> Result<String, String> {
        let url = format!("{}/bot/v3/info", FEISHU_API_BASE);
        let resp = self.api_call("GET", &url, None).await?;
        let bot = &resp["bot"];
        let name = bot["app_name"].as_str().unwrap_or("Feishu Bot").to_string();
        *self.bot_name.write().await = Some(name.clone());
        if let Some(open_id) = bot["open_id"].as_str() {
            *self.bot_open_id.write().await = Some(open_id.to_string());
        }
        Ok(name)
    }

    // ── Message operations ────────────────────────────────────────────────────

    /// Send a text message to a Feishu chat.
    async fn send_text_message(
        &self,
        chat_id: &str,
        text: &str,
    ) -> Result<Option<String>, String> {
        // Split long messages
        if text.len() > MAX_MESSAGE_LENGTH {
            let chunks = super::adapter::split_message(text, MAX_MESSAGE_LENGTH);
            let mut last_id = None;
            for chunk in &chunks {
                last_id = self.send_single_text(chat_id, chunk).await?;
            }
            return Ok(last_id);
        }
        self.send_single_text(chat_id, text).await
    }

    async fn send_single_text(
        &self,
        chat_id: &str,
        text: &str,
    ) -> Result<Option<String>, String> {
        let url = format!(
            "{}/im/v1/messages?receive_id_type=chat_id",
            FEISHU_API_BASE
        );
        let content =
            serde_json::to_string(&json!({ "text": text })).unwrap_or_default();
        let body = json!({
            "receive_id": chat_id,
            "msg_type": "text",
            "content": content,
        });
        let resp = self.api_call("POST", &url, Some(&body)).await?;
        Ok(resp["data"]["message_id"].as_str().map(String::from))
    }

    /// Edit an existing message (uses PUT — replaces content).
    async fn edit_text_message(&self, message_id: &str, text: &str) -> Result<(), String> {
        let url = format!("{}/im/v1/messages/{}", FEISHU_API_BASE, message_id);
        let content =
            serde_json::to_string(&json!({ "text": text })).unwrap_or_default();
        let body = json!({ "msg_type": "text", "content": content });
        self.api_call("PUT", &url, Some(&body)).await?;
        Ok(())
    }

    /// Delete a message.
    async fn delete_text_message(&self, message_id: &str) -> Result<(), String> {
        let url = format!("{}/im/v1/messages/{}", FEISHU_API_BASE, message_id);
        self.api_call("DELETE", &url, None).await?;
        Ok(())
    }

    // ── WebSocket endpoint ────────────────────────────────────────────────────

    async fn get_ws_endpoint(&self) -> Result<String, String> {
        let url = "https://open.feishu.cn/callback/ws/endpoint";
        let body = json!({ "AppID": self.app_id, "AppSecret": self.app_secret });

        let resp = self
            .client
            .post(url)
            .header("locale", "zh")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("WS endpoint request failed: {}", e))?;

        let text = resp.text().await.unwrap_or_default();
        let json: Value =
            serde_json::from_str(&text).map_err(|e| format!("WS endpoint parse error: {}", e))?;

        let code = json["code"].as_i64().unwrap_or(-1);
        if code != 0 {
            return Err(format!(
                "WS endpoint error {}: {}",
                code,
                json["msg"].as_str().unwrap_or("unknown")
            ));
        }

        let ws_url = json["data"]["URL"]
            .as_str()
            .or_else(|| json["data"]["url"].as_str())
            .ok_or_else(|| format!("No URL in WS endpoint response: {}", json))?
            .to_string();

        Ok(ws_url)
    }

    // ── Event parsing ─────────────────────────────────────────────────────────

    /// Extract text and metadata from a Feishu im.message.receive_v1 event.
    async fn parse_im_event(&self, event: &Value) -> Option<ImMessage> {
        let header = event.get("header")?;
        if header["event_type"].as_str()? != "im.message.receive_v1" {
            return None;
        }

        let event_data = event.get("event")?;
        let message = event_data.get("message")?;
        let sender = event_data.get("sender")?;

        let chat_id = message["chat_id"].as_str()?.to_string();
        let message_id = message["message_id"].as_str()?.to_string();
        let msg_type = message["message_type"].as_str()?;
        let chat_type = message["chat_type"].as_str().unwrap_or("p2p");

        // Dedup
        if !self.dedup_check(&message_id).await {
            return None;
        }

        let content_str = message["content"].as_str()?;
        let content: Value = serde_json::from_str(content_str).ok()?;

        let text = match msg_type {
            "text" => content["text"].as_str().unwrap_or("").to_string(),
            "post" => extract_post_text(&content),
            _ => {
                log::debug!("[feishu] Unsupported message type: {}", msg_type);
                return None;
            }
        };

        if text.trim().is_empty() {
            return None;
        }

        let sender_id = sender["sender_id"]["open_id"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let source_type = if chat_type == "group" {
            ImSourceType::Group
        } else {
            ImSourceType::Private
        };

        // @mention detection
        let bot_oid = self.bot_open_id.read().await;
        let is_at_mention = bot_oid.is_some()
            && message
                .get("mentions")
                .and_then(|m| m.as_array())
                .map(|mentions| {
                    mentions
                        .iter()
                        .any(|m| m["id"]["open_id"].as_str() == bot_oid.as_deref())
                })
                .unwrap_or(false);
        drop(bot_oid);

        let is_mention = is_at_mention;

        // Group activation check
        if source_type == ImSourceType::Group
            && self.group_activation != "always"
            && !is_mention
        {
            return None;
        }

        // Group discovery: detect new groups
        if source_type == ImSourceType::Group {
            let is_new = {
                let mut groups = self.known_groups.lock().await;
                groups.insert(chat_id.clone())
            };
            if is_new {
                self.register_new_group(&chat_id, None).await;
            }
        }

        // User allowlist check for private messages (empty = allow all)
        if source_type == ImSourceType::Private {
            let allowed = self.allowed_users.read().await;
            if !allowed.is_empty() && !allowed.iter().any(|u| u == &sender_id) {
                ulog_info!(
                    "[feishu] Message from {} blocked by allowlist",
                    sender_id
                );
                return None;
            }
        }

        Some(ImMessage {
            chat_id,
            message_id,
            text,
            sender_id,
            sender_name: None,
            source_type,
            platform: ImPlatform::Feishu,
            timestamp: chrono::Utc::now(),
            is_mention,
            reply_to_bot: false,
        })
    }

    /// Called when a group is first seen. Adds it as a pending GroupPermission.
    async fn register_new_group(&self, chat_id: &str, chat_title: Option<&str>) {
        let group_name = chat_title
            .map(String::from)
            .unwrap_or_else(|| chat_id.to_string());

        ulog_info!("[feishu] New group discovered: {}", chat_id);

        let perm = GroupPermission {
            group_id: chat_id.to_string(),
            group_name,
            platform: ImPlatform::Feishu,
            status: GroupPermissionStatus::Pending,
            discovered_at: chrono::Utc::now().to_rfc3339(),
        };

        let mut perms = self.group_permissions.write().await;
        if !perms.iter().any(|p| p.group_id == chat_id) {
            perms.push(perm);
        }
    }

    // ── Protobuf frame helpers ────────────────────────────────────────────────

    fn get_frame_header<'a>(frame: &'a WsFrame, key: &str) -> Option<&'a str> {
        frame
            .headers
            .iter()
            .find(|h| h.key == key)
            .map(|h| h.value.as_str())
    }

    fn build_pong_frame(ping_frame: &WsFrame) -> Vec<u8> {
        let mut pong = WsFrame {
            seq_id: ping_frame.seq_id,
            log_id: ping_frame.log_id,
            service: ping_frame.service,
            method: FRAME_METHOD_CONTROL,
            headers: vec![WsHeader {
                key: "type".to_string(),
                value: "pong".to_string(),
            }],
            payload_encoding: None,
            payload_type: None,
            payload: None,
            log_id_new: ping_frame.log_id_new.clone(),
        };
        for h in &ping_frame.headers {
            if h.key != "type" {
                pong.headers.push(h.clone());
            }
        }
        pong.encode_to_vec()
    }

    fn build_response_frame(data_frame: &WsFrame) -> Vec<u8> {
        let mut headers = data_frame.headers.clone();
        headers.push(WsHeader {
            key: "biz_rt".to_string(),
            value: "0".to_string(),
        });
        let resp = WsFrame {
            seq_id: data_frame.seq_id,
            log_id: data_frame.log_id,
            service: data_frame.service,
            method: FRAME_METHOD_DATA,
            headers,
            payload_encoding: None,
            payload_type: None,
            payload: Some(br#"{"StatusCode":200,"Headers":{},"Data":null}"#.to_vec()),
            log_id_new: data_frame.log_id_new.clone(),
        };
        resp.encode_to_vec()
    }

    // ── WebSocket listen loop ─────────────────────────────────────────────────

    pub async fn ws_listen_loop(
        &self,
        mut shutdown_rx: tokio::sync::watch::Receiver<bool>,
    ) {
        use futures::SinkExt;
        use tokio_tungstenite::tungstenite::Message as WsMessage;

        let mut backoff_secs = WS_INITIAL_BACKOFF_SECS;

        loop {
            if *shutdown_rx.borrow() {
                break;
            }

            // Get WebSocket endpoint
            let ws_url = match self.get_ws_endpoint().await {
                Ok(url) => {
                    backoff_secs = WS_INITIAL_BACKOFF_SECS;
                    url
                }
                Err(e) => {
                    ulog_error!("[feishu] Failed to get WS endpoint: {}", e);
                    tokio::select! {
                        _ = sleep(Duration::from_secs(backoff_secs)) => {}
                        _ = shutdown_rx.changed() => { if *shutdown_rx.borrow() { break; } }
                    }
                    backoff_secs = (backoff_secs * 2).min(WS_MAX_BACKOFF_SECS);
                    continue;
                }
            };

            ulog_info!("[feishu] Connecting to WebSocket...");

            let ws_stream = match tokio_tungstenite::connect_async(&ws_url).await {
                Ok((stream, _)) => {
                    ulog_info!("[feishu] WebSocket connected");
                    backoff_secs = WS_INITIAL_BACKOFF_SECS;
                    stream
                }
                Err(e) => {
                    ulog_error!("[feishu] WebSocket connect failed: {}", e);
                    tokio::select! {
                        _ = sleep(Duration::from_secs(backoff_secs)) => {}
                        _ = shutdown_rx.changed() => { if *shutdown_rx.borrow() { break; } }
                    }
                    backoff_secs = (backoff_secs * 2).min(WS_MAX_BACKOFF_SECS);
                    continue;
                }
            };

            let (mut ws_write, mut ws_read) = futures::StreamExt::split(ws_stream);
            let mut last_activity = tokio::time::Instant::now();
            let mut ping_interval = tokio::time::interval(Duration::from_secs(WS_PING_INTERVAL_SECS));
            ping_interval.tick().await;

            loop {
                let timeout_at =
                    last_activity + Duration::from_secs(WS_READ_TIMEOUT_SECS);
                tokio::select! {
                    biased;
                    msg = futures::StreamExt::next(&mut ws_read) => {
                        match msg {
                            Some(Ok(WsMessage::Binary(data))) => {
                                last_activity = tokio::time::Instant::now();
                                let frame = match WsFrame::decode(data.as_ref()) {
                                    Ok(f) => f,
                                    Err(e) => {
                                        ulog_warn!("[feishu] Proto decode error: {}", e);
                                        continue;
                                    }
                                };
                                let msg_type = Self::get_frame_header(&frame, "type").unwrap_or("");
                                match frame.method {
                                    FRAME_METHOD_CONTROL => {
                                        if msg_type == "ping" {
                                            let pong = Self::build_pong_frame(&frame);
                                            if let Err(e) = ws_write.send(WsMessage::Binary(pong.into())).await {
                                                ulog_warn!("[feishu] Failed to send pong: {}", e);
                                            }
                                        }
                                    }
                                    FRAME_METHOD_DATA => {
                                        if msg_type != "event" {
                                            continue;
                                        }
                                        // ACK immediately to prevent replay
                                        let ack = Self::build_response_frame(&frame);
                                        if let Err(e) = ws_write.send(WsMessage::Binary(ack.into())).await {
                                            ulog_warn!("[feishu] Failed to send ACK seq={}: {}", frame.seq_id, e);
                                        }

                                        // Check fragmentation
                                        let sum: usize = Self::get_frame_header(&frame, "sum")
                                            .and_then(|v| v.parse().ok())
                                            .unwrap_or(1);
                                        if sum > 1 {
                                            ulog_warn!("[feishu] Fragmented message (sum={}), skipping", sum);
                                            continue;
                                        }

                                        if let Some(payload_bytes) = &frame.payload {
                                            let payload_str = match std::str::from_utf8(payload_bytes) {
                                                Ok(s) => s,
                                                Err(_) => continue,
                                            };
                                            if let Ok(event) = serde_json::from_str::<Value>(payload_str) {
                                                self.handle_event_payload(&event).await;
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }
                            Some(Ok(WsMessage::Ping(data))) => {
                                last_activity = tokio::time::Instant::now();
                                let _ = ws_write.send(WsMessage::Pong(data)).await;
                            }
                            Some(Ok(WsMessage::Close(_))) => {
                                ulog_info!("[feishu] WebSocket closed by server");
                                break;
                            }
                            Some(Err(e)) => {
                                ulog_warn!("[feishu] WebSocket error: {}", e);
                                break;
                            }
                            None => {
                                ulog_info!("[feishu] WebSocket stream ended");
                                break;
                            }
                            _ => {
                                last_activity = tokio::time::Instant::now();
                            }
                        }
                    }
                    _ = tokio::time::sleep_until(timeout_at) => {
                        ulog_warn!("[feishu] No data for {}s (dead connection), reconnecting", WS_READ_TIMEOUT_SECS);
                        let _ = tokio::time::timeout(
                            Duration::from_secs(3),
                            ws_write.send(WsMessage::Close(None)),
                        ).await;
                        break;
                    }
                    _ = ping_interval.tick() => {
                        if let Err(e) = ws_write.send(WsMessage::Ping(vec![])).await {
                            ulog_warn!("[feishu] WS ping failed: {}", e);
                            break;
                        }
                    }
                    _ = shutdown_rx.changed() => {
                        if *shutdown_rx.borrow() {
                            ulog_info!("[feishu] Shutdown signal, closing WS");
                            let _ = ws_write.send(WsMessage::Close(None)).await;
                            return;
                        }
                    }
                }
            }

            if *shutdown_rx.borrow() {
                break;
            }

            ulog_info!("[feishu] Reconnecting in {}s...", backoff_secs);
            tokio::select! {
                _ = sleep(Duration::from_secs(backoff_secs)) => {}
                _ = shutdown_rx.changed() => { if *shutdown_rx.borrow() { break; } }
            }
            backoff_secs = (backoff_secs * 2).min(WS_MAX_BACKOFF_SECS);
        }

        // Flush dedup cache on shutdown
        if let Some(path) = &self.dedup_persist_path {
            let snapshot = self.dedup_cache.lock().await.clone();
            save_dedup_cache_to_disk(path, &snapshot);
        }

        ulog_info!("[feishu] WS listen loop exited");
    }

    async fn handle_event_payload(&self, event: &Value) {
        let event_type = event
            .get("header")
            .and_then(|h| h["event_type"].as_str())
            .unwrap_or("");

        // Handle bot added/removed group events
        match event_type {
            "im.chat.member.bot.added_v1" => {
                if let Some(event_data) = event.get("event") {
                    let chat_id = event_data["chat_id"]
                        .as_str()
                        .unwrap_or("")
                        .to_string();
                    if !chat_id.is_empty() {
                        let is_new = {
                            let mut groups = self.known_groups.lock().await;
                            groups.insert(chat_id.clone())
                        };
                        if is_new {
                            self.register_new_group(&chat_id, None).await;
                        }
                    }
                }
                return;
            }
            "im.chat.member.bot.deleted_v1" => {
                if let Some(event_data) = event.get("event") {
                    let chat_id = event_data["chat_id"].as_str().unwrap_or("");
                    if !chat_id.is_empty() {
                        self.known_groups.lock().await.remove(chat_id);
                        let mut perms = self.group_permissions.write().await;
                        perms.retain(|p| p.group_id != chat_id);
                    }
                }
                return;
            }
            _ => {}
        }

        // Parse regular IM message
        if let Some(im_message) = self.parse_im_event(event).await {
            if let Err(e) = self.msg_tx.send(im_message).await {
                ulog_error!("[feishu] Failed to forward message: {}", e);
            }
        }
    }
}

// ── Post → plain text ─────────────────────────────────────────────────────────

fn extract_post_text(content: &Value) -> String {
    // Post content may be locale-wrapped or direct
    let post = if let Some(obj) = content.as_object() {
        if obj.get("content").map_or(false, |v| v.is_array()) {
            content
        } else {
            obj.get("zh_cn")
                .or_else(|| obj.get("en_us"))
                .or_else(|| obj.values().next())
                .unwrap_or(content)
        }
    } else {
        content
    };

    let mut lines = Vec::new();
    if let Some(title) = post["title"].as_str() {
        if !title.is_empty() {
            lines.push(title.to_string());
        }
    }
    if let Some(paragraphs) = post["content"].as_array() {
        for para in paragraphs {
            if let Some(elements) = para.as_array() {
                let mut parts = Vec::new();
                for elem in elements {
                    match elem["tag"].as_str().unwrap_or("") {
                        "text" => {
                            if let Some(t) = elem["text"].as_str() {
                                parts.push(t.to_string());
                            }
                        }
                        "a" => {
                            let text = elem["text"].as_str().unwrap_or("");
                            let href = elem["href"].as_str().unwrap_or("");
                            if !text.is_empty() {
                                parts.push(text.to_string());
                            } else {
                                parts.push(href.to_string());
                            }
                        }
                        "at" => {
                            let name = elem["user_name"].as_str().unwrap_or("@someone");
                            parts.push(format!("@{}", name));
                        }
                        _ => {
                            if let Some(t) = elem["text"].as_str() {
                                parts.push(t.to_string());
                            }
                        }
                    }
                }
                lines.push(parts.join(""));
            }
        }
    }
    lines.join("\n")
}

// ── Trait implementations ─────────────────────────────────────────────────────

#[async_trait]
impl ImAdapter for FeishuAdapter {
    async fn verify_connection(&self) -> AdapterResult<String> {
        self.get_bot_info().await
    }

    async fn register_commands(&self) -> AdapterResult<()> {
        // Feishu does not support bot command registration via API
        Ok(())
    }

    async fn listen_loop(
        &self,
        shutdown_rx: tokio::sync::watch::Receiver<bool>,
    ) -> AdapterResult<()> {
        self.ws_listen_loop(shutdown_rx).await;
        Ok(())
    }

    async fn send_message(&self, chat_id: &str, text: &str) -> AdapterResult<()> {
        self.send_text_message(chat_id, text).await?;
        Ok(())
    }

    async fn ack_received(&self, _chat_id: &str, _message_id: &str) -> AdapterResult<()> {
        Ok(())
    }

    async fn ack_processing(&self, _chat_id: &str, _message_id: &str) -> AdapterResult<()> {
        Ok(())
    }

    async fn ack_clear(&self, _chat_id: &str, _message_id: &str) -> AdapterResult<()> {
        Ok(())
    }

    async fn send_typing(&self, _chat_id: &str) -> AdapterResult<()> {
        Ok(())
    }
}

#[async_trait]
impl ImStreamAdapter for FeishuAdapter {
    async fn send_message_returning_id(
        &self,
        chat_id: &str,
        text: &str,
    ) -> AdapterResult<Option<String>> {
        self.send_text_message(chat_id, text).await
    }

    async fn edit_message(
        &self,
        _chat_id: &str,
        message_id: &str,
        text: &str,
    ) -> AdapterResult<()> {
        self.edit_text_message(message_id, text).await
    }

    async fn delete_message(
        &self,
        _chat_id: &str,
        message_id: &str,
    ) -> AdapterResult<()> {
        self.delete_text_message(message_id).await
    }

    fn max_message_length(&self) -> usize {
        MAX_MESSAGE_LENGTH
    }

    fn preferred_throttle_ms(&self) -> u64 {
        1500
    }
}

// ── Verify credentials (for Tauri command) ────────────────────────────────────

/// Verify Feishu credentials by fetching a tenant_access_token.
pub async fn verify_feishu_credentials(
    app_id: &str,
    app_secret: &str,
) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let url = format!("{}/auth/v3/tenant_access_token/internal", FEISHU_API_BASE);
    let body = json!({ "app_id": app_id, "app_secret": app_secret });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Verification request failed: {}", e))?;

    let text = resp.text().await.unwrap_or_default();
    let json: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Response parse error: {}", e))?;

    let code = json["code"].as_i64().unwrap_or(-1);
    if code == 0 {
        // Also fetch bot info to get the app name
        Ok(format!("Feishu Bot (AppID: {}...)", &app_id[..app_id.len().min(8)]))
    } else {
        Err(format!(
            "Feishu credentials invalid (code {}): {}",
            code,
            json["msg"].as_str().unwrap_or("unknown")
        ))
    }
}
