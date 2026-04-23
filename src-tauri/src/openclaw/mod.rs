//! OpenClaw plugin system — Rust-side plugin management.
//!
//! This module owns the on-disk layout under `~/.soagents/openclaw-plugins/`
//! and provides install / uninstall / list primitives consumed by Tauri
//! commands (see `commands.rs`).
//!
//! The actual **runtime** — loading a plugin and serving IM messages —
//! lives in `src/im/bridge.rs` (coming in stage 1.3). This module only
//! concerns itself with the package manager side: put bytes on disk, read
//! metadata off disk, remove bytes from disk.

use serde_json::{json, Value};

pub mod bridge_process;
pub mod manifest;
pub mod npm_runner;
pub mod paths;
pub mod shim;

/// Install an OpenClaw plugin from an npm spec.
///
/// Strategy:
/// 1. Validate the spec (reject paths, git URLs, etc.)
/// 2. Derive the plugin_id and create `~/.soagents/openclaw-plugins/<pluginId>/`
/// 3. Write a minimal `package.json` so the package manager has a project
/// 4. Run install with two-level fallback: system npm → bundled bun add
/// 5. Read plugin metadata out of the installed package
///
/// Returns a JSON object matching `InstalledPlugin` in `src/shared/types/plugin.ts`.
///
/// **NOTE**: The `install_sdk_shim` step that MyAgents runs after install is
/// deferred to stage 1.3 — the Bun-side sdk-shim sources don't exist yet.
/// Plugins installed now won't actually _run_ until stage 1.3 lands the
/// shim. That's by design: this stage only validates the package-management
/// plumbing.
pub async fn install_plugin<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    npm_spec: &str,
) -> Result<Value, String> {
    let trimmed = npm_spec.trim().to_string();
    paths::validate_npm_spec(&trimmed)?;

    let plugin_id = paths::derive_plugin_id(&trimmed);
    paths::validate_plugin_id(&plugin_id)?;

    let base_dir = paths::plugin_install_dir(&plugin_id);
    tokio::fs::create_dir_all(&base_dir)
        .await
        .map_err(|e| format!("Failed to create plugin dir {:?}: {}", base_dir, e))?;

    manifest::ensure_package_json(&base_dir, &plugin_id).await?;

    let install_spec = paths::ensure_version_spec(&trimmed);
    log::info!(
        "[openclaw] installing plugin '{}' (spec='{}', dir={:?})",
        plugin_id,
        install_spec,
        base_dir
    );

    // Three-level fallback: system npm → bundled npm → bundled bun add.
    // Matches MyAgents' strategy — npm is preferred for its wider ecosystem
    // compatibility; bun is last resort to avoid tripping over edge cases
    // like axios's fetch-adapter hang.
    let mut installed = npm_runner::try_system_npm(&base_dir, &install_spec).await?;
    if !installed {
        installed = npm_runner::try_bundled_npm(app_handle, &base_dir, &install_spec).await?;
    }
    if !installed {
        npm_runner::try_bundled_bun(app_handle, &base_dir, &install_spec).await?;
    }

    // Overlay our lightweight sdk-shim on top of the installed tree.
    // MUST run last — npm/bun may overwrite node_modules/openclaw/ during
    // lockfile reconciliation, and our shim must always win (last-write-wins).
    shim::install_sdk_shim(app_handle, &base_dir).await?;

    let npm_pkg_name = paths::resolve_npm_pkg_name(&trimmed);
    let npm_pkg_dir = base_dir.join("node_modules").join(&npm_pkg_name);

    let manifest_json = manifest::read_plugin_manifest(&base_dir, &trimmed).await;
    let required_fields = manifest::extract_required_fields(&npm_pkg_dir).await;
    let supports_qr_login = manifest::detect_qr_login_support(&npm_pkg_dir).await;
    let package_version = manifest::read_installed_version(&base_dir, &trimmed).await;
    let homepage = manifest::read_installed_homepage(&base_dir, &trimmed).await;

    log::info!(
        "[openclaw] plugin '{}' installed: qrLogin={}, requiredFields={:?}",
        plugin_id,
        supports_qr_login,
        required_fields
    );

    Ok(json!({
        "pluginId": plugin_id,
        "installDir": base_dir.to_string_lossy(),
        "npmSpec": trimmed,
        "manifest": manifest_json,
        "packageVersion": package_version,
        "homepage": homepage,
        "requiredFields": required_fields,
        "supportsQrLogin": supports_qr_login,
    }))
}

