use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub const GLOBAL_SIDECAR_ID: &str = "__global__";
const BASE_PORT: u16 = 32415;
const PORT_RANGE: u16 = 500;
const SIDECAR_MARKER: &str = "--soagents-sidecar";

// Health check constants (TCP-level, matching MyAgents proven strategy)
const HEALTH_CHECK_MAX_ATTEMPTS: u32 = 600;
const HEALTH_CHECK_DELAY_MS: u64 = 500;
const HEALTH_CHECK_TIMEOUT_MS: u64 = 100;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SidecarOwner {
    Session(String),
}

/// Kill a child process and its entire process group (Unix).
/// SIGTERM first for graceful shutdown, SIGKILL after 2s timeout.
fn kill_process(child: &mut Child) -> Result<(), String> {
    #[cfg(unix)]
    {
        let pgid = child.id() as i32;
        // Kill entire process group (sidecar + SDK/MCP children)
        unsafe { libc::kill(-pgid, libc::SIGTERM); }

        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        loop {
            match child.try_wait() {
                Ok(Some(_)) => return Ok(()),
                Ok(None) if std::time::Instant::now() < deadline => {
                    thread::sleep(Duration::from_millis(50));
                }
                _ => break,
            }
        }
        // Force kill
        unsafe { libc::kill(-pgid, libc::SIGKILL); }
        let _ = child.wait(); // reap zombie
    }
    #[cfg(not(unix))]
    {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

pub struct SidecarInstance {
    pub process: Child,
    pub port: u16,
    pub agent_dir: Option<PathBuf>,
    pub owners: HashSet<SidecarOwner>,
    pub healthy: bool,
}

impl SidecarInstance {
    /// Check if the sidecar process is still running and healthy.
    pub fn is_running(&mut self) -> bool {
        if !self.healthy {
            return false;
        }
        match self.process.try_wait() {
            Ok(Some(_)) => { self.healthy = false; false }
            Ok(None) => true,
            Err(_) => { self.healthy = false; false }
        }
    }
}

impl Drop for SidecarInstance {
    fn drop(&mut self) {
        log::info!("[sidecar] Drop: killing process on port {}", self.port);
        let _ = kill_process(&mut self.process);
    }
}

pub struct SidecarManager {
    instances: HashMap<String, SidecarInstance>,
    port_counter: AtomicU16,
}

/// Arc<Mutex<SidecarManager>> for sharing between Tauri commands and background tasks
pub type ManagedSidecarState = Arc<Mutex<SidecarManager>>;

// ── Stale process cleanup ──────────────────────────────────────────

/// Find PIDs by command line pattern, excluding current process.
/// Uses "--" separator before pattern to handle patterns starting with "-".
#[cfg(unix)]
fn find_pids_by_pattern(pattern: &str) -> Vec<i32> {
    let current_pid = std::process::id() as i32;

    Command::new("pgrep")
        .args(["-f", "--", pattern])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter_map(|s| s.trim().parse::<i32>().ok())
                .filter(|&pid| pid != current_pid)
                .collect()
        })
        .unwrap_or_default()
}

/// Check if a process is orphaned (PPID≤1, reparented to launchd/init).
/// Orphaned processes are leftovers from crashed app instances.
/// Processes with a living parent belong to another running SoAgents instance.
#[cfg(unix)]
fn is_orphaned(pid: i32) -> bool {
    Command::new("ps")
        .args(["-o", "ppid=", "-p", &pid.to_string()])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<i32>().ok())
        .map(|ppid| ppid <= 1)
        .unwrap_or(true)
}

