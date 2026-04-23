//! Spawn and manage the Bun-based Plugin Bridge subprocess.
//!
//! A Bridge instance is spawned per running IM bot that uses an OpenClaw
//! plugin. The Bridge loads the plugin's npm package in-process, exposes
//! an HTTP API on `port`, and POSTs inbound messages back to Rust on
//! `rust_port`.
//!
//! This module owns only the process lifecycle (spawn / kill / health
//! check). Message routing (`BridgeSenderEntry` + HTTP adapter methods)
//! lives in stage 1.3d's `src/im/bridge.rs`.

// BridgeProcess + spawn_plugin_bridge are wired through the dev-only
// smoke-test command (`cmd_openclaw_spawn_bridge_test` in commands.rs).
// Stage 1.3d will replace that with full BridgeAdapter integration.
#![allow(dead_code)]

use std::path::PathBuf;
use std::process::{Child, Stdio};
use std::time::Duration;

use serde_json::Value;

/// Handle to a running Bridge process. Drop-safe: killing the child on
/// drop is the caller's responsibility (call [`BridgeProcess::kill_sync`]
/// or [`BridgeProcess::kill`]).
pub struct BridgeProcess {
    pub child: Child,
    pub port: u16,
}

impl BridgeProcess {
    /// Synchronous kill + reap. Safe to call multiple times.
    pub fn kill_sync(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }

    /// Async wrapper — internally kill + reap are fast since the signal
    /// is already queued; runs on the current task to avoid tokio spawn
    /// overhead.
    pub async fn kill(&mut self) {
        self.kill_sync();
    }
}

/// Locate the Plugin Bridge entry script.
/// - **Production**: `<resource_dir>/plugin-bridge-dist.js` (pre-bundled)
/// - **Development**: `<workspace>/src/server/plugin-bridge/index.ts` (run via bun)
fn find_bridge_script<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Option<PathBuf> {
    // Production: bundled single-file JS.
    #[cfg(not(debug_assertions))]
    {
        use tauri::Manager;
        if let Ok(resource_dir) = app_handle.path().resource_dir() {
            let bundled = resource_dir.join("plugin-bridge-dist.js");
            if bundled.exists() {
                log::info!("[openclaw] using bundled bridge script: {:?}", bundled);
                return Some(bundled);
            }
        }
    }

    // Development: TypeScript source tree, bun runs it directly.
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let project_root = std::path::Path::new(manifest_dir)
        .parent()
        .unwrap_or(std::path::Path::new("."));
    let dev_path = project_root.join("src/server/plugin-bridge/index.ts");
    if dev_path.exists() {
        log::info!("[openclaw] using dev bridge script: {:?}", dev_path);
        return Some(dev_path);
    }

    let _ = app_handle;
    log::error!("[openclaw] bridge script not found (neither bundled JS nor dev TS)");
    None
}

