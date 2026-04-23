//! Disk paths + plugin_id validation for OpenClaw plugins.

use std::path::PathBuf;

/// Root directory under which every installed plugin lives:
///   `~/.soagents/openclaw-plugins/<pluginId>/`
pub fn plugins_root() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".soagents")
        .join("openclaw-plugins")
}

/// Install directory for one plugin (does NOT create it).
pub fn plugin_install_dir(plugin_id: &str) -> PathBuf {
    plugins_root().join(plugin_id)
}

/// Validate a plugin_id before using it as a path segment.
/// Rejects empty, path separators, `..`, and leading dots.
pub fn validate_plugin_id(plugin_id: &str) -> Result<(), String> {
    if plugin_id.is_empty()
        || plugin_id.contains('/')
        || plugin_id.contains('\\')
        || plugin_id.contains("..")
        || plugin_id.starts_with('.')
    {
        return Err(format!("Invalid plugin ID: '{}'", plugin_id));
    }
    Ok(())
}

/// Validate an npm spec before passing to `npm install` / `bun add`.
/// Only allows registry-style names (scoped or unscoped). Rejects paths,
/// git URLs, http(s) URLs, and GitHub shorthand like `owner/repo`.
pub fn validate_npm_spec(npm_spec: &str) -> Result<(), String> {
    let trimmed = npm_spec.trim();
    let has_unscoped_slash = trimmed.contains('/') && !trimmed.starts_with('@');
    if trimmed.is_empty()
        || trimmed.contains("..")
        || trimmed.starts_with('/')
        || trimmed.starts_with('.')
        || trimmed.contains("file:")
        || trimmed.contains("git:")
        || trimmed.contains("git+")
        || trimmed.contains("github:")
        || trimmed.contains("http:")
        || trimmed.contains("https:")
        || has_unscoped_slash
    {
        return Err(format!(
            "Invalid npm spec '{}': only npm package names are allowed",
            npm_spec
        ));
    }
    Ok(())
}

/// Derive pluginId from an npm spec:
///   `@sliverp/qqbot`        → `qqbot`
///   `@sliverp/qqbot@1.2.0`  → `qqbot`
///   `qqbot`                 → `qqbot`
///   `qqbot@latest`          → `qqbot`
pub fn derive_plugin_id(npm_spec: &str) -> String {
    npm_spec
        .split('/')
        .last()
        .unwrap_or(npm_spec)
        .split('@')
        .next()
        .unwrap_or(npm_spec)
        .to_string()
}

/// Resolve the package name (without version suffix) that will live in
/// `node_modules/`:
///   `@sliverp/qqbot@1.2.0` → `@sliverp/qqbot`
///   `qqbot@latest`         → `qqbot`
pub fn resolve_npm_pkg_name(npm_spec: &str) -> String {
    let first = npm_spec.split('@').next().unwrap_or(npm_spec);
    if first.is_empty() && npm_spec.starts_with('@') {
        let parts: Vec<&str> = npm_spec.splitn(3, '@').collect();
        if parts.len() >= 3 {
            format!("@{}", parts[1])
        } else {
            npm_spec.to_string()
        }
    } else {
        first.to_string()
    }
}

/// Append `@latest` to a spec that has no version pin.
/// Without this, lockfiles from previous installs may block upgrades.
pub fn ensure_version_spec(npm_spec: &str) -> String {
    let trimmed = npm_spec.trim();
    if trimmed.contains('@') {
        let last_at = trimmed.rfind('@').unwrap_or(0);
        // Scoped with no version: only the leading '@' is present.
        if last_at == 0 || (trimmed.starts_with('@') && trimmed[1..].find('@').is_none()) {
            format!("{}@latest", trimmed)
        } else {
            trimmed.to_string()
        }
    } else {
        format!("{}@latest", trimmed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_id() {
        assert_eq!(derive_plugin_id("@sliverp/qqbot"), "qqbot");
        assert_eq!(derive_plugin_id("@sliverp/qqbot@1.2.0"), "qqbot");
        assert_eq!(derive_plugin_id("qqbot"), "qqbot");
        assert_eq!(derive_plugin_id("qqbot@latest"), "qqbot");
    }

    #[test]
    fn resolve_pkg_name() {
        assert_eq!(resolve_npm_pkg_name("@sliverp/qqbot"), "@sliverp/qqbot");
        assert_eq!(resolve_npm_pkg_name("@sliverp/qqbot@1.2.0"), "@sliverp/qqbot");
        assert_eq!(resolve_npm_pkg_name("qqbot"), "qqbot");
        assert_eq!(resolve_npm_pkg_name("qqbot@latest"), "qqbot");
    }

    #[test]
    fn ensure_version() {
        assert_eq!(ensure_version_spec("qqbot"), "qqbot@latest");
        assert_eq!(ensure_version_spec("@sliverp/qqbot"), "@sliverp/qqbot@latest");
        assert_eq!(ensure_version_spec("@sliverp/qqbot@1.2.0"), "@sliverp/qqbot@1.2.0");
        assert_eq!(ensure_version_spec("qqbot@1.2.0"), "qqbot@1.2.0");
    }

    #[test]
    fn reject_bad_specs() {
        assert!(validate_npm_spec("../evil").is_err());
        assert!(validate_npm_spec("/abs/path").is_err());
        assert!(validate_npm_spec("https://example.com/pkg.tgz").is_err());
        assert!(validate_npm_spec("github:owner/repo").is_err());
        assert!(validate_npm_spec("owner/repo").is_err()); // unscoped slash
        assert!(validate_npm_spec("@scope/pkg").is_ok());
        assert!(validate_npm_spec("pkg").is_ok());
    }

    #[test]
    fn reject_bad_plugin_id() {
        assert!(validate_plugin_id("").is_err());
        assert!(validate_plugin_id("..").is_err());
        assert!(validate_plugin_id(".hidden").is_err());
        assert!(validate_plugin_id("foo/bar").is_err());
        assert!(validate_plugin_id("qqbot").is_ok());
    }
}
