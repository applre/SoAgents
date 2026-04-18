//! Run `npm install` / `bun add` with a two-level fallback.
//!
//! Strategy (SoAgents-specific):
//!   1. Try **system npm** if present in augmented PATH. Most reliable for
//!      users who have Node.js installed — fastest resolver, best peerDeps
//!      handling.
//!   2. Fallback to **bundled `bun add`**. SoAgents ships Bun inside the app
//!      bundle, so this always works offline / when the user has no Node.js.
//!
//! MyAgents has a third tier (bundled Node.js) but SoAgents does not ship
//! Node.js — we rely on bundled Bun as the universal fallback instead.

use std::path::Path;

use crate::process_cmd;
use crate::system_binary;

/// Attempt `npm install <spec>` using a discovered system npm. Returns
/// `Ok(true)` if the install succeeded, `Ok(false)` if system npm wasn't
/// found or the install failed (caller should try fallback).
pub async fn try_system_npm(base_dir: &Path, install_spec: &str) -> Result<bool, String> {
    let Some(npm_bin) = system_binary::find("npm") else {
        log::info!("[openclaw] system npm not found in PATH");
        return Ok(false);
    };
    log::info!("[openclaw] using system npm: {:?}", npm_bin);

    let base = base_dir.to_path_buf();
    let spec = install_spec.to_string();
    let result = tokio::task::spawn_blocking(move || {
        let mut cmd = process_cmd::new(&npm_bin);
        // --omit=peer: OpenClaw plugins declare `peerDependencies: { openclaw: '*' }`.
        // Installing peers pulls 400+ transitive deps (larksuite sdk, playwright-core,
        // aws-sdk, etc). We provide our own sdk-shim so peers are skipped.
        //
        // NODE_OPTIONS=--no-experimental-require-module: fixes Node v24 CJS/ESM
        // crash on Windows.
        cmd.args(["install", spec.as_str(), "--omit=peer"])
            .current_dir(&base)
            .env("NODE_OPTIONS", "--no-experimental-require-module");
        cmd.output()
    })
    .await;

    match result {
        Ok(Ok(output)) if output.status.success() => {
            log::info!("[openclaw] system npm install {} succeeded", install_spec);
            Ok(true)
        }
        Ok(Ok(output)) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            log::error!(
                "[openclaw] system npm install {} failed: {}",
                install_spec,
                stderr.trim()
            );
            Ok(false)
        }
        Ok(Err(e)) => {
            log::error!("[openclaw] system npm spawn error: {}", e);
            Ok(false)
        }
        Err(e) => {
            log::error!("[openclaw] system npm spawn_blocking failed: {}", e);
            Ok(false)
        }
    }
}

/// Attempt `bun add <spec>` using the bundled Bun executable.
/// This is the universal fallback — SoAgents ships Bun inside the app bundle.
pub async fn try_bundled_bun<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    base_dir: &Path,
    install_spec: &str,
) -> Result<(), String> {
    let bun_path = crate::sidecar::find_bun_executable(app_handle)
        .map_err(|e| format!("Bun executable unavailable: {}", e))?;

    log::warn!(
        "[openclaw] falling back to bundled bun for plugin install: {}",
        install_spec
    );

    let bun = bun_path;
    let base = base_dir.to_path_buf();
    let spec = install_spec.to_string();
    let output = tokio::task::spawn_blocking(move || {
        let mut cmd = process_cmd::new(&bun);
        cmd.args(["add", spec.as_str()]).current_dir(&base);
        cmd.output()
    })
    .await
    .map_err(|e| format!("bun spawn_blocking: {}", e))?
    .map_err(|e| format!("bun add io error: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Plugin install failed (both npm and bun). Last error:\n{}",
            stderr
        ));
    }

    log::info!("[openclaw] bundled bun install {} succeeded", install_spec);
    Ok(())
}
