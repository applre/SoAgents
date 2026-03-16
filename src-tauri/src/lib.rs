// SoAgents Tauri Application
// Phase 3: Bun Sidecar 进程管理

mod sidecar;
mod commands;
mod proxy;
mod proxy_config;
mod sse_proxy;
mod updater;
mod scheduler;
mod local_http;
pub mod logger;

use std::sync::{Arc, Mutex};
use commands::SidecarState;
use tauri_plugin_autostart::MacosLauncher;
use tokio::sync::RwLock;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sidecar_state: SidecarState = Arc::new(Mutex::new(sidecar::SidecarManager::new()));
    let scheduler_state: scheduler::SchedulerState = Arc::new(RwLock::new(scheduler::SchedulerManager::new()));

    // 保存一份 Arc clone 用于退出清理
    let cleanup_state = Arc::clone(&sidecar_state);
    let scheduler_cleanup = scheduler_state.clone();
    let scheduler_setup = scheduler_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(sidecar_state)
        .manage(scheduler_state)
        .manage(sse_proxy::SseProxyState::new())
        .invoke_handler(tauri::generate_handler![
            commands::cmd_start_session_sidecar,
            commands::cmd_stop_session_sidecar,
            commands::cmd_get_session_server_url,
            commands::cmd_start_global_sidecar,
            commands::cmd_stop_all_sidecars,
            commands::cmd_get_default_workspace,
            commands::cmd_list_running_sidecars,
            commands::cmd_open_in_finder,
            commands::cmd_propagate_proxy,
            proxy::cmd_proxy_http,
            sse_proxy::cmd_start_sse_proxy,
            sse_proxy::cmd_stop_sse_proxy,
            updater::check_and_download_update,
            updater::restart_app,
            updater::test_update_connectivity,
            updater::cmd_shutdown_for_update,
            scheduler::cmd_scheduler_list_tasks,
            scheduler::cmd_scheduler_create_task,
            scheduler::cmd_scheduler_update_task,
            scheduler::cmd_scheduler_delete_task,
            scheduler::cmd_scheduler_toggle_task,
            scheduler::cmd_scheduler_run_task,
            scheduler::cmd_scheduler_list_runs,
            scheduler::cmd_scheduler_list_all_runs,
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

            // Start scheduler
            let scheduler_app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                {
                    let mut mgr = scheduler_setup.write().await;
                    mgr.set_app_handle(scheduler_app_handle);
                    mgr.start().await;
                }
                scheduler::scheduler_loop(scheduler_setup).await;
            });

            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Ok(mut manager) = cleanup_state.lock() {
                    ulog_info!("[App] Stopping all sidecars on window close");
                    manager.stop_all();
                }

                let scheduler_clone = scheduler_cleanup.clone();
                tauri::async_runtime::spawn(async move {
                    let mut mgr = scheduler_clone.write().await;
                    mgr.stop();
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
