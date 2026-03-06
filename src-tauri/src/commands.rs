use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::sidecar::{self, SidecarManager, SidecarOwner, GLOBAL_SIDECAR_ID};

pub type SidecarState = Arc<Mutex<SidecarManager>>;

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
    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.start_sidecar(session_id, agent_path, &bun_path, &script_path, Some(owner))?;
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
    let manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
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

    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.start_sidecar(GLOBAL_SIDECAR_ID.to_string(), None, &bun_path, &script_path, None)?;
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
