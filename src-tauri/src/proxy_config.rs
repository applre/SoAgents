//! Shared proxy configuration module
//!
//! Reads proxy settings from `~/.soagents/config.json` and provides:
//! 1. Tauri updater proxy configuration
//! 2. Shared reqwest client builder with proxy support

use serde::Deserialize;
use std::fs;

const DEFAULT_PROXY_PROTOCOL: &str = "http";
const DEFAULT_PROXY_HOST: &str = "127.0.0.1";
const DEFAULT_PROXY_PORT: u16 = 7890;

#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettings {
    pub enabled: bool,
    pub protocol: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PartialAppConfig {
    proxy_settings: Option<ProxySettings>,
}

/// Read proxy settings from ~/.soagents/config.json
/// Returns Some(ProxySettings) if proxy is enabled, None otherwise
pub fn read_proxy_settings() -> Option<ProxySettings> {
    let home = dirs::home_dir()?;
    let config_path = home.join(".soagents").join("config.json");

    let content = match fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return None,
        Err(e) => {
            log::warn!("[proxy_config] Failed to read {:?}: {}", config_path, e);
            return None;
        }
    };

    let config: PartialAppConfig = match serde_json::from_str(&content) {
        Ok(c) => c,
        Err(e) => {
            log::error!("[proxy_config] Invalid JSON in {:?}: {}", config_path, e);
            return None;
        }
    };

    config.proxy_settings.filter(|p| p.enabled)
}

/// Get proxy URL string from settings
pub fn get_proxy_url(settings: &ProxySettings) -> Result<String, String> {
    let protocol = settings.protocol.as_deref().unwrap_or(DEFAULT_PROXY_PROTOCOL);
    if !["http", "https", "socks5"].contains(&protocol) {
        return Err(format!("Invalid proxy protocol '{}'", protocol));
    }

    let port = settings.port.unwrap_or(DEFAULT_PROXY_PORT);
    if port == 0 {
        return Err(format!("Invalid proxy port: {}", port));
    }

    let host = settings.host.as_deref().unwrap_or(DEFAULT_PROXY_HOST);
    Ok(format!("{}://{}:{}", protocol, host, port))
}

/// Build a reqwest client with user's proxy configuration
/// - If proxy is enabled in config, use it for external requests
/// - Always exclude localhost/127.0.0.1/::1 from proxy
pub fn build_client_with_proxy(
    builder: reqwest::ClientBuilder,
) -> Result<reqwest::Client, String> {
    let final_builder = if let Some(proxy_settings) = read_proxy_settings() {
        let proxy_url = get_proxy_url(&proxy_settings)?;
        log::info!("[proxy_config] Using proxy for external requests: {}", proxy_url);

        let proxy = reqwest::Proxy::all(&proxy_url)
            .map_err(|e| format!("[proxy_config] Failed to create proxy: {}", e))?
            .no_proxy(reqwest::NoProxy::from_string(
                "localhost,localhost.localdomain,127.0.0.1,127.0.0.0/8,::1,[::1]",
            ));

        builder.proxy(proxy)
    } else {
        log::info!("[proxy_config] No proxy configured, using direct connection");
        builder.no_proxy()
    };

    final_builder
        .build()
        .map_err(|e| format!("[proxy_config] Failed to build HTTP client: {}", e))
}
