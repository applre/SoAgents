use std::path::PathBuf;

use crate::sidecar::{self, ManagedSidecarState, SidecarOwner, GLOBAL_SIDECAR_ID};

pub type SidecarState = ManagedSidecarState;

#[tauri::command]
pub fn cmd_start_session_sidecar(
    app_handle: tauri::AppHandle,
    session_id: String,
    agent_dir: Option<String>,
    state: tauri::State<'_, SidecarState>,
) -> Result<(), String> {
    let bun_path = sidecar::find_bun_executable(&app_handle)?;
    let script_path = sidecar::find_server_script(&app_handle)?;

    let owner = SidecarOwner::Session(session_id.clone());
    let agent_path = agent_dir.map(PathBuf::from);
    sidecar::start_sidecar(&state, session_id, agent_path, &bun_path, &script_path, Some(owner))?;
    Ok(())
}

#[tauri::command]
pub fn cmd_stop_session_sidecar(
    session_id: String,
    state: tauri::State<'_, SidecarState>,
) -> Result<(), String> {
    let owner = SidecarOwner::Session(session_id.clone());
    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.release_sidecar(&session_id, &owner)?;
    Ok(())
}

#[tauri::command]
pub fn cmd_get_session_server_url(
    session_id: String,
    state: tauri::State<'_, SidecarState>,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager
        .get_port(&session_id)
        .map(|port| format!("http://127.0.0.1:{}", port))
        .ok_or_else(|| format!("No sidecar running for session '{}'", session_id))
}

#[tauri::command]
pub fn cmd_start_global_sidecar(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, SidecarState>,
) -> Result<(), String> {
    let bun_path = sidecar::find_bun_executable(&app_handle)?;
    let script_path = sidecar::find_server_script(&app_handle)?;

    sidecar::start_sidecar(&state, GLOBAL_SIDECAR_ID.to_string(), None, &bun_path, &script_path, None)?;
    Ok(())
}

#[tauri::command]
pub fn cmd_stop_all_sidecars(state: tauri::State<'_, SidecarState>) -> Result<(), String> {
    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.stop_all();
    Ok(())
}

#[tauri::command]
pub fn cmd_get_default_workspace() -> Result<String, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Cannot determine HOME directory".to_string())?;
    let workspace = home.join(".soagents").join("workspace");
    std::fs::create_dir_all(&workspace)
        .map_err(|e| format!("Failed to create default workspace: {}", e))?;
    workspace
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path encoding".to_string())
}

#[tauri::command]
pub fn cmd_list_running_sidecars(
    state: tauri::State<'_, SidecarState>,
) -> Result<Vec<(String, Option<String>, u16)>, String> {
    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.list_running())
}

#[tauri::command]
pub fn cmd_open_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open in Finder: {}", e))?;
    Ok(())
}

/// Propagate proxy settings from disk config to all running Sidecars
#[tauri::command]
pub async fn cmd_propagate_proxy(
    state: tauri::State<'_, SidecarState>,
) -> Result<serde_json::Value, String> {
    let payload = match crate::proxy_config::read_proxy_settings() {
        Some(s) => match crate::proxy_config::get_proxy_url(&s) {
            Ok(_) => serde_json::json!({
                "enabled": true,
                "protocol": s.protocol.unwrap_or_else(|| "http".into()),
                "host": s.host.unwrap_or_else(|| "127.0.0.1".into()),
                "port": s.port.unwrap_or(7890),
            }),
            Err(_) => serde_json::json!({ "enabled": false }),
        },
        None => serde_json::json!({ "enabled": false }),
    };

    let client = crate::local_http::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let ports = {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        manager.get_all_active_ports()
    };

    let (mut ok, mut fail) = (0u32, 0u32);
    for port in &ports {
        let url = format!("http://127.0.0.1:{}/api/proxy/set", port);
        match client.post(&url).json(&payload).send().await {
            Ok(r) if r.status().is_success() => {
                log::info!("[proxy-propagate] Updated sidecar on port {}", port);
                ok += 1;
            }
            _ => {
                log::warn!("[proxy-propagate] Failed to update sidecar on port {}", port);
                fail += 1;
            }
        }
    }

    log::info!("[proxy-propagate] Done: {} updated, {} failed", ok, fail);
    Ok(serde_json::json!({ "updated": ok, "failed": fail }))
}

#[tauri::command]
pub fn cmd_start_background_completion(
    app_handle: tauri::AppHandle,
    session_id: String,
    state: tauri::State<'_, SidecarState>,
) -> Result<sidecar::BackgroundCompletionResult, String> {
    sidecar::start_background_completion(&app_handle, &state, &session_id)
}

#[tauri::command]
pub fn cmd_cancel_background_completion(
    session_id: String,
    state: tauri::State<'_, SidecarState>,
) -> Result<bool, String> {
    sidecar::cancel_background_completion(&state, &session_id)
}

#[tauri::command]
pub fn cmd_get_background_sessions(
    state: tauri::State<'_, SidecarState>,
) -> Result<Vec<String>, String> {
    Ok(sidecar::get_background_session_ids(&state))
}
