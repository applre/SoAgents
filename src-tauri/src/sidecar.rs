use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU16, Ordering};

pub const GLOBAL_SIDECAR_ID: &str = "__global__";
const BASE_PORT: u16 = 32415;
const SIDECAR_MARKER: &str = "--soagents-sidecar";

pub struct SidecarInstance {
    pub process: Child,
    pub port: u16,
    pub agent_dir: Option<PathBuf>,
    pub healthy: bool,
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

impl SidecarManager {
    pub fn new() -> Self {
        SidecarManager {
            instances: HashMap::new(),
            port_counter: AtomicU16::new(BASE_PORT),
        }
    }

    pub fn start_sidecar(
        &mut self,
        tab_id: String,
        agent_dir: Option<PathBuf>,
    ) -> Result<u16, String> {
        ensure_high_file_descriptor_limit();

        // 如果已存在且进程仍在运行，直接返回现有端口（幂等）
        if let Some(instance) = self.instances.get_mut(&tab_id) {
            if let Ok(None) = instance.process.try_wait() {
                return Ok(instance.port);
            }
            // 进程已退出，移除后重启
            self.instances.remove(&tab_id);
        }

        // 分配端口
        let port = self.port_counter.fetch_add(1, Ordering::SeqCst);

        // 找 bun 路径
        let bun_path = which::which("bun")
            .map_err(|e| format!("Cannot find bun: {}", e))?;

        // 获取项目根目录（src-tauri 的上级目录）
        let project_root = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));

        // 在开发模式下，使用 CARGO_MANIFEST_DIR 的父目录
        let cwd = if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            PathBuf::from(manifest_dir)
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or(project_root)
        } else {
            project_root
        };

        log::info!(
            "[Sidecar] Starting sidecar for tab '{}' on port {} in {:?}",
            tab_id,
            port,
            cwd
        );

        // 启动 bun 进程
        let mut child = Command::new(&bun_path)
            .arg("run")
            .arg("src/server/index.ts")
            .arg(SIDECAR_MARKER)
            .current_dir(&cwd)
            .env("PORT", port.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
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

        // 健康检查（同步 reqwest，禁用系统代理避免被 Clash/V2Ray 拦截）
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .build()
            .unwrap_or_default();
        let health_url = format!("http://127.0.0.1:{}/health", port);
        let mut healthy = false;

        for _ in 0..60 {
            std::thread::sleep(std::time::Duration::from_millis(100));
            match client.get(&health_url).send() {
                Ok(resp) => {
                    if let Ok(json) = resp.json::<serde_json::Value>() {
                        if json.get("port").and_then(|p| p.as_u64()) == Some(port as u64) {
                            healthy = true;
                            break;
                        }
                    }
                }
                Err(_) => {}
            }
        }

        if !healthy {
            log::warn!(
                "[Sidecar] Health check failed for tab '{}' on port {}",
                tab_id,
                port
            );
        } else {
            log::info!(
                "[Sidecar] Sidecar for tab '{}' is healthy on port {}",
                tab_id,
                port
            );
        }

        self.instances.insert(
            tab_id,
            SidecarInstance {
                process: child,
                port,
                agent_dir,
                healthy,
            },
        );

        Ok(port)
    }

    pub fn stop_sidecar(&mut self, tab_id: &str) -> Result<(), String> {
        if let Some(mut instance) = self.instances.remove(tab_id) {
            log::info!("[Sidecar] Stopping sidecar for tab '{}'", tab_id);

            // 发送 kill 信号（Rust 的 kill() 在 Unix 上发送 SIGKILL，Windows 上用 TerminateProcess）
            // 先尝试 kill，再 wait
            let _ = instance.process.kill();

            // 等待进程结束（最多 5 秒）
            let start = std::time::Instant::now();
            loop {
                match instance.process.try_wait() {
                    Ok(Some(_)) => break,
                    Ok(None) => {
                        if start.elapsed() > std::time::Duration::from_secs(5) {
                            log::warn!(
                                "[Sidecar] Process for tab '{}' did not exit in 5s",
                                tab_id
                            );
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                    Err(e) => {
                        log::error!("[Sidecar] Error waiting for process: {}", e);
                        break;
                    }
                }
            }

            log::info!("[Sidecar] Sidecar for tab '{}' stopped", tab_id);
        }
        Ok(())
    }

    pub fn stop_all(&mut self) {
        let tab_ids: Vec<String> = self.instances.keys().cloned().collect();
        for tab_id in tab_ids {
            let _ = self.stop_sidecar(&tab_id);
        }
    }

    pub fn get_port(&self, tab_id: &str) -> Option<u16> {
        self.instances.get(tab_id).map(|i| i.port)
    }
}
