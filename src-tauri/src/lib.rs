// SoAgents Tauri Application
// Phase 3: Bun Sidecar 进程管理

mod sidecar;
mod commands;
mod proxy;
mod sse_proxy;

use std::sync::{Arc, Mutex};
use commands::SidecarState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sidecar_state: SidecarState = Arc::new(Mutex::new(sidecar::SidecarManager::new()));

    // 保存一份 Arc clone 用于退出清理
    let cleanup_state = Arc::clone(&sidecar_state);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(sidecar_state)
        .manage(sse_proxy::SseProxyState::new())
        .invoke_handler(tauri::generate_handler![
            commands::cmd_start_tab_sidecar,
            commands::cmd_stop_tab_sidecar,
            commands::cmd_get_tab_server_url,
            commands::cmd_start_global_sidecar,
            commands::cmd_stop_all_sidecars,
            proxy::cmd_proxy_http,
            sse_proxy::cmd_start_sse_proxy,
            sse_proxy::cmd_stop_sse_proxy,
        ])
        .setup(|app| {
            // Initialize logging
            use tauri_plugin_log::{Target, TargetKind};

            let log_level = if cfg!(debug_assertions) {
                log::LevelFilter::Debug
            } else {
                log::LevelFilter::Info
            };

            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .target(Target::new(TargetKind::Stdout))
                    .build(),
            )?;

            // Open DevTools in debug builds
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            log::info!("[App] SoAgents started successfully");
            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Ok(mut manager) = cleanup_state.lock() {
                    log::info!("[App] Stopping all sidecars on window close");
                    manager.stop_all();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
