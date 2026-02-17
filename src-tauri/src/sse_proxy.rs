use futures_util::StreamExt;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Emitter;

pub struct SseConnection {
    cancel_tx: tokio::sync::oneshot::Sender<()>,
}

pub struct SseProxyState {
    pub connections: Mutex<HashMap<String, SseConnection>>,
}

impl SseProxyState {
    pub fn new() -> Self {
        Self { connections: Mutex::new(HashMap::new()) }
    }
}

#[tauri::command]
pub async fn cmd_start_sse_proxy(
    url: String,
    tab_id: String,
    app: AppHandle,
    state: tauri::State<'_, SseProxyState>,
) -> Result<(), String> {
    // 如果已有连接，先停止
    {
        let mut conns = state.connections.lock().unwrap();
        if let Some(old) = conns.remove(&tab_id) {
            let _ = old.cancel_tx.send(());
        }
    }

    let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();

    {
        let mut conns = state.connections.lock().unwrap();
        conns.insert(tab_id.clone(), SseConnection { cancel_tx });
    }

    let client = reqwest::Client::builder()
        .no_proxy()
        .tcp_nodelay(true)
        .http1_only()
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&url)
        .header("Accept", "text/event-stream")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    let mut current_event = String::from("message");

    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = &mut cancel_rx => break,
                chunk = stream.next() => {
                    match chunk {
                        None => break,
                        Some(Err(_)) => break,
                        Some(Ok(bytes)) => {
                            let text = String::from_utf8_lossy(&bytes);
                            buf.push_str(&text);

                            // 处理完整的 SSE 行
                            while let Some(pos) = buf.find('\n') {
                                let line = buf[..pos].trim_end_matches('\r').to_string();
                                buf.drain(..=pos);

                                if line.is_empty() {
                                    // 空行 = 事件结束，重置 event 名
                                    current_event = String::from("message");
                                } else if line.starts_with(':') {
                                    // 注释/心跳，忽略
                                } else if let Some(event) = line.strip_prefix("event: ") {
                                    current_event = event.to_string();
                                } else if let Some(data) = line.strip_prefix("data: ") {
                                    // emit 到前端
                                    let event_name = format!("sse:{}:{}", tab_id, current_event);
                                    let _ = app.emit(&event_name, data);
                                }
                            }
                        }
                    }
                }
            }
        }
        // 清理
    });

    Ok(())
}

#[tauri::command]
pub async fn cmd_stop_sse_proxy(
    tab_id: String,
    state: tauri::State<'_, SseProxyState>,
) -> Result<(), String> {
    let mut conns = state.connections.lock().unwrap();
    if let Some(conn) = conns.remove(&tab_id) {
        let _ = conn.cancel_tx.send(());
    }
    Ok(())
}
