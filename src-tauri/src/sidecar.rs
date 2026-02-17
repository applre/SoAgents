use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicU16, Ordering};

pub const GLOBAL_SIDECAR_ID: &str = "__global__";
const BASE_PORT: u16 = 31415;

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
        // 如果已存在，先停止
        if self.instances.contains_key(&tab_id) {
            self.stop_sidecar(&tab_id)?;
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
        let child = Command::new(&bun_path)
            .arg("run")
            .arg("src/server/index.ts")
            .current_dir(&cwd)
            .env("PORT", port.to_string())
            .spawn()
            .map_err(|e| format!("Failed to spawn bun process: {}", e))?;

        // 健康检查（同步 reqwest，禁用系统代理避免被 Clash/V2Ray 拦截）
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .build()
            .unwrap_or_default();
        let health_url = format!("http://127.0.0.1:{}/health", port);
        let mut healthy = false;

        for _ in 0..60 {
            std::thread::sleep(std::time::Duration::from_millis(100));
            if client.get(&health_url).send().is_ok() {
                healthy = true;
                break;
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
