// SoAgents Tauri Application
// Phase 3: Bun Sidecar 进程管理

mod sidecar;
mod commands;
mod proxy;
mod proxy_config;
mod sse_proxy;
mod updater;
mod scheduled_task;
mod local_http;
mod tray;
mod im;
pub mod logger;

use std::sync::{Arc, Mutex};
use std::sync::atomic::AtomicBool;
use commands::SidecarState;
use tauri::{Emitter, Listener, Manager};
use tauri_plugin_autostart::MacosLauncher;
use tokio::sync::RwLock;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sidecar_state: SidecarState = Arc::new(Mutex::new(sidecar::SidecarManager::new()));
    let scheduled_task_state: scheduled_task::ScheduledTaskState = Arc::new(RwLock::new(scheduled_task::ScheduledTaskManager::new()));
    let im_state: im::ImManagerState = Arc::new(tokio::sync::Mutex::new(im::ImManager::new()));

    let cleanup_state = Arc::clone(&sidecar_state);
    let cleanup_state_for_exit = Arc::clone(&sidecar_state);
    let scheduled_task_cleanup = scheduled_task_state.clone();
    let scheduled_task_cleanup_for_exit = scheduled_task_state.clone();
    let scheduled_task_setup = scheduled_task_state.clone();
    let im_cleanup_for_tray = im_state.clone();
    let im_cleanup_for_window = im_state.clone();
    let im_cleanup_for_exit = im_state.clone();

    // Track if cleanup has been performed to avoid duplicate cleanup
    let cleanup_done = Arc::new(AtomicBool::new(false));
    let cleanup_done_for_window = cleanup_done.clone();
    let cleanup_done_for_exit = cleanup_done.clone();
    let cleanup_done_for_tray_exit = cleanup_done.clone();

    let sidecar_state_for_tray_exit = Arc::clone(&sidecar_state);
    let scheduled_task_cleanup_for_tray_exit = scheduled_task_state.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(sidecar_state)
        .manage(scheduled_task_state)
        .manage(im_state)
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
            commands::cmd_start_background_completion,
            commands::cmd_cancel_background_completion,
            commands::cmd_get_background_sessions,
            proxy::cmd_proxy_http,
            sse_proxy::cmd_start_sse_proxy,
            sse_proxy::cmd_stop_sse_proxy,
            updater::check_and_download_update,
            updater::restart_app,
            updater::test_update_connectivity,
            updater::cmd_shutdown_for_update,
            scheduled_task::cmd_scheduled_task_list,
            scheduled_task::cmd_scheduled_task_create,
            scheduled_task::cmd_scheduled_task_update,
            scheduled_task::cmd_scheduled_task_delete,
            scheduled_task::cmd_scheduled_task_toggle,
            scheduled_task::cmd_scheduled_task_run,
            scheduled_task::cmd_scheduled_task_stop,
            scheduled_task::cmd_scheduled_task_list_runs,
            scheduled_task::cmd_scheduled_task_list_all_runs,
            im::cmd_start_agent_channel,
            im::cmd_stop_agent_channel,
            im::cmd_agent_channel_status,
            im::cmd_all_agent_channels_status,
            im::cmd_update_agent_channel_config,
            im::cmd_im_reset_session,
            im::cmd_im_verify_token,
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
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            // Initialize unified logging system
            logger::init_app_handle(app.handle());

            // Setup system tray
            if let Err(e) = tray::setup_tray(app) {
                log::error!("[App] Failed to setup system tray: {}", e);
            }

            // Setup tray exit handler (for when user confirms exit from tray menu)
            let app_handle_for_tray = app.handle().clone();
            app.listen("tray:confirm-exit", move |_| {
                log::info!("[App] Tray exit confirmed by user");
                use std::sync::atomic::Ordering::Relaxed;
                if !cleanup_done_for_tray_exit.swap(true, Relaxed) {
                    log::info!("[App] Cleaning up sidecars before exit...");
                    if let Ok(mut manager) = sidecar_state_for_tray_exit.lock() {
                        manager.stop_all();
                    }
                    im::signal_all_shutdown(&im_cleanup_for_tray);
                    let cron_clone = scheduled_task_cleanup_for_tray_exit.clone();
                    tauri::async_runtime::spawn(async move {
                        let mut mgr = cron_clone.write().await;
                        mgr.stop();
                    });
                }
                app_handle_for_tray.exit(0);
            });

            ulog_info!("[App] SoAgents started successfully");

            sidecar::cleanup_stale_sidecars();

            // Spawn background update check
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                updater::check_update_on_startup(app_handle).await;
            });

            // Start scheduled task scheduler
            let scheduled_task_app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                {
                    let mut mgr = scheduled_task_setup.write().await;
                    mgr.set_app_handle(scheduled_task_app_handle);
                    mgr.start().await;
                }
                scheduled_task::scheduled_task_loop(scheduled_task_setup).await;
            });

            Ok(())
        })
        .on_window_event(move |window, event| {
            match event {
                // Handle window close request (X button) - emit to frontend, let it decide
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    log::info!("[App] Window close requested, emitting event to frontend");
                    let _ = window.app_handle().emit("window:close-requested", ());
                    api.prevent_close();
                }
                // Clean up when window is actually destroyed
                tauri::WindowEvent::Destroyed => {
                    use std::sync::atomic::Ordering::Relaxed;
                    if !cleanup_done_for_window.swap(true, Relaxed) {
                        log::info!("[App] Window destroyed, cleaning up sidecars...");
                        if let Ok(mut manager) = cleanup_state.lock() {
                            manager.stop_all();
                        }
                        im::signal_all_shutdown(&im_cleanup_for_window);
                        let cron_clone = scheduled_task_cleanup.clone();
                        tauri::async_runtime::spawn(async move {
                            let mut mgr = cron_clone.write().await;
                            mgr.stop();
                        });
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Run with event handler to catch Cmd+Q, Dock quit, and Dock click
    app.run(move |_app_handle, event| {
        match event {
            // Handle app exit events (Cmd+Q, Dock right-click quit, etc.)
            tauri::RunEvent::ExitRequested { .. } => {
                use std::sync::atomic::Ordering::Relaxed;
                if !cleanup_done_for_exit.swap(true, Relaxed) {
                    log::info!("[App] Exit requested (Cmd+Q or Dock quit), cleaning up sidecars...");
                    if let Ok(mut manager) = cleanup_state_for_exit.lock() {
                        manager.stop_all();
                    }
                    im::signal_all_shutdown(&im_cleanup_for_exit);
                    let cron_clone = scheduled_task_cleanup_for_exit.clone();
                    tauri::async_runtime::spawn(async move {
                        let mut mgr = cron_clone.write().await;
                        mgr.stop();
                    });
                }
            }
            // Handle Dock icon click on macOS (Reopen event)
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => {
                log::info!("[App] Dock icon clicked (Reopen), showing main window");
                if let Some(window) = _app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        }
    });
}
