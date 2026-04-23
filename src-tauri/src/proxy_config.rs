//! Shared proxy configuration module — one of four "pit of success" modules
//! alongside `local_http` (localhost HTTP clients), `process_cmd` (subprocess
//! GUI flags), and `system_binary` (system tool lookup).
//!
//! Provides unified proxy configuration for:
//!   1. Tauri updater / IM APIs / other external HTTP   (`build_client_with_proxy`)
//!   2. Bun Sidecar / Plugin Bridge / npm install / bun add — subprocess env
//!      injection (`apply_to_subprocess`)
//!
//! **All** subprocesses that may use `fetch()` or HTTP clients MUST call
//! `proxy_config::apply_to_subprocess()` before spawning. Manual
//! `cmd.env("HTTP_PROXY", ...)` / `cmd.env_remove(...)` is forbidden — it
//! silently drifts when policy changes.
//!
//! Config is read from `~/.soagents/config.json` and edited via
//! Settings → 通用 → 网络代理.

use serde::Deserialize;
use std::fs;
use std::process::Command;

const DEFAULT_PROXY_PROTOCOL: &str = "http";
const DEFAULT_PROXY_HOST: &str = "127.0.0.1";
const DEFAULT_PROXY_PORT: u16 = 7890;

/// Comprehensive NO_PROXY list for all subprocess types.
///
/// Bun's `fetch()` honors `HTTP_PROXY` env vars — without this, inherited
/// system proxy would break internal localhost calls (admin API, Plugin
/// Bridge, cron tool, etc.).
///
/// Public so modules that can't go through `apply_to_subprocess` (e.g. future
/// `portable-pty` terminals) can reuse the same constant.
pub const LOCALHOST_NO_PROXY: &str =
    "localhost,localhost.localdomain,127.0.0.1,127.0.0.0/8,::1,[::1]";

/// Proxy settings from `~/.soagents/config.json`.
///
/// # Example JSON
/// ```json
/// {
///   "proxySettings": {
///     "enabled": true,
///     "protocol": "http",
///     "host": "127.0.0.1",
///     "port": 7897
///   }
/// }
/// ```
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettings {
    pub enabled: bool,
    /// "http" | "https" | "socks5"
    pub protocol: Option<String>,
    /// IP or domain
    pub host: Option<String>,
    /// 1 .. 65535
    pub port: Option<u16>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PartialAppConfig {
    proxy_settings: Option<ProxySettings>,
}

/// Read proxy settings from `~/.soagents/config.json`.
/// Returns `Some` only when the user has *explicitly enabled* proxy.
pub fn read_proxy_settings() -> Option<ProxySettings> {
    let home = dirs::home_dir()?;
    let config_path = home.join(".soagents").join("config.json");

    let content = match fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return None,
        Err(e) => {
            log::warn!(
                "[proxy_config] Failed to read {:?}: {}. Check file permissions.",
                config_path,
                e
            );
            return None;
        }
    };

    // Strip UTF-8 BOM if present (Windows editors sometimes inject one).
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(&content);

    let config: PartialAppConfig = match serde_json::from_str(content) {
        Ok(c) => c,
        Err(e) => {
            log::error!(
                "[proxy_config] Invalid JSON in {:?}: {}. Check the config format.",
                config_path,
                e
            );
            return None;
        }
    };

    config.proxy_settings.filter(|p| p.enabled)
}

/// Build `protocol://host:port` from settings, validating protocol + port.
pub fn get_proxy_url(settings: &ProxySettings) -> Result<String, String> {
    let protocol = settings
        .protocol
        .as_deref()
        .unwrap_or(DEFAULT_PROXY_PROTOCOL);
    if !["http", "https", "socks5"].contains(&protocol) {
        return Err(format!(
            "Invalid proxy protocol '{}'. Supported: http, https, socks5",
            protocol
        ));
    }

    let port = settings.port.unwrap_or(DEFAULT_PROXY_PORT);
    if port == 0 {
        return Err(format!(
            "Invalid proxy port: {}. Must be between 1 and 65535",
            port
        ));
    }

    let host = settings.host.as_deref().unwrap_or(DEFAULT_PROXY_HOST);
    Ok(format!("{}://{}:{}", protocol, host, port))
}

