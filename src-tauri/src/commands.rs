use std::path::PathBuf;
use std::sync::Arc;

use crate::heartbeat::HeartbeatManager;
use crate::sidecar::{self, ManagedSidecarState, SidecarOwner, GLOBAL_SIDECAR_ID};

pub type SidecarState = ManagedSidecarState;
pub type HeartbeatManagerState = Arc<HeartbeatManager>;

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

// ── Heartbeat Commands ──

/// Sync heartbeat configuration for a single agent (start/stop/restart runner).
#[tauri::command]
pub async fn cmd_heartbeat_sync(
    app_handle: tauri::AppHandle,
    agent_id: String,
    state: tauri::State<'_, HeartbeatManagerState>,
) -> Result<(), String> {
    // Read latest agent config from disk
    let config_path = dirs::home_dir()
        .ok_or("No home dir")?
        .join(".soagents")
        .join("config.json");
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Read config: {}", e))?;
    let config: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Parse: {}", e))?;

    let agents = config
        .get("agents")
        .and_then(|a| a.as_array())
        .ok_or("No agents array")?;

    let agent = agents
        .iter()
        .find(|a| a.get("id").and_then(|v| v.as_str()) == Some(&agent_id))
        .ok_or_else(|| format!("Agent {} not found", agent_id))?;

    let agent_config: crate::im::types::AgentConfigRust =
        serde_json::from_value(agent.clone()).map_err(|e| format!("Parse agent: {}", e))?;

    state
        .sync_agent(
            &agent_id,
            agent_config.heartbeat,
            &agent_config.workspace_path,
            agent_config.memory_auto_update,
            &app_handle,
        )
        .await;

    Ok(())
}

/// Resume a paused heartbeat runner.
#[tauri::command]
pub async fn cmd_heartbeat_resume(
    agent_id: String,
    state: tauri::State<'_, HeartbeatManagerState>,
) -> Result<(), String> {
    state.resume(&agent_id).await;
    Ok(())
}

/// Get heartbeat status for a single agent.
#[tauri::command]
pub async fn cmd_heartbeat_status(
    agent_id: String,
    state: tauri::State<'_, HeartbeatManagerState>,
) -> Result<Option<crate::heartbeat::HeartbeatRunStatus>, String> {
    Ok(state.get_status(&agent_id).await)
}

/// Get heartbeat status for all agents.
#[tauri::command]
pub async fn cmd_heartbeat_all_status(
    state: tauri::State<'_, HeartbeatManagerState>,
) -> Result<Vec<crate::heartbeat::HeartbeatRunStatus>, String> {
    Ok(state.get_all_status().await)
}

// ── OpenClaw plugin management ─────────────────────────────────────────────

/// Install an OpenClaw plugin from an npm spec.
/// Returns an `InstalledPlugin`-shaped JSON object on success.
#[tauri::command]
pub async fn cmd_install_openclaw_plugin(
    app_handle: tauri::AppHandle,
    npm_spec: String,
) -> Result<serde_json::Value, String> {
    crate::openclaw::install_plugin(&app_handle, &npm_spec).await
}

/// Uninstall an OpenClaw plugin by plugin_id.
/// Returns error if any running bot still references it.
#[tauri::command]
pub async fn cmd_uninstall_openclaw_plugin(plugin_id: String) -> Result<(), String> {
    crate::openclaw::uninstall_plugin(&plugin_id).await
}

/// List every installed OpenClaw plugin.
/// Returns an array of `InstalledPlugin`-shaped JSON objects.
#[tauri::command]
pub async fn cmd_list_openclaw_plugins() -> Result<Vec<serde_json::Value>, String> {
    crate::openclaw::list_plugins().await
}

// ── Dev-only smoke test for Plugin Bridge (stage 1.3c) ─────────────
//
// These commands exist to validate the Plugin Bridge runtime before the
// full BridgeAdapter (stage 1.3d) is wired up. They'll be replaced by
// the real IM channel flow once 1.3d lands. Keep them as debug tools.

/// Global holder so spawned BridgeProcess instances aren't dropped
/// (which would kill them). Stage 1.3d will replace this with a proper
/// `BridgeSenderEntry` registry keyed by bot_id.
static SMOKE_BRIDGES: std::sync::OnceLock<
    std::sync::Mutex<Vec<crate::openclaw::bridge_process::BridgeProcess>>,
> = std::sync::OnceLock::new();

/// Spawn a Plugin Bridge for an installed plugin. Returns the port on
/// success. Kept process is held in a global Vec so it stays alive
/// between command calls.
#[tauri::command]
pub async fn cmd_openclaw_spawn_bridge_test(
    app_handle: tauri::AppHandle,
    plugin_id: String,
    port: u16,
) -> Result<u16, String> {
    let plugin_dir = crate::openclaw::paths::plugin_install_dir(&plugin_id);
    if !plugin_dir.exists() {
        return Err(format!(
            "Plugin '{}' not installed (expected at {:?})",
            plugin_id, plugin_dir
        ));
    }

    let bridge = crate::openclaw::bridge_process::spawn_plugin_bridge(
        &app_handle,
        plugin_dir.to_string_lossy().as_ref(),
        port,
        0, // rust_port — stage 1.3d fills this in
        &format!("smoke-{}", plugin_id),
        None,
    )
    .await?;

    let port = bridge.port;
    SMOKE_BRIDGES
        .get_or_init(|| std::sync::Mutex::new(Vec::new()))
        .lock()
        .map_err(|e| format!("smoke lock: {}", e))?
        .push(bridge);

    Ok(port)
}

/// Kill every Bridge spawned via `cmd_openclaw_spawn_bridge_test`.
#[tauri::command]
pub async fn cmd_openclaw_kill_all_smoke_bridges() -> Result<usize, String> {
    let Some(cell) = SMOKE_BRIDGES.get() else {
        return Ok(0);
    };
    let mut guard = cell.lock().map_err(|e| format!("smoke lock: {}", e))?;
    let count = guard.len();
    for proc in guard.drain(..) {
        let mut proc = proc;
        proc.kill_sync();
    }
    Ok(count)
}
