// DingTalk (钉钉) Bot adapter
// Handles Stream mode WebSocket connection (JSON text frames),
// message sending/editing (AI Card), OAuth2 token management,
// and group discovery.

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

use futures::SinkExt;
use futures::StreamExt;

use super::adapter::{ImAdapter, ImStreamAdapter};
use super::types::{
    AdapterResult, GroupPermission, GroupPermissionStatus,
    ImConfig, ImMessage, ImPlatform, ImSourceType,
};
use crate::{proxy_config, ulog_error, ulog_info, ulog_warn};

// ── Constants ─────────────────────────────────────────────────────────────────

const DINGTALK_API_BASE: &str = "https://api.dingtalk.com";

const TOKEN_REFRESH_MARGIN_SECS: u64 = 300;
const TOKEN_VALIDITY_SECS: u64 = 7200;

const WS_INITIAL_BACKOFF_SECS: u64 = 1;
const WS_MAX_BACKOFF_SECS: u64 = 60;
const WS_READ_TIMEOUT_SECS: u64 = 120;
const WS_PING_INTERVAL_SECS: u64 = 30;

const DEDUP_TTL_SECS: u64 = 72 * 60 * 60;
const DEDUP_MAX_SIZE: usize = 5000;
const DEDUP_PERSIST_INTERVAL_MS: u64 = 500;

const MAX_MESSAGE_LENGTH: usize = 20000;

// ── AI Card tracking ──────────────────────────────────────────────────────────

struct ActiveCardState {
    out_track_id: String,
    last_content: String,
}

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

pub struct DingtalkAdapter {
    client_id: String,
    client_secret: String,
    use_ai_card: bool,
    card_template_id: Option<String>,
    client: Client,
    token_cache: Arc<RwLock<Option<TokenCache>>>,
    token_refresh_lock: Arc<tokio::sync::Mutex<()>>,
    msg_tx: mpsc::Sender<ImMessage>,
    allowed_users: Arc<RwLock<Vec<String>>>,
    bot_name: Arc<RwLock<Option<String>>>,
    robot_code: String,
    /// "mention" or "always"
    group_activation: String,
    /// Shared group permissions — adapter adds new pending groups here
    group_permissions: Arc<RwLock<Vec<GroupPermission>>>,
    /// Known group conversation IDs
    known_groups: Arc<Mutex<HashSet<String>>>,
    /// Active AI Cards: chat_id → state
    active_cards: Arc<Mutex<HashMap<String, ActiveCardState>>>,
    dedup_cache: Arc<Mutex<HashMap<String, u64>>>,
    dedup_persist_path: Option<PathBuf>,
    dedup_last_persist_ms: AtomicU64,
}

impl DingtalkAdapter {
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

        // Pre-populate known groups from persisted permissions
        let known_groups: HashSet<String> = config
            .group_permissions
            .iter()
            .map(|gp| gp.group_id.clone())
            .collect();

        let client_id = config.dingtalk_client_id.clone().unwrap_or_default();

