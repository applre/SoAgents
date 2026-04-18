//! Manifest reading + plugin metadata extraction.
//!
//! After `install_plugin` lays down the npm package into
//! `~/.soagents/openclaw-plugins/<pluginId>/node_modules/<npmPkg>/`, this
//! module inspects the package source to figure out:
//!   - Plugin manifest (name, version, channels declaration, configSchema)
//!   - Required config fields (the `account?.fieldX` idiom inside isConfigured)
//!   - QR login support (presence of `loginWithQrStart` in source)

use serde_json::{json, Value};
use std::path::Path;

use super::paths;

/// Try to read the plugin manifest from `node_modules/<pkg>/openclaw.plugin.json`
/// or fall back to the `openclaw` field of the package.json.
pub async fn read_plugin_manifest(plugin_dir: &Path, npm_spec: &str) -> Value {
    let pkg_name = paths::resolve_npm_pkg_name(npm_spec);

    // Preferred: dedicated openclaw.plugin.json
    let manifest_path = plugin_dir
        .join("node_modules")
        .join(&pkg_name)
        .join("openclaw.plugin.json");
    if let Ok(content) = tokio::fs::read_to_string(&manifest_path).await {
        if let Ok(manifest) = serde_json::from_str::<Value>(&content) {
            return manifest;
        }
    }

    // Fallback: package.json's "openclaw" + basic metadata
    let pkg_path = plugin_dir
        .join("node_modules")
        .join(&pkg_name)
        .join("package.json");
    if let Ok(content) = tokio::fs::read_to_string(&pkg_path).await {
        if let Ok(pkg) = serde_json::from_str::<Value>(&content) {
            return json!({
                "name": pkg.get("name"),
                "version": pkg.get("version"),
                "description": pkg.get("description"),
                "openclaw": pkg.get("openclaw"),
            });
        }
    }

    json!({ "name": pkg_name })
}

/// Extract required config field names from a channel plugin source file.
///
/// Looks for
///   `isConfigured: (account) => Boolean(account?.fieldA && account?.fieldB)`
/// and returns `["fieldA", "fieldB"]`.
pub async fn extract_required_fields(pkg_dir: &Path) -> Vec<String> {
    let candidates = [
        pkg_dir.join("src").join("channel.ts"),
        pkg_dir.join("dist").join("channel.js"),
        pkg_dir.join("channel.ts"),
        pkg_dir.join("channel.js"),
    ];

    for path in &candidates {
        let Ok(content) = tokio::fs::read_to_string(path).await else { continue };
        let Some(pos) = content.find("isConfigured") else { continue };

        // Only inspect the first ~300 chars after the pattern and cap at the
        // line end to avoid matching subsequent object keys.
        let rest = &content[pos..std::cmp::min(pos + 300, content.len())];
        let line_end = rest.find('\n').unwrap_or(rest.len());
        let snippet = &rest[..line_end];

        let mut seen = std::collections::HashSet::new();
        let mut fields = Vec::new();
        let needle = "account?.";
        let mut search_from = 0;
        while let Some(idx) = snippet[search_from..].find(needle) {
            let start = search_from + idx + needle.len();
            let end = snippet[start..]
                .find(|c: char| !c.is_alphanumeric() && c != '_')
                .map(|i| start + i)
                .unwrap_or(snippet.len());
            let field = &snippet[start..end];
            if !field.is_empty() && seen.insert(field.to_string()) {
                fields.push(field.to_string());
            }
            search_from = end;
        }
        if !fields.is_empty() {
            return fields;
        }
    }

    Vec::new()
}

/// Detect whether a plugin exposes `loginWithQrStart` anywhere in its source.
pub async fn detect_qr_login_support(pkg_dir: &Path) -> bool {
    let candidates = [
        pkg_dir.join("src").join("channel.ts"),
        pkg_dir.join("dist").join("channel.js"),
        pkg_dir.join("channel.ts"),
        pkg_dir.join("channel.js"),
        pkg_dir.join("src").join("index.ts"),
        pkg_dir.join("dist").join("index.js"),
        pkg_dir.join("index.ts"),
        pkg_dir.join("index.js"),
    ];
    for path in &candidates {
        if let Ok(content) = tokio::fs::read_to_string(path).await {
            if content.contains("loginWithQrStart") {
                return true;
            }
        }
    }
    false
}

/// Write a minimal `package.json` at `base_dir` if one does not exist.
pub async fn ensure_package_json(base_dir: &Path, plugin_id: &str) -> Result<(), String> {
    let pkg_json = base_dir.join("package.json");
    if !pkg_json.exists() {
        let content = json!({
            "name": plugin_id,
            "version": "1.0.0",
            "private": true,
        });
        tokio::fs::write(&pkg_json, content.to_string())
            .await
            .map_err(|e| format!("Failed to write package.json: {}", e))?;
    }
    Ok(())
}

/// Read installed package version from
/// `<plugin_dir>/node_modules/<npm_pkg>/package.json`.
pub async fn read_installed_version(plugin_dir: &Path, npm_spec: &str) -> Option<Value> {
    let pkg_name = paths::resolve_npm_pkg_name(npm_spec);
    let dep_pkg_path = plugin_dir
        .join("node_modules")
        .join(&pkg_name)
        .join("package.json");
    let content = tokio::fs::read_to_string(&dep_pkg_path).await.ok()?;
    let pkg: Value = serde_json::from_str(&content).ok()?;
    pkg.get("version").cloned()
}

/// Read homepage URL from installed package.json.
pub async fn read_installed_homepage(plugin_dir: &Path, npm_spec: &str) -> Option<Value> {
    let pkg_name = paths::resolve_npm_pkg_name(npm_spec);
    let dep_pkg_path = plugin_dir
        .join("node_modules")
        .join(&pkg_name)
        .join("package.json");
    let content = tokio::fs::read_to_string(&dep_pkg_path).await.ok()?;
    let pkg: Value = serde_json::from_str(&content).ok()?;
    pkg.get("homepage").cloned()
}
