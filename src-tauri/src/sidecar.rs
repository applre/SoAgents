use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU16, Ordering};
use std::thread;
use std::time::Duration;

pub const GLOBAL_SIDECAR_ID: &str = "__global__";
const BASE_PORT: u16 = 32415;
const SIDECAR_MARKER: &str = "--soagents-sidecar";

// Health check constants (TCP-level, matching MyAgents proven strategy)
const HEALTH_CHECK_MAX_ATTEMPTS: u32 = 600;
const HEALTH_CHECK_DELAY_MS: u64 = 500;
const HEALTH_CHECK_TIMEOUT_MS: u64 = 100;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SidecarOwner {
    Session(String),
}

pub struct SidecarInstance {
    pub process: Child,
    pub port: u16,
    pub agent_dir: Option<PathBuf>,
    pub owners: HashSet<SidecarOwner>,
}

pub struct SidecarManager {
    instances: HashMap<String, SidecarInstance>,
    port_counter: AtomicU16,
}

#[cfg(unix)]
pub fn cleanup_stale_sidecars() {
    log::info!("[sidecar] Cleaning up stale sidecar processes...");

    let output = match Command::new("pgrep").arg("-f").arg("soagents-sidecar").output() {
        Ok(o) => o,
        Err(e) => {
            log::debug!("[sidecar] pgrep failed: {}", e);
            return;
        }
    };

    if !output.status.success() {
        log::info!("[sidecar] No stale sidecar processes found");
        return;
    }

    let pids_str = String::from_utf8_lossy(&output.stdout);
    let pids: Vec<i32> = pids_str
        .lines()
        .filter_map(|line| line.trim().parse::<i32>().ok())
        .collect();

    if pids.is_empty() {
        log::info!("[sidecar] No stale sidecar processes found");
        return;
    }

    let current_pid = std::process::id() as i32;

    for pid in &pids {
        if *pid == current_pid {
            continue;
        }
        log::info!("[sidecar] Sending SIGTERM to stale sidecar pid {}", pid);
        unsafe {
            libc::kill(*pid, libc::SIGTERM);
        }
    }

    std::thread::sleep(std::time::Duration::from_millis(300));

    for pid in &pids {
        if *pid == current_pid {
            continue;
        }
        log::info!("[sidecar] Sending SIGKILL to stale sidecar pid {}", pid);
        unsafe {
            libc::kill(*pid, libc::SIGKILL);
        }
    }

    log::info!("[sidecar] Stale sidecar cleanup complete");
}

#[cfg(not(unix))]
pub fn cleanup_stale_sidecars() {
    log::debug!("[sidecar] Stale sidecar cleanup not supported on this platform");
}

#[cfg(unix)]
pub fn ensure_high_file_descriptor_limit() {
    use std::sync::Once;
    static INIT: Once = Once::new();
    INIT.call_once(|| {
        let mut rlim = libc::rlimit {
            rlim_cur: 0,
            rlim_max: 0,
        };
        unsafe {
            if libc::getrlimit(libc::RLIMIT_NOFILE, &mut rlim) == 0 {
                log::info!(
                    "[sidecar] Current fd limit: soft={}, hard={}",
                    rlim.rlim_cur,
                    rlim.rlim_max
                );
                let target: u64 = 65536;
                if (rlim.rlim_cur as u64) < target {
                    let new_soft = if (rlim.rlim_max as u64) < target {
                        rlim.rlim_max
                    } else {
                        target as libc::rlim_t
                    };
                    rlim.rlim_cur = new_soft;
                    if libc::setrlimit(libc::RLIMIT_NOFILE, &rlim) == 0 {
                        log::info!("[sidecar] Raised fd limit to {}", new_soft);
                    } else {
                        log::warn!("[sidecar] Failed to raise fd limit");
                    }
                }
            } else {
                log::warn!("[sidecar] Failed to get fd limit");
            }
        }
    });
}

#[cfg(not(unix))]
pub fn ensure_high_file_descriptor_limit() {}