        Self {
            client_id: client_id.clone(),
            client_secret: config.dingtalk_client_secret.clone().unwrap_or_default(),
            use_ai_card: config.dingtalk_use_ai_card.unwrap_or(false),
            card_template_id: config.dingtalk_card_template_id.clone(),
            client,
            token_cache: Arc::new(RwLock::new(None)),
            token_refresh_lock: Arc::new(tokio::sync::Mutex::new(())),
            msg_tx,
            allowed_users,
            bot_name: Arc::new(RwLock::new(None)),
            robot_code: client_id,
            group_activation: config
                .group_activation
                .clone()
                .unwrap_or_else(|| "mention".to_string()),
            group_permissions,
            known_groups: Arc::new(Mutex::new(known_groups)),
            active_cards: Arc::new(Mutex::new(HashMap::new())),
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

        let url = format!("{}/v1.0/oauth2/accessToken", DINGTALK_API_BASE);
        let body = json!({
            "appKey": self.client_id,
            "appSecret": self.client_secret,
        });

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Token request failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!("Token request HTTP {}: {}", status, text));
        }

        let json: Value = serde_json::from_str(&text)
            .map_err(|e| format!("Token parse error: {}", e))?;

        let token = json["accessToken"]
            .as_str()
            .ok_or_else(|| format!("No accessToken: {}", text))?
            .to_string();

        let expire = json["expireIn"].as_u64().unwrap_or(TOKEN_VALIDITY_SECS);
        let expires_at =
            Instant::now() + Duration::from_secs(expire.saturating_sub(TOKEN_REFRESH_MARGIN_SECS));

        *self.token_cache.write().await = Some(TokenCache {
            access_token: token.clone(),
            expires_at,
        });

        ulog_info!("[dingtalk] Token refreshed, expires in {}s", expire);
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
            req = req.header("x-acs-dingtalk-access-token", &token);
            if let Some(b) = body {
                req = req.json(b);
            }

            let resp = req
                .send()
                .await
                .map_err(|e| format!("DingTalk API error: {}", e))?;
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();

            if status.as_u16() == 401 && retries == 0 {
                ulog_warn!("[dingtalk] Got 401, refreshing token");
                *self.token_cache.write().await = None;
                retries += 1;
                continue;
            }

            if !status.is_success() {
                return Err(format!("DingTalk API HTTP {}: {}", status, text));
            }

            return Ok(serde_json::from_str(&text).unwrap_or_else(|_| json!({})));
        }
    }

    // ── Bot info ──────────────────────────────────────────────────────────────

    async fn get_bot_info(&self) -> Result<String, String> {
        // Verify by fetching a token; DingTalk has no direct "get bot info" endpoint.
        let _token = self.get_token().await?;
        let id_preview: String = self.client_id.chars().take(8).collect();
        let name = format!("DingTalk Bot ({}...)", id_preview);
        *self.bot_name.write().await = Some(name.clone());
        Ok(name)
    }

    // ── Message sending ───────────────────────────────────────────────────────

    async fn send_private_message(
        &self,
        user_id: &str,
        text: &str,
    ) -> Result<Option<String>, String> {
        let url = format!("{}/v1.0/robot/oToMessages/batchSend", DINGTALK_API_BASE);
        let body = json!({
            "robotCode": self.robot_code,
            "userIds": [user_id],
            "msgKey": "sampleMarkdown",
            "msgParam": serde_json::to_string(&json!({
                "title": "AI 助手",
                "text": text,
            })).unwrap_or_default(),
        });
        let resp = self.api_call("POST", &url, Some(&body)).await?;
        Ok(resp["processQueryKey"].as_str().map(String::from))
    }

    async fn send_group_message(
        &self,
        conversation_id: &str,
        text: &str,
    ) -> Result<Option<String>, String> {
        let url = format!("{}/v1.0/robot/groupMessages/send", DINGTALK_API_BASE);
        let body = json!({
            "robotCode": self.robot_code,
            "openConversationId": conversation_id,
            "msgKey": "sampleMarkdown",
            "msgParam": serde_json::to_string(&json!({
                "title": "AI 助手",
                "text": text,
            })).unwrap_or_default(),
        });
        let resp = self.api_call("POST", &url, Some(&body)).await?;
        Ok(resp["processQueryKey"].as_str().map(String::from))
    }

    /// Unified send: group chat IDs are "group:{openConversationId}", private = raw staffId.
    async fn send_text_message(
        &self,
        chat_id: &str,
        text: &str,
    ) -> Result<Option<String>, String> {
        if let Some(group_id) = chat_id.strip_prefix("group:") {
            self.send_group_message(group_id, text).await
        } else {
            self.send_private_message(chat_id, text).await
        }
    }

    /// Edit: AI Card streaming update. Returns Err for non-card mode.
    async fn edit_text_message(
        &self,
        chat_id: &str,
        _message_id: &str,
        text: &str,
    ) -> Result<(), String> {
        if !self.use_ai_card {
            return Err("DingTalk regular messages cannot be edited".to_string());
        }

        let card_state = {
            let cards = self.active_cards.lock().await;
            cards
                .get(chat_id)
                .map(|c| (c.out_track_id.clone(), c.last_content.clone()))
        };

        let Some((out_track_id, last_content)) = card_state else {
            return Err("No active AI Card for this chat".to_string());
        };

        if text == last_content {
            return Ok(());
        }

        let url = format!("{}/v1.0/card/streaming", DINGTALK_API_BASE);
        let body = json!({
            "outTrackId": out_track_id,
            "key": "content",
            "content": text,
            "isFull": true,
            "isFinalize": false,
            "guid": uuid::Uuid::new_v4().to_string(),
        });

        self.api_call("PUT", &url, Some(&body)).await?;

        if let Some(card) = self.active_cards.lock().await.get_mut(chat_id) {
            card.last_content = text.to_string();
        }

        Ok(())
    }

    /// Create a new AI Card and return the outTrackId.
    async fn create_ai_card(
        &self,
        chat_id: &str,
        initial_text: &str,
    ) -> Result<String, String> {
        let template_id = self
            .card_template_id
            .as_deref()
            .ok_or("AI Card template ID not configured")?;

        let out_track_id = uuid::Uuid::new_v4().to_string();

        let (open_space_id, im_group_model, im_robot_model) =
            if let Some(group_id) = chat_id.strip_prefix("group:") {
                (
                    format!("dtv1.card//IM_GROUP.{}", group_id),
                    Some(json!({ "robotCode": self.robot_code })),
                    None,
                )
            } else {
                (
                    format!("dtv1.card//IM_ROBOT.{}", chat_id),
                    None,
                    Some(json!({ "robotCode": self.robot_code })),
                )
            };

        let url = format!(
            "{}/v1.0/card/instances/createAndDeliver",
            DINGTALK_API_BASE
        );
        let mut body = json!({
            "cardTemplateId": template_id,
            "outTrackId": out_track_id,
            "cardData": { "cardParamMap": { "content": initial_text } },
            "openSpaceId": open_space_id,
            "imGroupOpenDeliverModel": {},
            "imRobotOpenDeliverModel": {},
            "callbackType": "STREAM",
        });
        if let Some(m) = im_group_model {
            body["imGroupOpenDeliverModel"] = m;
        }
        if let Some(m) = im_robot_model {
            body["imRobotOpenDeliverModel"] = m;
        }

        self.api_call("POST", &url, Some(&body)).await?;

        self.active_cards.lock().await.insert(
            chat_id.to_string(),
            ActiveCardState {
                out_track_id: out_track_id.clone(),
                last_content: initial_text.to_string(),
            },
        );

        ulog_info!(
            "[dingtalk] Created AI Card for {}: outTrackId={}",
            chat_id,
            out_track_id
        );
        Ok(out_track_id)
    }

    // ── Group discovery ───────────────────────────────────────────────────────

    async fn register_new_group(&self, chat_id: &str, chat_title: Option<&str>) {
        let group_name = chat_title
            .map(String::from)
            .unwrap_or_else(|| chat_id.to_string());

        ulog_info!("[dingtalk] New group discovered: {}", chat_id);

        let perm = GroupPermission {
            group_id: chat_id.to_string(),
            group_name,
            platform: ImPlatform::Dingtalk,
            status: GroupPermissionStatus::Pending,
            discovered_at: chrono::Utc::now().to_rfc3339(),
        };

        let mut perms = self.group_permissions.write().await;
        if !perms.iter().any(|p| p.group_id == chat_id) {
            perms.push(perm);
        }
    }

    // ── WebSocket connection ──────────────────────────────────────────────────

    pub async fn ws_listen_loop(
        &self,
        mut shutdown_rx: tokio::sync::watch::Receiver<bool>,
    ) {
        let mut backoff_secs = WS_INITIAL_BACKOFF_SECS;

        loop {
            if *shutdown_rx.borrow() {
                break;
            }

            let conn_start = Instant::now();
            match self.ws_connect_and_listen(&mut shutdown_rx).await {
                Ok(()) => {
                    ulog_info!("[dingtalk] WS connection closed gracefully");
                    backoff_secs = WS_INITIAL_BACKOFF_SECS;
                }
                Err(e) => {
                    ulog_warn!("[dingtalk] WS connection error: {}", e);
                    if conn_start.elapsed() > Duration::from_secs(30) {
                        backoff_secs = WS_INITIAL_BACKOFF_SECS;
                    }
                }
            }

            if *shutdown_rx.borrow() {
                break;
            }

            ulog_info!("[dingtalk] Reconnecting in {}s...", backoff_secs);
            tokio::select! {
                _ = sleep(Duration::from_secs(backoff_secs)) => {}
                _ = shutdown_rx.changed() => { if *shutdown_rx.borrow() { break; } }
            }
            backoff_secs = (backoff_secs * 2).min(WS_MAX_BACKOFF_SECS);
        }

        // Flush dedup cache
        if let Some(path) = &self.dedup_persist_path {
            let snapshot = self.dedup_cache.lock().await.clone();
            save_dedup_cache_to_disk(path, &snapshot);
        }

        ulog_info!("[dingtalk] WS listen loop exited");
    }

    async fn ws_connect_and_listen(
        &self,
        shutdown_rx: &mut tokio::sync::watch::Receiver<bool>,
    ) -> Result<(), String> {
        // Register Stream connection to get endpoint + ticket
        let register_url = format!("{}/v1.0/gateway/connections/open", DINGTALK_API_BASE);
        let register_body = json!({
            "clientId": self.client_id,
            "clientSecret": self.client_secret,
            "subscriptions": [
                { "type": "CALLBACK", "topic": "/v1.0/im/bot/messages/get" },
                { "type": "CALLBACK", "topic": "/v1.0/card/instances/callback" },
                { "type": "EVENT", "topic": "*" },
            ],
        });

        let resp = self
            .client
            .post(&register_url)
            .json(&register_body)
            .send()
            .await
            .map_err(|e| format!("Stream register failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!("Stream register HTTP {}: {}", status, text));
        }

        let json: Value = serde_json::from_str(&text)
            .map_err(|e| format!("Stream register parse error: {}", e))?;

        let endpoint = json["endpoint"]
            .as_str()
            .ok_or("No endpoint in response")?;
        let ticket = json["ticket"].as_str().ok_or("No ticket in response")?;

        let ws_url = format!("{}?ticket={}", endpoint, ticket);
        ulog_info!("[dingtalk] Connecting to Stream endpoint...");

        use tokio_tungstenite::tungstenite::Message as WsMessage;
        let (ws_stream, _) = tokio_tungstenite::connect_async(&ws_url)
            .await
            .map_err(|e| format!("WS connect failed: {}", e))?;

        ulog_info!("[dingtalk] WebSocket connected");

        let (mut ws_write, mut ws_read) = ws_stream.split();
        let mut last_activity = tokio::time::Instant::now();
        let mut ping_interval =
            tokio::time::interval(Duration::from_secs(WS_PING_INTERVAL_SECS));
        ping_interval.tick().await;

        loop {
            let timeout_at = last_activity + Duration::from_secs(WS_READ_TIMEOUT_SECS);
            tokio::select! {
                biased;
                msg = ws_read.next() => {
                    match msg {
                        Some(Ok(WsMessage::Text(text))) => {
                            last_activity = tokio::time::Instant::now();
                            self.handle_ws_text_frame(&text, &mut ws_write).await;
                        }
                        Some(Ok(WsMessage::Ping(data))) => {
                            let _ = ws_write.send(WsMessage::Pong(data)).await;
                        }
                        Some(Ok(WsMessage::Close(_))) => {
                            ulog_info!("[dingtalk] WS received Close frame");
                            return Ok(());
                        }
                        Some(Err(e)) => {
                            return Err(format!("WS read error: {}", e));
                        }
                        None => {
                            return Ok(());
                        }
                        _ => {}
                    }
                }
                _ = tokio::time::sleep_until(timeout_at) => {
                    return Err(format!(
                        "WS read timeout ({}s, dead connection)",
                        WS_READ_TIMEOUT_SECS
                    ));
                }
                _ = ping_interval.tick() => {
                    if let Err(e) = ws_write.send(WsMessage::Ping(vec![])).await {
                        return Err(format!("WS ping failed: {}", e));
                    }
                }
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        ulog_info!("[dingtalk] Shutdown during WS listen");
                        let _ = ws_write.send(WsMessage::Close(None)).await;
                        return Ok(());
                    }
                }
            }
        }
    }

    async fn handle_ws_text_frame(
        &self,
        text: &str,
        ws_write: &mut futures::stream::SplitSink<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
            >,
            tokio_tungstenite::tungstenite::Message,
        >,
    ) {
        use tokio_tungstenite::tungstenite::Message as WsMessage;

        let frame: Value = match serde_json::from_str(text) {
            Ok(v) => v,
            Err(e) => {
                ulog_warn!("[dingtalk] Failed to parse WS frame: {}", e);
                return;
            }
        };

        let frame_type = frame["type"].as_str().unwrap_or("");
        let headers = &frame["headers"];
        let message_id = headers["messageId"].as_str().unwrap_or("");
        let topic = headers["topic"].as_str().unwrap_or("");

        // SYSTEM frames (ping/disconnect)
        if frame_type == "SYSTEM" {
            if topic == "ping" {
                let pong = json!({
                    "code": 200,
                    "headers": frame["headers"],
                    "message": "OK",
                    "data": frame["data"],
                });
                let _ = ws_write
                    .send(WsMessage::Text(
                        serde_json::to_string(&pong).unwrap_or_default().into(),
                    ))
                    .await;
            }
            return;
        }

        // Send ACK for CALLBACK and EVENT frames
        if (frame_type == "CALLBACK" || frame_type == "EVENT") && !message_id.is_empty() {
            let ack_data = if frame_type == "EVENT" {
                serde_json::to_string(&json!({"status": "SUCCESS", "message": "success"}))
                    .unwrap_or_else(|_| "{}".to_string())
            } else {
                "{}".to_string()
            };
            let ack = json!({
                "code": 200,
                "headers": { "contentType": "application/json", "messageId": message_id },
                "message": "OK",
                "data": ack_data,
            });
            let _ = ws_write
                .send(WsMessage::Text(
                    serde_json::to_string(&ack).unwrap_or_default().into(),
                ))
                .await;
        }

        // Handle EVENT frames (group lifecycle)
        if frame_type == "EVENT" {
            let event_type = headers["eventType"].as_str().unwrap_or("");
            if let Some(data_str) = frame["data"].as_str() {
                if let Ok(data) = serde_json::from_str::<Value>(data_str) {
                    self.handle_event_frame(event_type, &data).await;
                }
            }
            return;
        }

        // Route CALLBACK frames
        match topic {
            "/v1.0/im/bot/messages/get" | "/v1.0/im/bot/messages/get/" => {
                if let Some(data_str) = frame["data"].as_str() {
                    if let Ok(data) = serde_json::from_str::<Value>(data_str) {
                        self.handle_bot_message(&data).await;
                    }
                }
            }
            _ => {
                log::debug!("[dingtalk] Unhandled topic: {}", topic);
            }
        }
    }

    async fn handle_bot_message(&self, data: &Value) {
        let msg_id = data["msgId"].as_str().unwrap_or("");
        if msg_id.is_empty() {
            return;
        }

        if !self.dedup_check(msg_id).await {
            return;
        }

        let sender_staff_id = data["senderStaffId"].as_str().unwrap_or("").to_string();
        let sender_nick = data["senderNick"].as_str();
        let conversation_type = data["conversationType"].as_str().unwrap_or("1");

        let msg_type = data["msgtype"].as_str().unwrap_or("text");
        let text_content = match msg_type {
            "text" => data["text"]["content"]
                .as_str()
                .unwrap_or("")
                .trim()
                .to_string(),
            "richText" => data["content"]["richText"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| item["text"].as_str())
                        .collect::<Vec<_>>()
                        .join("")
                })
                .unwrap_or_default(),
            _ => {
                log::debug!("[dingtalk] Unsupported message type: {}", msg_type);
                return;
            }
        };

        if text_content.is_empty() {
            return;
        }

        let (source_type, chat_id, is_mention) = if conversation_type == "2" {
            // Group chat
            let open_conv_id = data["conversationId"].as_str().unwrap_or("");
            let chat_id_full = format!("group:{}", open_conv_id);

            // Detect new group
            let is_new = {
                let mut groups = self.known_groups.lock().await;
                groups.insert(chat_id_full.clone())
            };
            if is_new {
                let title = data["conversationTitle"].as_str();
                self.register_new_group(&chat_id_full, title).await;
            }

            let is_in_at_list = data["isInAtList"]
                .as_bool()
                .or_else(|| data["isInAtList"].as_str().map(|s| s == "true"))
                .unwrap_or(false);

            (ImSourceType::Group, chat_id_full, is_in_at_list)
        } else {
            // Private chat
            (ImSourceType::Private, sender_staff_id.clone(), true)
        };

        // Group activation check
        if source_type == ImSourceType::Group
            && self.group_activation != "always"
            && !is_mention
        {
            return;
        }

        // User allowlist check for private messages
        if source_type == ImSourceType::Private {
            let allowed = self.allowed_users.read().await;
            if !allowed.is_empty() && !allowed.iter().any(|u| u == &sender_staff_id) {
                ulog_info!(
                    "[dingtalk] Message from {} blocked by allowlist",
                    sender_staff_id
                );
                return;
            }
        }

        let msg = ImMessage {
            chat_id,
            message_id: msg_id.to_string(),
            text: text_content,
            sender_id: sender_staff_id,
            sender_name: sender_nick.map(String::from),
            source_type,
            platform: ImPlatform::Dingtalk,
            timestamp: chrono::Utc::now(),
            is_mention,
            reply_to_bot: false,
        };

        ulog_info!(
            "[dingtalk] Message from {} ({}): {}...",
            msg.sender_name.as_deref().unwrap_or(&msg.sender_id),
            if msg.source_type == ImSourceType::Group { "group" } else { "private" },
            &msg.text[..msg.text.len().min(80)],
        );

        if let Err(e) = self.msg_tx.send(msg).await {
            ulog_error!("[dingtalk] Failed to forward message: {}", e);
        }
    }

    async fn handle_event_frame(&self, event_type: &str, data: &Value) {
        match event_type {
            "im_cool_app_install" => {
                let open_conv_id = data["openConversationId"].as_str().unwrap_or("");
                if open_conv_id.is_empty() {
                    return;
                }
                let chat_id = format!("group:{}", open_conv_id);
                let is_new = {
                    let mut groups = self.known_groups.lock().await;
                    groups.insert(chat_id.clone())
                };
                if is_new {
                    let operator = data["operator"].as_str().unwrap_or("");
                    ulog_info!("[dingtalk] Bot added to group via event: {}", chat_id);
                    self.register_new_group(&chat_id, None).await;
                    let _ = operator; // available for future use
                }
            }
            "chat_disband" => {
                let raw = data["ChatId"]
                    .as_str()
                    .or_else(|| data["chatId"].as_str())
                    .or_else(|| data["openConversationId"].as_str())
                    .unwrap_or("");
                if !raw.is_empty() {
                    let chat_id = format!("group:{}", raw);
                    self.known_groups.lock().await.remove(&chat_id);
                    let mut perms = self.group_permissions.write().await;
                    perms.retain(|p| p.group_id != chat_id);
                }
            }
            _ => {
                log::debug!("[dingtalk] Unhandled event type: {}", event_type);
            }
        }
    }
}