/// Kill orphaned processes matching pattern. Returns count killed.
/// Only kills processes with PPID≤1 (reparented to launchd) to avoid
/// killing sidecars belonging to other running SoAgents instances.
#[cfg(unix)]
fn kill_orphaned_by_pattern(name: &str, pattern: &str) -> usize {
    let pids: Vec<i32> = find_pids_by_pattern(pattern)
        .into_iter()
        .filter(|&pid| is_orphaned(pid))
        .collect();

    if pids.is_empty() {
        return 0;
    }

    eprintln!("[sidecar] Found {} orphaned {} processes, sending SIGTERM...", pids.len(), name);
    for &pid in &pids {
        unsafe { libc::kill(pid, libc::SIGTERM); }
    }

    thread::sleep(Duration::from_millis(300));

    // Check which processes survived SIGTERM
    let remaining: Vec<&i32> = pids.iter()
        .filter(|&&pid| unsafe { libc::kill(pid, 0) == 0 })
        .collect();
    if !remaining.is_empty() {
        eprintln!("[sidecar] {} orphaned {} processes survived SIGTERM, sending SIGKILL...", remaining.len(), name);
        for &&pid in &remaining {
            unsafe { libc::kill(pid, libc::SIGKILL); }
        }
    }

    let killed = pids.len() - pids.iter().filter(|&&pid| unsafe { libc::kill(pid, 0) == 0 }).count();
    eprintln!("[sidecar] {} cleanup: killed {}/{}", name, killed, pids.len());
    killed
}

#[cfg(unix)]
pub fn cleanup_stale_sidecars() {
    eprintln!("[sidecar] Cleaning up orphaned sidecar processes...");
    let sidecar_count = kill_orphaned_by_pattern("sidecar", SIDECAR_MARKER);
    let sdk_count = kill_orphaned_by_pattern("SDK", "claude-agent-sdk/cli.js");
    eprintln!(
        "[sidecar] Startup cleanup complete: {} sidecar, {} SDK processes cleaned",
        sidecar_count, sdk_count
    );
}

#[cfg(not(unix))]
pub fn cleanup_stale_sidecars() {
    eprintln!("[sidecar] Stale sidecar cleanup not supported on this platform");
}

// ── File descriptor limit ──────────────────────────────────────────

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

// ── Find executables ───────────────────────────────────────────────

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

// ── Port availability ──────────────────────────────────────────────

fn is_port_available(port: u16) -> bool {
    std::net::TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
}

// ── SidecarManager impl ───────────────────────────────────────────

impl SidecarManager {
    pub fn new() -> Self {
        SidecarManager {
            instances: HashMap::new(),
            port_counter: AtomicU16::new(BASE_PORT),
        }
    }

    /// Get the next available port, skipping ports already in use.
    /// Wraps around within PORT_RANGE to reuse freed ports.
    pub fn allocate_port(&self) -> Result<u16, String> {
        const MAX_ATTEMPTS: u32 = 200;

        for _ in 0..MAX_ATTEMPTS {
            let port = self.port_counter.fetch_add(1, Ordering::SeqCst);
            if port > BASE_PORT + PORT_RANGE {
                self.port_counter.store(BASE_PORT, Ordering::SeqCst);
            }
            if is_port_available(port) {
                return Ok(port);
            }
            log::warn!("[sidecar] Port {} in use, trying next", port);
        }

        Err(format!("No available port found after {} attempts", MAX_ATTEMPTS))
    }

    pub fn get_instance_mut(&mut self, sidecar_id: &str) -> Option<&mut SidecarInstance> {
        self.instances.get_mut(sidecar_id)
    }

    pub fn insert_instance(&mut self, sidecar_id: String, instance: SidecarInstance) {
        self.instances.insert(sidecar_id, instance);
    }

    pub fn remove_instance(&mut self, sidecar_id: &str) -> Option<SidecarInstance> {
        self.instances.remove(sidecar_id)
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
        if let Some(_instance) = self.instances.remove(sidecar_id) {
            log::info!("[sidecar] Stopping sidecar '{}' (Drop will kill process)", sidecar_id);
            // Drop handles kill_process automatically
        }
        Ok(())
    }

    pub fn stop_all(&mut self) {
        log::info!("[sidecar] Stopping all sidecars ({})", self.instances.len());
        self.instances.clear(); // Drop kills each process
    }

    pub fn get_port(&mut self, sidecar_id: &str) -> Option<u16> {
        if let Some(inst) = self.instances.get_mut(sidecar_id) {
            if inst.is_running() {
                return Some(inst.port);
            }
        }
        // Do NOT remove dead instances here — the health monitor needs
        // the instance to remain in the HashMap to detect and restart it.
        None
    }