/// Apply SoAgents proxy policy to a child-process `Command`.
///
/// This is the **only** approved way to configure proxy env vars for
/// subprocesses. Manual `cmd.env("HTTP_PROXY", ...)` / `cmd.env_remove(...)`
/// is forbidden — it silently breaks when the policy changes.
///
/// Behavior (mirrors MyAgents):
/// - **Proxy enabled + valid**: inject HTTP_PROXY/HTTPS_PROXY + NO_PROXY +
///   `SOAGENTS_PROXY_INJECTED=1` marker.
/// - **Proxy config invalid**: strip all proxy vars (fail-safe).
/// - **No proxy configured**: inherit system env (so users of global Clash
///   / TUN see transparent behavior) but still force NO_PROXY to protect
///   localhost.
///
/// Returns `true` if explicit proxy was injected.
pub fn apply_to_subprocess(cmd: &mut Command) -> bool {
    if let Some(proxy_settings) = read_proxy_settings() {
        match get_proxy_url(&proxy_settings) {
            Ok(proxy_url) => {
                log::info!("[proxy_config] injecting proxy into subprocess: {}", proxy_url);
                cmd.env("HTTP_PROXY", &proxy_url);
                cmd.env("HTTPS_PROXY", &proxy_url);
                cmd.env("http_proxy", &proxy_url);
                cmd.env("https_proxy", &proxy_url);
                cmd.env("NO_PROXY", LOCALHOST_NO_PROXY);
                cmd.env("no_proxy", LOCALHOST_NO_PROXY);
                // Marker — lets downstream scripts detect explicit vs inherited env.
                cmd.env("SOAGENTS_PROXY_INJECTED", "1");
                true
            }
            Err(e) => {
                log::error!(
                    "[proxy_config] invalid proxy configuration: {}. \
                     Check Settings → 通用 → 网络代理. Subprocess will start without proxy.",
                    e
                );
                for var in &[
                    "HTTP_PROXY",
                    "HTTPS_PROXY",
                    "http_proxy",
                    "https_proxy",
                    "ALL_PROXY",
                    "all_proxy",
                    "NO_PROXY",
                    "no_proxy",
                ] {
                    cmd.env_remove(var);
                }
                false
            }
        }
    } else {
        // No SoAgents proxy configured: inherit system network behavior so the
        // app respects Clash TUN / global proxy like other native apps.
        // CRITICAL: still inject NO_PROXY so Bun's fetch() doesn't route
        // localhost through an inherited system proxy.
        log::debug!("[proxy_config] no proxy configured, inheriting system env + forcing localhost NO_PROXY");
        cmd.env("NO_PROXY", LOCALHOST_NO_PROXY);
        cmd.env("no_proxy", LOCALHOST_NO_PROXY);
        false
    }
}

/// Build a `reqwest::Client` that honors the user's proxy configuration.
///
/// - **Proxy enabled**: route external requests through it, with localhost
///   carved out via NO_PROXY.
/// - **No proxy configured**: inherit system env (reqwest's default proxy
///   detection). This lets users with a system-level proxy (Clash TUN,
///   global mode, etc.) use SoAgents transparently.
///
/// **Use for outbound traffic only** (CDN, IM APIs, auto-update). Any client
/// that talks to localhost MUST use `local_http::builder()` instead — it
/// unconditionally bypasses proxy.
pub fn build_client_with_proxy(
    builder: reqwest::ClientBuilder,
) -> Result<reqwest::Client, String> {
    let final_builder = if let Some(proxy_settings) = read_proxy_settings() {
        let proxy_url = get_proxy_url(&proxy_settings)?;
        log::info!("[proxy_config] using proxy for external requests: {}", proxy_url);
        let proxy = reqwest::Proxy::all(&proxy_url)
            .map_err(|e| format!("[proxy_config] Failed to create proxy: {}", e))?
            .no_proxy(reqwest::NoProxy::from_string(LOCALHOST_NO_PROXY));
        builder.proxy(proxy)
    } else {
        log::info!("[proxy_config] no proxy configured, inheriting system network behavior");
        builder
    };

    final_builder
        .build()
        .map_err(|e| format!("[proxy_config] Failed to build HTTP client: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proxy_url_with_defaults() {
        let s = ProxySettings {
            enabled: true,
            protocol: None,
            host: None,
            port: None,
        };
        assert_eq!(get_proxy_url(&s).unwrap(), "http://127.0.0.1:7890");
    }

    #[test]
    fn proxy_url_socks5() {
        let s = ProxySettings {
            enabled: true,
            protocol: Some("socks5".into()),
            host: Some("192.168.1.1".into()),
            port: Some(1080),
        };
        assert_eq!(get_proxy_url(&s).unwrap(), "socks5://192.168.1.1:1080");
    }

    #[test]
    fn proxy_url_https() {
        let s = ProxySettings {
            enabled: true,
            protocol: Some("https".into()),
            host: Some("proxy.example.com".into()),
            port: Some(443),
        };
        assert_eq!(get_proxy_url(&s).unwrap(), "https://proxy.example.com:443");
    }

    #[test]
    fn reject_bad_protocol() {
        let s = ProxySettings {
            enabled: true,
            protocol: Some("ftp".into()),
            host: None,
            port: None,
        };
        let err = get_proxy_url(&s).unwrap_err();
        assert!(err.contains("Invalid proxy protocol"));
    }

    #[test]
    fn reject_zero_port() {
        let s = ProxySettings {
            enabled: true,
            protocol: None,
            host: None,
            port: Some(0),
        };
        let err = get_proxy_url(&s).unwrap_err();
        assert!(err.contains("Invalid proxy port"));
    }
}
