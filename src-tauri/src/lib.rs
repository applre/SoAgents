// SoAgents Tauri Application
// Phase 3: Bun Sidecar 进程管理

mod sidecar;
mod commands;
mod proxy;
mod sse_proxy;
mod updater;
pub mod logger;

use std::sync::{Arc, Mutex};
use commands::SidecarState;
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sidecar_state: SidecarState = Arc::new(Mutex::new(sidecar::SidecarManager::new()));

    // 保存一份 Arc clone 用于退出清理
    let cleanup_state = Arc::clone(&sidecar_state);

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(sidecar_state)
        .manage(sse_proxy::SseProxyState::new())
        .invoke_handler(tauri::generate_handler![
            commands::cmd_start_tab_sidecar,
            commands::cmd_stop_tab_sidecar,
            commands::cmd_get_tab_server_url,
            commands::cmd_start_global_sidecar,
            commands::cmd_stop_all_sidecars,
            commands::cmd_get_default_workspace,
            commands::cmd_open_in_finder,
            proxy::cmd_proxy_http,
            sse_proxy::cmd_start_sse_proxy,
            sse_proxy::cmd_stop_sse_proxy,
            updater::check_and_download_update,
            updater::restart_app,
            updater::test_update_connectivity,
            updater::cmd_shutdown_for_update,
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

            // 初始化统一日志系统（保存全局 AppHandle）
            logger::init_app_handle(app.handle());

            ulog_info!("[App] SoAgents started successfully");

            sidecar::cleanup_stale_sidecars();

            // Spawn background update check
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                updater::check_update_on_startup(app_handle).await;
            });

            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Ok(mut manager) = cleanup_state.lock() {
                    ulog_info!("[App] Stopping all sidecars on window close");
                    manager.stop_all();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