    /// Get all ports of running sidecars (for broadcasting config changes)
    pub fn get_all_active_ports(&mut self) -> Vec<u16> {
        let mut ports = Vec::new();
        for inst in self.instances.values_mut() {
            if inst.is_running() {
                ports.push(inst.port);
            }
        }
        ports
    }

    pub fn list_running(&mut self) -> Vec<(String, Option<String>, u16)> {
        let mut result = Vec::new();
        for (id, inst) in self.instances.iter_mut() {
            if inst.is_running() {
                result.push((
                    id.clone(),
                    inst.agent_dir.as_ref().map(|p| p.to_string_lossy().to_string()),
                    inst.port,
                ));
            }
        }
        result
    }
}

// ── start_sidecar (free function — releases lock during health check) ──

/// Start a sidecar process. Releases the Mutex lock during health check
/// to avoid blocking other sidecar operations for up to 5 minutes.
pub fn start_sidecar(
    manager: &ManagedSidecarState,
    sidecar_id: String,
    agent_dir: Option<PathBuf>,
    bun_path: &PathBuf,
    script_path: &PathBuf,
    owner: Option<SidecarOwner>,
) -> Result<u16, String> {
    ensure_high_file_descriptor_limit();

    let mut guard = manager.lock().map_err(|e| e.to_string())?;

    // Idempotent: if already running, add owner and return existing port
    if let Some(instance) = guard.get_instance_mut(&sidecar_id) {
        if instance.is_running() {
            if let Some(o) = owner {
                log::info!("[sidecar] Adding owner {:?} to sidecar '{}'", o, sidecar_id);
                instance.owners.insert(o);
            }
            return Ok(instance.port);
        }
        // Dead instance — remove (Drop will clean up)
        guard.remove_instance(&sidecar_id);
    }

    let mut initial_owners = HashSet::new();
    if let Some(o) = owner {
        initial_owners.insert(o);
    }

    let port = guard.allocate_port()?;

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
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    // Unix: make child a process group leader so kill(-PGID) kills entire tree
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

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

    // Insert instance with healthy: false BEFORE health check
    guard.insert_instance(
        sidecar_id.clone(),
        SidecarInstance {
            process: child,
            port,
            agent_dir,
            owners: initial_owners,
            healthy: false,
        },
    );

    // Drop lock before blocking health check
    drop(guard);

    // TCP health check (runs without holding the lock)
    match wait_for_health(port, None) {
        Ok(()) => {
            let mut guard = manager.lock().map_err(|e| e.to_string())?;
            if let Some(inst) = guard.get_instance_mut(&sidecar_id) {
                inst.healthy = true;
            }
            log::info!("[sidecar] Sidecar '{}' is healthy on port {}", sidecar_id, port);
            Ok(port)
        }
        Err(e) => {
            log::error!("[sidecar] Health check failed for '{}': {}", sidecar_id, e);
            let mut guard = manager.lock().map_err(|_| e.clone())?;
            guard.remove_instance(&sidecar_id); // Drop kills process
            Err(e)
        }
    }
}

// ── Health checks ──────────────────────────────────────────────────

/// Wait for a new sidecar to become healthy using TCP-level check.
/// TCP check is faster than HTTP because Bun binds TCP before HTTP handler is ready.
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