/// Find bundled bun binary (from externalBin), fallback to system PATH
pub fn find_bun_executable<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    use tauri::Manager;

    // 1. Try bundled bun via Tauri resource_dir (release mode)
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        if let Some(contents_dir) = resource_dir.parent() {
            // externalBin puts binary in Contents/MacOS/ with target triple suffix
            #[cfg(target_arch = "aarch64")]
            let bundled_bun = contents_dir.join("MacOS").join("bun-aarch64-apple-darwin");
            #[cfg(target_arch = "x86_64")]
            let bundled_bun = contents_dir.join("MacOS").join("bun-x86_64-apple-darwin");

            if bundled_bun.exists() {
                log::info!("[sidecar] Using bundled bun: {:?}", bundled_bun);
                return Ok(bundled_bun);
            }

            // Fallback: no arch suffix
            let bundled_bun_simple = contents_dir.join("MacOS").join("bun");
            if bundled_bun_simple.exists() {
                log::info!("[sidecar] Using bundled bun (no suffix): {:?}", bundled_bun_simple);
                return Ok(bundled_bun_simple);
            }
        }
    }

    // 2. Try binaries/ dir relative to CARGO_MANIFEST_DIR (dev mode)
    if cfg!(debug_assertions) {
        let dev_bun = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries").join("bun-aarch64-apple-darwin");
        if dev_bun.exists() {
            log::info!("[sidecar] Using dev bundled bun: {:?}", dev_bun);
            return Ok(dev_bun);
        }
    }

    // 3. Fallback to system PATH
    if let Ok(system_bun) = which::which("bun") {
        log::info!("[sidecar] Using system bun: {:?}", system_bun);
        return Ok(system_bun);
    }

    // 4. Common locations
    let home = std::env::var("HOME").unwrap_or_default();
    let common_paths = [
        format!("{}/.bun/bin/bun", home),
        "/opt/homebrew/bin/bun".to_string(),
        "/usr/local/bin/bun".to_string(),
    ];
    for path in &common_paths {
        let p = PathBuf::from(path);
        if p.exists() {
            log::info!("[sidecar] Using bun from common path: {:?}", p);
            return Ok(p);
        }
    }

    Err("Bun executable not found. Please install bun: https://bun.sh".to_string())
}

/// Find server script: bundled server-dist.js in release, source index.ts in dev
pub fn find_server_script<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    // Release mode: use bundled server-dist.js
    #[cfg(not(debug_assertions))]
    {
        use tauri::Manager;
        if let Ok(resource_dir) = app_handle.path().resource_dir() {
            let bundled = resource_dir.join("server-dist.js");
            if bundled.exists() {
                log::info!("[sidecar] Using bundled server script: {:?}", bundled);
                return Ok(bundled);
            }
            log::warn!("[sidecar] Bundled server-dist.js not found in {:?}", resource_dir);
        }
    }

    // Dev mode: use source file
    #[cfg(debug_assertions)]
    {
        let _ = app_handle; // suppress unused warning in dev
        let dev_script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(|p| p.join("src").join("server").join("index.ts"));

        if let Some(ref path) = dev_script {
            if path.exists() {
                log::info!("[sidecar] Using dev server script: {:?}", path);
                return Ok(path.clone());
            }
        }

        // Fallback: relative to cwd
        if let Ok(cwd) = std::env::current_dir() {
            let cwd_script = cwd.join("src").join("server").join("index.ts");
            if cwd_script.exists() {
                log::info!("[sidecar] Using cwd server script: {:?}", cwd_script);
                return Ok(cwd_script);
            }
        }
    }

    Err("Server script not found".to_string())
}

impl SidecarManager {
    pub fn new() -> Self {
        SidecarManager {
            instances: HashMap::new(),
            port_counter: AtomicU16::new(BASE_PORT),
        }
    }