/// Spawn a Plugin Bridge subprocess.
///
/// Arguments match MyAgents' contract:
///   - `plugin_dir`: path to `~/.soagents/openclaw-plugins/<pluginId>/`
///   - `port`: port the Bridge HTTP server will listen on
///   - `rust_port`: port of the Rust `/api/im-bridge/*` endpoints (stage 1.3d)
///   - `bot_id`: channel instance ID for log tagging + message routing
///   - `plugin_config`: user-supplied config (e.g. `{ appId, appSecret }`)
///
/// Returns once the Bridge's `/health` endpoint reports OK (up to 15s).
/// On timeout or spawn failure the child is killed before the Err is
/// returned.
pub async fn spawn_plugin_bridge<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    plugin_dir: &str,
    port: u16,
    rust_port: u16,
    bot_id: &str,
    plugin_config: Option<&Value>,
) -> Result<BridgeProcess, String> {
    let bun_path = crate::sidecar::find_bun_executable(app_handle)
        .map_err(|e| format!("Bun executable not found: {}", e))?;

    let bridge_script = find_bridge_script(app_handle)
        .ok_or_else(|| "Plugin bridge script not found".to_string())?;

    let config_json = plugin_config
        .map(|v| v.to_string())
        .unwrap_or_else(|| "{}".to_string());

    // Re-install the sdk-shim on every Bridge spawn if npm/bun has overwritten
    // node_modules/openclaw/ back to the real package since last install.
    {
        let openclaw_pkg = std::path::Path::new(plugin_dir)
            .join("node_modules")
            .join("openclaw")
            .join("package.json");
        let needs_repair = if openclaw_pkg.exists() {
            std::fs::read_to_string(&openclaw_pkg)
                .ok()
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                .map(|v| {
                    let version = v.get("version").and_then(|x| x.as_str()).unwrap_or("");
                    !version.contains("-shim")
                })
                .unwrap_or(true)
        } else {
            true
        };
        if needs_repair {
            log::warn!(
                "[openclaw] shim missing / not a shim at {:?}, re-installing",
                openclaw_pkg
            );
            let _ = super::shim::install_sdk_shim(
                app_handle,
                &std::path::PathBuf::from(plugin_dir),
            )
            .await;
        }
    }

    log::info!(
        "[openclaw] spawning bridge: bun={:?} script={:?} plugin_dir={} port={} rust_port={} bot_id={}",
        bun_path, bridge_script, plugin_dir, port, rust_port, bot_id
    );

    let mut cmd = crate::process_cmd::new(&bun_path);
    cmd.arg(bridge_script.to_string_lossy().as_ref())
        // Marker for stale-process cleanup: sidecar scanner can kill orphan
        // bridges by filtering `ps` output for this flag.
        .arg("--soagents-sidecar")
        .arg("--plugin-dir")
        .arg(plugin_dir)
        .arg("--port")
        .arg(port.to_string())
        .arg("--rust-port")
        .arg(rust_port.to_string())
        .arg("--bot-id")
        .arg(bot_id)
        // Config via env var so secrets don't leak into `ps` listings.
        .env("BRIDGE_PLUGIN_CONFIG", &config_json);

    // Route the plugin's outbound requests (feishu / qq / wecom APIs) through
    // the user's proxy. Always forces NO_PROXY so rust_port callbacks to
    // localhost don't get intercepted by system proxy.
    crate::proxy_config::apply_to_subprocess(&mut cmd);

    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn bridge process: {}", e))?;

    // Pipe stdout/stderr to the logger, tagged with bot_id.
    {
        use std::io::{BufRead, BufReader};
        if let Some(stdout) = child.stdout.take() {
            let bot_id_clone = bot_id.to_string();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    // Suppress high-frequency heartbeat noise; only keep anomalies.
                    if line.contains("Heartbeat sent")
                        || line.contains("Heartbeat ACK")
                        || line.contains("Received op=11")
                    {
                        continue;
                    }
                    log::info!("[bridge-out][{}] {}", bot_id_clone, line);
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let bot_id_clone = bot_id.to_string();
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    log::error!("[bridge-err][{}] {}", bot_id_clone, line);
                }
            });
        }
    }

    // Wait for Bridge to become healthy: up to 30 attempts × 500ms = 15s.
    let client = reqwest::Client::builder()
        .no_proxy() // CLAUDE.md rule: localhost HTTP must bypass system proxy.
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("http client build: {}", e))?;
    let health_url = format!("http://127.0.0.1:{}/health", port);

    for attempt in 0..30 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        match client.get(&health_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                log::info!(
                    "[openclaw] bridge {} healthy after {} attempts",
                    bot_id,
                    attempt + 1
                );
                return Ok(BridgeProcess { child, port });
            }
            _ => {
                if attempt % 5 == 4 {
                    log::debug!(
                        "[openclaw] bridge health attempt {} pending, retrying...",
                        attempt + 1
                    );
                }
            }
        }
    }

    // Timed out — kill the orphan.
    let _ = child.kill();
    let _ = child.wait();
    Err("Bridge process did not become healthy within 15s".to_string())
}
