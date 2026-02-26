// SoAgents Auto-Updater Module
// Provides silent background update checking, downloading, and installation
//
// Flow:
// 1. App starts → wait 5s → check for update
// 2. If update available → silently download in background
// 3. Download complete → emit event to show "Restart to Update" button
// 4. User clicks button → restart and apply update
// 5. Every 30 min → periodic silent check from frontend

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

use crate::commands::SidecarState;

/// Global flag to prevent concurrent update checks/downloads
static UPDATE_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

/// RAII guard to reset UPDATE_IN_PROGRESS on drop
struct UpdateGuard;

impl Drop for UpdateGuard {
    fn drop(&mut self) {
        UPDATE_IN_PROGRESS.store(false, Ordering::SeqCst);
    }
}

/// Update information sent to the frontend
#[derive(Clone, Serialize)]
pub struct UpdateReadyInfo {
    pub version: String,
}

/// Get the update target string for the current platform
fn get_update_target() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "darwin-aarch64"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "darwin-x86_64"
    }
    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
    )))]
    {
        "unknown"
    }
}

/// Check for updates on startup and silently download if available
pub async fn check_update_on_startup(app: AppHandle) {
    // Wait 5 seconds to let the app fully initialize
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    log::info!("[updater] SoAgents started, will check for updates in 5 seconds");

    match check_and_download_silently(&app).await {
        Ok(Some(version)) => {
            log::info!(
                "[updater] Update v{} downloaded and ready to install",
                version
            );
            let info = UpdateReadyInfo {
                version: version.clone(),
            };
            match app.emit("updater:ready-to-restart", info) {
                Ok(_) => {
                    log::info!(
                        "[updater] Event emitted successfully for v{}",
                        version
                    );
                }
                Err(e) => {
                    log::error!("[updater] Failed to emit ready event: {}", e);
                }
            }
        }
        Ok(None) => {
            log::info!("[updater] No update available, already on latest version");
        }
        Err(e) => {
            log::error!("[updater] Background update failed: {}", e);
        }
    }
}

/// Silently check for updates and download if available
/// Returns the version string if an update was downloaded, None if no update
async fn check_and_download_silently(app: &AppHandle) -> Result<Option<String>, String> {
    // Prevent concurrent update checks
    if UPDATE_IN_PROGRESS.swap(true, Ordering::SeqCst) {
        log::info!("[updater] Update check already in progress, skipping");
        return Ok(None);
    }

    // RAII guard ensures flag is reset even on panic/error
    let _guard = UpdateGuard;

    let target = get_update_target();
    let current_version = app.package_info().version.to_string();

    // Build updater with explicit target to override {{target}} template variable
    let updater = app
        .updater_builder()
        .target(target.to_string())
        .build()
        .map_err(|e| format!("Failed to build updater: {}", e))?;

    log::info!(
        "[updater] Checking for updates... Current: v{}, Target: {}",
        current_version,
        target
    );

    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            log::info!("[updater] Server returned no update (current version is latest)");
            return Ok(None);
        }
        Err(e) => {
            log::error!("[updater] Check failed: {}", e);
            return Err(format!("Update check failed: {}", e));
        }
    };

    let version = update.version.clone();
    log::info!(
        "[updater] Found update v{}, starting silent download...",
        version
    );

    // Progress tracking: log every 25%
    let _app_clone = app.clone();
    let downloaded = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let last_logged_percent = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
    let downloaded_clone = downloaded.clone();
    let last_logged_clone = last_logged_percent.clone();

    let on_chunk = move |chunk_length: usize, content_length: Option<u64>| {
        let new_downloaded = downloaded_clone.fetch_add(
            chunk_length as u64,
            std::sync::atomic::Ordering::SeqCst,
        ) + chunk_length as u64;

        if let Some(total) = content_length {
            let percent = (new_downloaded as f64 / total as f64 * 100.0) as u32;
            let last_percent = last_logged_clone.load(std::sync::atomic::Ordering::SeqCst);
            let current_bucket = percent / 25;
            let last_bucket = last_percent / 25;
            if current_bucket > last_bucket {
                last_logged_clone.store(percent, std::sync::atomic::Ordering::SeqCst);
                log::info!(
                    "[updater] Download progress: {}%",
                    current_bucket * 25
                );
            }
        }
    };

    // macOS: download_and_install is safe (.app replacement doesn't affect running process)
    update
        .download_and_install(on_chunk, || {
            log::info!("[updater] Download complete, installing...");
        })
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    Ok(Some(version))
}

/// Command: Manual check and download (triggered from frontend)
/// Returns true if an update was downloaded and is ready
#[tauri::command]
pub async fn check_and_download_update(app: AppHandle) -> Result<bool, String> {
    log::info!("[updater] Manual update check requested");

    match check_and_download_silently(&app).await {
        Ok(Some(version)) => {
            log::info!("[updater] Update v{} downloaded and ready", version);
            let info = UpdateReadyInfo {
                version: version.clone(),
            };
            if let Err(e) = app.emit("updater:ready-to-restart", info) {
                log::error!("[updater] Failed to emit event: {}", e);
            }
            Ok(true)
        }
        Ok(None) => Ok(false),
        Err(e) => Err(e),
    }
}

/// Command: Restart the application to apply the update
#[tauri::command]
pub fn restart_app(app: AppHandle) {
    log::info!("[updater] Restarting application to apply update...");
    app.restart();
}

/// Command: Stop all sidecars before update (cleanup)
#[tauri::command]
pub fn cmd_shutdown_for_update(
    state: tauri::State<'_, SidecarState>,
) -> Result<(), String> {
    log::info!("[updater] Stopping all sidecars for update...");
    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.stop_all();
    Ok(())
}

/// Command: Test HTTP connectivity to update server (diagnostic)
#[tauri::command]
pub async fn test_update_connectivity(app: AppHandle) -> Result<String, String> {
    let target = get_update_target();
    let url = format!("https://download.soagents.ai/update/{}.json", target);
    log::info!("[updater] Testing HTTP connectivity to: {}", url);

    let current_version = app.package_info().version.to_string();
    let client = reqwest::Client::builder()
        .user_agent(format!("SoAgents-Updater/{}", current_version))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!(
                "HTTP request failed: {} (is_connect: {}, is_timeout: {})",
                e,
                e.is_connect(),
                e.is_timeout()
            );
            log::error!("[updater] {}", error_msg);
            error_msg
        })?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // Try to parse as expected JSON format
    #[derive(serde::Deserialize)]
    struct UpdateJson {
        version: String,
        url: String,
        signature: String,
    }

    let json_result = match serde_json::from_str::<UpdateJson>(&body) {
        Ok(parsed) => {
            format!(
                "JSON valid: version={}, url={}, signature_len={}",
                parsed.version,
                parsed.url,
                parsed.signature.len()
            )
        }
        Err(e) => format!("JSON parse error: {}", e),
    };

    let result = format!(
        "=== Update Connectivity Test ===\n\
         URL: {}\n\
         Target: {}\n\
         Status: {}\n\
         Body length: {} bytes\n\
         \n\
         === JSON Validation ===\n\
         {}\n\
         \n\
         === Raw Body ===\n\
         {}",
        url,
        target,
        status,
        body.len(),
        json_result,
        if body.len() > 800 { &body[..800] } else { &body }
    );

    log::info!("[updater] Test result:\n{}", result);
    Ok(result)
}