    pub fn start_sidecar(
        &mut self,
        sidecar_id: String,
        agent_dir: Option<PathBuf>,
        bun_path: &PathBuf,
        script_path: &PathBuf,
        owner: Option<SidecarOwner>,
    ) -> Result<u16, String> {
        ensure_high_file_descriptor_limit();

        // Idempotent: if already running, add owner and return existing port
        if let Some(instance) = self.instances.get_mut(&sidecar_id) {
            if let Ok(None) = instance.process.try_wait() {
                if let Some(o) = owner {
                    log::info!("[sidecar] Adding owner {:?} to sidecar '{}'", o, sidecar_id);
                    instance.owners.insert(o);
                }
                return Ok(instance.port);
            }
            self.instances.remove(&sidecar_id);
        }

        let mut initial_owners = HashSet::new();
        if let Some(o) = owner {
            initial_owners.insert(o);
        }

        let port = self.port_counter.fetch_add(1, Ordering::SeqCst);

        // Determine cwd: use script's parent dir for bundled, project root for dev
        let cwd = if script_path.extension().map(|e| e == "js").unwrap_or(false) {
            // Bundled: server-dist.js — cwd doesn't matter much, use its parent
            script_path.parent().map(|p| p.to_path_buf())
        } else {
            // Dev: src/server/index.ts — need project root as cwd
            script_path
                .parent() // src/server/
                .and_then(|p| p.parent()) // src/
                .and_then(|p| p.parent()) // project root
                .map(|p| p.to_path_buf())
        };

        let cwd = cwd.unwrap_or_else(|| PathBuf::from("."));

        log::info!(
            "[sidecar] Starting sidecar '{}' on port {} | bun={:?} script={:?} cwd={:?}",
            sidecar_id,
            port,
            bun_path,
            script_path,
            cwd
        );

        let mut cmd = Command::new(bun_path);
        cmd.arg(script_path)
            .arg(SIDECAR_MARKER)
            .current_dir(&cwd)
            .env("PORT", port.to_string())
            .env("BUN_EXECUTABLE", bun_path.to_string_lossy().as_ref())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Inject proxy environment variables if configured
        if let Some(proxy_settings) = crate::proxy_config::read_proxy_settings() {
            match crate::proxy_config::get_proxy_url(&proxy_settings) {
                Ok(proxy_url) => {
                    log::info!("[sidecar] Injecting proxy: {}", proxy_url);
                    cmd.env("HTTP_PROXY", &proxy_url);
                    cmd.env("HTTPS_PROXY", &proxy_url);
                    cmd.env("http_proxy", &proxy_url);
                    cmd.env("https_proxy", &proxy_url);
                    cmd.env("NO_PROXY", "localhost,localhost.localdomain,127.0.0.1,127.0.0.0/8,::1,[::1]");
                    cmd.env("no_proxy", "localhost,localhost.localdomain,127.0.0.1,127.0.0.0/8,::1,[::1]");
                }
                Err(e) => {
                    log::error!("[sidecar] Invalid proxy config: {}, stripping proxy vars", e);
                    for var in &["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy", "NO_PROXY", "no_proxy"] {
                        cmd.env_remove(var);
                    }
                }
            }
        } else {
            // No proxy configured: strip inherited system proxy env vars
            for var in &["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy", "NO_PROXY", "no_proxy"] {
                cmd.env_remove(var);
            }
        }

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn bun process: {}", e))?;

        // Capture stdout
        if let Some(stdout) = child.stdout.take() {
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().flatten() {
                    log::info!("[bun-out] {}", line);
                }
            });
        }

        // Capture stderr
        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().flatten() {
                    log::warn!("[bun-err] {}", line);
                }
            });
        }

        // Brief wait to check if process exits immediately (e.g. missing script, bad bun binary)
        thread::sleep(Duration::from_millis(50));
        if let Ok(Some(status)) = child.try_wait() {
            thread::sleep(Duration::from_millis(100)); // let stderr thread capture output
            log::error!("[sidecar] Process exited immediately with status: {:?}", status);
            return Err(format!(
                "Sidecar '{}' exited immediately with status: {:?}",
                sidecar_id, status
            ));
        }

        // TCP health check — faster than HTTP because Bun binds TCP before HTTP handler is ready
        match wait_for_health(port, None) {
            Ok(()) => {
                log::info!(
                    "[sidecar] Sidecar '{}' is healthy on port {}",
                    sidecar_id,
                    port
                );
            }
            Err(e) => {
                log::warn!(
                    "[sidecar] Health check failed for sidecar '{}': {}",
                    sidecar_id,
                    e
                );
            }
        }

        self.instances.insert(
            sidecar_id,
            SidecarInstance {
                process: child,
                port,
                agent_dir,
                owners: initial_owners,
            },
        );

        Ok(port)
    }

    /// Release an owner from a sidecar. If no owners remain, stop the sidecar process.
    /// Returns Ok(true) if sidecar was stopped, Ok(false) if other owners remain.
    pub fn release_sidecar(&mut self, sidecar_id: &str, owner: &SidecarOwner) -> Result<bool, String> {
        if let Some(instance) = self.instances.get_mut(sidecar_id) {
            log::info!("[sidecar] Releasing owner {:?} from sidecar '{}'", owner, sidecar_id);
            instance.owners.remove(owner);
            if instance.owners.is_empty() {
                log::info!("[sidecar] No owners remain for sidecar '{}', stopping", sidecar_id);
                self.stop_sidecar(sidecar_id)?;
                return Ok(true);
            }
            log::info!("[sidecar] Sidecar '{}' still has {} owner(s)", sidecar_id, instance.owners.len());
            Ok(false)
        } else {
            Ok(true) // Already gone
        }
    }

    pub fn stop_sidecar(&mut self, sidecar_id: &str) -> Result<(), String> {
        if let Some(mut instance) = self.instances.remove(sidecar_id) {
            log::info!("[sidecar] Stopping sidecar '{}'", sidecar_id);

            let _ = instance.process.kill();

            let start = std::time::Instant::now();
            loop {
                match instance.process.try_wait() {
                    Ok(Some(_)) => break,
                    Ok(None) => {
                        if start.elapsed() > std::time::Duration::from_secs(5) {
                            log::warn!(
                                "[sidecar] Process '{}' did not exit in 5s",
                                sidecar_id
                            );
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                    Err(e) => {
                        log::error!("[sidecar] Error waiting for process: {}", e);
                        break;
                    }
                }
            }

            log::info!("[sidecar] Sidecar '{}' stopped", sidecar_id);
        }
        Ok(())
    }

    pub fn stop_all(&mut self) {
        let sidecar_ids: Vec<String> = self.instances.keys().cloned().collect();
        for sidecar_id in sidecar_ids {
            let _ = self.stop_sidecar(&sidecar_id);
        }
    }

    pub fn get_port(&self, sidecar_id: &str) -> Option<u16> {
        self.instances.get(sidecar_id).map(|i| i.port)
    }

    /// Get all ports of running sidecars (for broadcasting config changes)
    pub fn get_all_active_ports(&mut self) -> Vec<u16> {
        self.instances.retain(|_, inst| matches!(inst.process.try_wait(), Ok(None)));
        self.instances.values().map(|i| i.port).collect()
    }

    pub fn list_running(&mut self) -> Vec<(String, Option<String>, u16)> {
        // 清理已退出的进程
        self.instances.retain(|_, inst| {
            matches!(inst.process.try_wait(), Ok(None))
        });
        self.instances
            .iter()
            .map(|(id, inst)| {
                (
                    id.clone(),
                    inst.agent_dir
                        .as_ref()
                        .map(|p| p.to_string_lossy().to_string()),
                    inst.port,
                )
            })
            .collect()
    }
}

/// Wait for a new sidecar to become healthy using TCP-level check.
/// TCP check is faster than HTTP because Bun binds the TCP port before the HTTP handler is ready.
/// Checks first, then sleeps — avoids wasting time if the port is already bound.
///
/// `alive_check`: optional closure that returns `true` if the sidecar process is still alive.
/// Checked every 20 iterations to detect early crashes.
fn wait_for_health(port: u16, alive_check: Option<Box<dyn Fn() -> bool>>) -> Result<(), String> {
    let delay = Duration::from_millis(HEALTH_CHECK_DELAY_MS);

    for attempt in 1..=HEALTH_CHECK_MAX_ATTEMPTS {
        // Every 20 attempts, check if process is still alive
        if attempt % 20 == 0 {
            if let Some(ref check) = alive_check {
                if !check() {
                    return Err(format!(
                        "Sidecar process exited during health check on port {} (detected at attempt {})",
                        port, attempt
                    ));
                }
            }
        }

        match std::net::TcpStream::connect_timeout(
            &format!("127.0.0.1:{}", port).parse().unwrap(),
            Duration::from_millis(HEALTH_CHECK_TIMEOUT_MS),
        ) {
            Ok(_) => {
                log::info!("[sidecar] TCP health check passed after {} attempts on port {}", attempt, port);
                return Ok(());
            }
            Err(_) => {
                if attempt < HEALTH_CHECK_MAX_ATTEMPTS {
                    thread::sleep(delay);
                }
            }
        }
    }

    Err(format!(
        "Sidecar failed TCP health check after {} attempts on port {}",
        HEALTH_CHECK_MAX_ATTEMPTS, port
    ))
}
