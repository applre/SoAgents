//! Run `npm install` / `bun add` with a three-level fallback.
//!
//! Strategy (mirrors MyAgents exactly):
//!   1. **system npm** — most reliable when the user has Node.js installed.
//!      Fastest resolver, best peerDeps handling, widest community support.
//!   2. **bundled npm** — SoAgents ships Node.js v24 inside the app bundle
//!      (see scripts/download_nodejs.sh). Zero-setup fallback for users
//!      without Node.js.
//!   3. **bundled bun add** — last resort. Bun's npm resolver has
//!      compatibility issues with some packages (axios timeout hang, etc.),
//!      so this is only used if both npm paths fail.
//!
//! The `--omit=peer` flag is passed to every npm invocation. OpenClaw
//! plugins declare `peerDependencies: { openclaw: '*' }` which would pull
//! ~400 transitive deps (larksuite-sdk, playwright-core, aws-sdk) — we
//! supply our own sdk-shim, so peers are skipped.

use std::path::{Path, PathBuf};

use crate::process_cmd;
use crate::system_binary;

// ── Tier 1: system npm ────────────────────────────────────────────────

/// Try `npm install <spec>` via the user's system npm. Returns Ok(true) on
/// success, Ok(false) if system npm was missing or the install failed
/// (caller falls through to the next tier).
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
        // NODE_OPTIONS=--no-experimental-require-module: fixes Node v24 CJS/ESM
        // crash on Windows.
        cmd.args(["install", spec.as_str(), "--omit=peer"])
            .current_dir(&base)
            .env("NODE_OPTIONS", "--no-experimental-require-module");
        // Route npm's registry requests through user's proxy (crucial for
        // mainland-China users hitting npm / @tencent-weixin packages).
        crate::proxy_config::apply_to_subprocess(&mut cmd);
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

// ── Tier 2: bundled npm ───────────────────────────────────────────────

/// Locate the bundled Node.js binary + npm-cli.js shipped inside the app.
///
/// Expected layout (matches `scripts/download_nodejs.sh`):
///   macOS: <resource_dir>/nodejs/bin/node
///          <resource_dir>/nodejs/lib/node_modules/npm/bin/npm-cli.js
pub fn find_bundled_node_npm<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Option<(PathBuf, PathBuf)> {
    use tauri::Manager;

    let check = |nodejs_dir: &Path| -> Option<(PathBuf, PathBuf)> {
        #[cfg(target_os = "windows")]
        let node_bin = nodejs_dir.join("node.exe");
        #[cfg(not(target_os = "windows"))]
        let node_bin = nodejs_dir.join("bin").join("node");

        #[cfg(target_os = "windows")]
        let npm_cli = nodejs_dir
            .join("node_modules")
            .join("npm")
            .join("bin")
            .join("npm-cli.js");
        #[cfg(not(target_os = "windows"))]
        let npm_cli = nodejs_dir
            .join("lib")
            .join("node_modules")
            .join("npm")
            .join("bin")
            .join("npm-cli.js");

        if node_bin.exists() && npm_cli.exists() {
            log::info!(
                "[openclaw] bundled Node found: node={:?}, npm-cli={:?}",
                node_bin,
                npm_cli
            );
            Some((node_bin, npm_cli))
        } else {
            None
        }
    };

    // Production: <app resource_dir>/nodejs/
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let prod_dir = resource_dir.join("nodejs");
        if let Some(result) = check(&prod_dir) {
            return Some(result);
        }
    }

    // Development: <CARGO_MANIFEST_DIR>/resources/nodejs/
    if cfg!(debug_assertions) {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let dev_dir = manifest_dir.join("resources").join("nodejs");
        if let Some(result) = check(&dev_dir) {
            return Some(result);
        }
    }

    log::warn!("[openclaw] bundled Node.js not found, falling back to Bun");
    None
}

/// Try `<bundled-node> npm-cli.js install <spec>` via the shipped Node.js.
/// Returns Ok(true) if the install succeeded, Ok(false) otherwise.
pub async fn try_bundled_npm<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    base_dir: &Path,
    install_spec: &str,
) -> Result<bool, String> {
    let Some((node_bin, npm_cli)) = find_bundled_node_npm(app_handle) else {
        return Ok(false);
    };

    log::info!(
        "[openclaw] using bundled Node for plugin install: {:?}",
        node_bin
    );

    // Prepend Node binary's directory to PATH so postinstall scripts (which
    // shell out to `node`) can locate it.
    let node_dir = node_bin
        .parent()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_default();
    let system_path = std::env::var("PATH").unwrap_or_default();
    let augmented_path = {
        #[cfg(target_os = "windows")]
        { format!("{};{}", node_dir, system_path) }
        #[cfg(not(target_os = "windows"))]
        { format!("{}:{}", node_dir, system_path) }
    };

    let node_owned = node_bin.clone();
    let npm_cli_str = match npm_cli.to_str() {
        Some(s) => s.to_string(),
        None => {
            return Err(format!("npm-cli.js path has invalid UTF-8: {:?}", npm_cli));
        }
    };
    let base = base_dir.to_path_buf();
    let spec = install_spec.to_string();

    let result = tokio::task::spawn_blocking(move || {
        let mut cmd = process_cmd::new(&node_owned);
        cmd.args([npm_cli_str.as_str(), "install", spec.as_str(), "--omit=peer"])
            .current_dir(&base)
            .env("PATH", &augmented_path)
            .env("NODE_OPTIONS", "--no-experimental-require-module");
        crate::proxy_config::apply_to_subprocess(&mut cmd);
        cmd.output()
    })
    .await;

    match result {
        Ok(Ok(output)) if output.status.success() => {
            log::info!("[openclaw] bundled npm install {} succeeded", install_spec);
            Ok(true)
        }
        Ok(Ok(output)) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            log::error!(
                "[openclaw] bundled npm install {} failed (exit {}): {}",
                install_spec,
                output.status,
                stderr.trim()
            );
            Ok(false)
        }
        Ok(Err(e)) => {
            log::error!("[openclaw] bundled npm spawn error: {}", e);
            Ok(false)
        }
        Err(e) => {
            log::error!("[openclaw] bundled npm spawn_blocking failed: {}", e);
            Ok(false)
        }
    }
}

// ── Tier 3: bundled bun add ───────────────────────────────────────────

/// Last-resort fallback. SoAgents ships Bun inside the app bundle;
/// `bun add` works without Node.js, though a handful of npm packages
/// (axios, some native-module packages) have compat issues under Bun.
pub async fn try_bundled_bun<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    base_dir: &Path,
    install_spec: &str,
) -> Result<(), String> {
    let bun_path = crate::sidecar::find_bun_executable(app_handle)
        .map_err(|e| format!("Bun executable unavailable: {}", e))?;

    log::warn!(
        "[openclaw] falling back to bundled bun add: {}",
        install_spec
    );

    let bun = bun_path;
    let base = base_dir.to_path_buf();
    let spec = install_spec.to_string();
    let output = tokio::task::spawn_blocking(move || {
        let mut cmd = process_cmd::new(&bun);
        cmd.args(["add", spec.as_str()]).current_dir(&base);
        crate::proxy_config::apply_to_subprocess(&mut cmd);
        cmd.output()
    })
    .await
    .map_err(|e| format!("bun spawn_blocking: {}", e))?
    .map_err(|e| format!("bun add io error: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Plugin install failed (system npm, bundled npm, and bun all failed).\nLast error:\n{}",
            stderr
        ));
    }

    log::info!("[openclaw] bundled bun install {} succeeded", install_spec);
    Ok(())
}