/// HTTP health check for an existing sidecar (blocking).
fn check_sidecar_http_health(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{}/health", port);
    crate::local_http::blocking_builder()
        .timeout(Duration::from_millis(500))
        .build()
        .ok()
        .and_then(|client| client.get(&url).send().ok())
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

// ── Global Sidecar health monitor ──────────────────────────────────

/// Background health monitor for the Global Sidecar.
/// Periodically checks health and auto-restarts on failure.
/// Emits `global-sidecar:restarted` Tauri event with new URL on restart.
pub async fn monitor_global_sidecar(
    app_handle: tauri::AppHandle,
    manager: ManagedSidecarState,
    shutdown: Arc<std::sync::atomic::AtomicBool>,
) {
    use std::sync::atomic::Ordering::Relaxed;
    use tauri::Emitter;

    const CHECK_INTERVAL_SECS: u64 = 15;
    const MAX_BACKOFF_SECS: u64 = 300;

    let mut consecutive_failures: u32 = 0;
    let mut first_check = true;
    // Track whether the global sidecar was ever seen running.
    // When true and the instance disappears from HashMap (e.g. stop_sidecar),
    // the monitor will restart it instead of skipping.
    let mut ever_seen = false;

    log::info!("[sidecar] Global sidecar health monitor started");

    loop {
        // Delay before check
        if first_check {
            first_check = false;
            tokio::time::sleep(Duration::from_secs(CHECK_INTERVAL_SECS)).await;
        } else if consecutive_failures > 0 {
            let backoff = std::cmp::min(
                CHECK_INTERVAL_SECS.saturating_mul(2u64.saturating_pow(consecutive_failures)),
                MAX_BACKOFF_SECS,
            );
            tokio::time::sleep(Duration::from_secs(backoff)).await;
        } else {
            tokio::time::sleep(Duration::from_secs(CHECK_INTERVAL_SECS)).await;
        }

        if shutdown.load(Relaxed) {
            log::info!("[sidecar] Health monitor stopping (app shutdown)");
            break;
        }

        // Check global sidecar status
        let status = {
            let mut guard = match manager.lock() {
                Ok(g) => g,
                Err(_) => continue,
            };
            match guard.get_instance_mut(GLOBAL_SIDECAR_ID) {
                Some(inst) => {
                    ever_seen = true;
                    Some((inst.port, inst.is_running()))
                }
                None => None,
            }
        };

        let needs_restart = match status {
            Some((port, process_alive)) => {
                if process_alive {
                    // Process alive → verify HTTP health (blocking, off async runtime)
                    let healthy = tokio::task::spawn_blocking(move || {
                        check_sidecar_http_health(port)
                    })
                    .await
                    .unwrap_or(false);
                    !healthy
                } else {
                    true
                }
            }
            None => {
                if ever_seen {
                    // Instance was removed from HashMap (e.g. stop_sidecar)
                    // but sidecar was previously running — need to restart
                    log::warn!("[sidecar] Global sidecar instance gone, will restart");
                    true
                } else {
                    continue; // Not started yet by front-end
                }
            }
        };

        if !needs_restart || shutdown.load(Relaxed) {
            consecutive_failures = 0;
            continue;
        }

        log::warn!("[sidecar] Global sidecar is unhealthy, restarting...");

        // Mark unhealthy so start_sidecar won't short-circuit
        {
            if let Ok(mut guard) = manager.lock() {
                if let Some(inst) = guard.get_instance_mut(GLOBAL_SIDECAR_ID) {
                    inst.healthy = false;
                }
            }
        }

        // Restart (blocking — spawn, health check)
        let app_clone = app_handle.clone();
        let mgr_clone = manager.clone();
        match tokio::task::spawn_blocking(move || {
            let bun_path = find_bun_executable(&app_clone)?;
            let script_path = find_server_script(&app_clone)?;
            start_sidecar(
                &mgr_clone,
                GLOBAL_SIDECAR_ID.to_string(),
                None,
                &bun_path,
                &script_path,
                None,
            )
        })
        .await
        {
            Ok(Ok(new_port)) => {
                consecutive_failures = 0;
                let new_url = format!("http://127.0.0.1:{}", new_port);
                log::info!("[sidecar] Global sidecar restarted on port {} ({})", new_port, new_url);
                let _ = app_handle.emit("global-sidecar:restarted", &new_url);
            }
            Ok(Err(e)) => {
                consecutive_failures += 1;
                log::error!(
                    "[sidecar] Global sidecar restart failed (attempt {}): {}",
                    consecutive_failures, e
                );
            }
            Err(e) => {
                consecutive_failures += 1;
                log::error!("[sidecar] spawn_blocking failed: {}", e);
            }
        }

        if consecutive_failures >= 5 {
            log::error!(
                "[sidecar] {} consecutive restart failures, backing off to {}s",
                consecutive_failures, MAX_BACKOFF_SECS
            );
        }
    }
}