/// Uninstall a plugin by removing its entire install directory.
///
/// Returns error if the plugin is currently loaded by a running bot.
/// Loaded-state check is a stub in stage 1.2 (no BridgeAdapter yet);
/// always returns `false`. Will be wired to `BridgeSenderEntry` in stage 1.3.
pub async fn uninstall_plugin(plugin_id: &str) -> Result<(), String> {
    paths::validate_plugin_id(plugin_id)?;

    let plugin_dir = paths::plugin_install_dir(plugin_id);
    if !plugin_dir.exists() {
        return Err(format!("Plugin '{}' not found", plugin_id));
    }

    if is_plugin_in_use(plugin_id).await {
        return Err(format!(
            "Cannot uninstall '{}': a running bot depends on it. Stop the bot first.",
            plugin_id
        ));
    }

    tokio::fs::remove_dir_all(&plugin_dir)
        .await
        .map_err(|e| format!("Failed to remove plugin directory: {}", e))?;

    log::info!("[openclaw] plugin '{}' uninstalled", plugin_id);
    Ok(())
}

/// Stub: check whether any running bot is backed by `plugin_id`.
/// Always returns `false` in stage 1.2. Will be wired to
/// `bridge::BridgeSenderEntry` once the BridgeAdapter is ported.
async fn is_plugin_in_use(_plugin_id: &str) -> bool {
    false
}

/// List every plugin under `~/.soagents/openclaw-plugins/`.
/// Returns an array of `InstalledPlugin`-shaped JSON objects.
pub async fn list_plugins() -> Result<Vec<Value>, String> {
    let root = paths::plugins_root();
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut plugins = Vec::new();
    let mut entries = tokio::fs::read_dir(&root)
        .await
        .map_err(|e| format!("Failed to read plugins dir: {}", e))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("read_dir: {}", e))?
    {
        let is_dir = entry
            .file_type()
            .await
            .map(|t| t.is_dir())
            .unwrap_or(false);
        if !is_dir {
            continue;
        }

        let plugin_id = entry.file_name().to_string_lossy().to_string();
        let plugin_dir = entry.path();

        // The top-level package.json's `dependencies` tells us which npm
        // package was installed.
        let pkg_json_path = plugin_dir.join("package.json");
        let mut npm_spec = String::new();
        if let Ok(content) = tokio::fs::read_to_string(&pkg_json_path).await {
            if let Ok(pkg) = serde_json::from_str::<Value>(&content) {
                if let Some(deps) = pkg.get("dependencies").and_then(|d| d.as_object()) {
                    if let Some((name, _)) = deps.iter().next() {
                        npm_spec = name.clone();
                    }
                }
            }
        }
        if npm_spec.is_empty() {
            continue;
        }

        let npm_pkg_dir = plugin_dir.join("node_modules").join(&npm_spec);

        let manifest_json = manifest::read_plugin_manifest(&plugin_dir, &npm_spec).await;
        let package_version = manifest::read_installed_version(&plugin_dir, &npm_spec).await;
        let homepage = manifest::read_installed_homepage(&plugin_dir, &npm_spec).await;
        let required_fields = manifest::extract_required_fields(&npm_pkg_dir).await;
        let supports_qr_login = manifest::detect_qr_login_support(&npm_pkg_dir).await;

        plugins.push(json!({
            "pluginId": plugin_id,
            "installDir": plugin_dir.to_string_lossy(),
            "npmSpec": npm_spec,
            "manifest": manifest_json,
            "packageVersion": package_version,
            "homepage": homepage,
            "requiredFields": required_fields,
            "supportsQrLogin": supports_qr_login,
        }));
    }

    Ok(plugins)
}