// ── Trait implementations ─────────────────────────────────────────────────────

#[async_trait]
impl ImAdapter for DingtalkAdapter {
    async fn verify_connection(&self) -> AdapterResult<String> {
        self.get_bot_info().await
    }

    async fn register_commands(&self) -> AdapterResult<()> {
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
impl ImStreamAdapter for DingtalkAdapter {
    async fn send_message_returning_id(
        &self,
        chat_id: &str,
        text: &str,
    ) -> AdapterResult<Option<String>> {
        if self.use_ai_card && self.card_template_id.is_some() {
            match self.create_ai_card(chat_id, text).await {
                Ok(out_track_id) => return Ok(Some(out_track_id)),
                Err(e) => {
                    ulog_warn!(
                        "[dingtalk] AI Card creation failed, falling back: {}",
                        e
                    );
                }
            }
        }
        // Non-card mode: don't send here. Return None so stream pipeline
        // sends the complete text at block-end via finalize_block → send_message.
        Ok(None)
    }

    async fn edit_message(
        &self,
        chat_id: &str,
        message_id: &str,
        text: &str,
    ) -> AdapterResult<()> {
        self.edit_text_message(chat_id, message_id, text).await
    }

    async fn delete_message(
        &self,
        _chat_id: &str,
        _message_id: &str,
    ) -> AdapterResult<()> {
        // DingTalk Robot messages cannot be recalled via API
        Ok(())
    }

    fn max_message_length(&self) -> usize {
        MAX_MESSAGE_LENGTH
    }

    fn preferred_throttle_ms(&self) -> u64 {
        1500
    }
}

// ── Verify credentials (for Tauri command) ────────────────────────────────────

pub async fn verify_dingtalk_credentials(
    client_id: &str,
    client_secret: &str,
) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let url = format!("{}/v1.0/oauth2/accessToken", DINGTALK_API_BASE);
    let body = json!({ "appKey": client_id, "appSecret": client_secret });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Verification request failed: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("DingTalk auth failed (HTTP {}): {}", status, text));
    }

    let json: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Response parse error: {}", e))?;

    if json["accessToken"].as_str().is_some() {
        let id_preview: String = client_id.chars().take(8).collect();
        Ok(format!("DingTalk Bot (ClientID: {}...)", id_preview))
    } else {
        Err(format!("DingTalk credentials invalid: {}", text))
    }
}
