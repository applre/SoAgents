/// Centralized HTTP client builders for localhost connections.
///
/// All reqwest clients connecting to local Sidecar (127.0.0.1) MUST use these
/// builders. They include `.no_proxy()` to prevent system proxies (Clash/V2Ray)
/// from intercepting localhost traffic, which would cause 502 errors.

/// Async client builder with `.no_proxy()` pre-configured.
pub fn builder() -> reqwest::ClientBuilder {
    reqwest::Client::builder().no_proxy()
}

/// Blocking client builder with `.no_proxy()` pre-configured.
pub fn blocking_builder() -> reqwest::blocking::ClientBuilder {
    reqwest::blocking::Client::builder().no_proxy()
}
