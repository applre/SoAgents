use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::AppHandle;
use tauri::Emitter;

// ── 日志类型 ──

#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub source: String,
    pub level: String,
    pub message: String,
    pub timestamp: String,
}

// ── 全局 AppHandle ──

static GLOBAL_APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

pub fn init_app_handle(app: &AppHandle) {
    let _ = GLOBAL_APP_HANDLE.set(app.clone());
}

// ── 日志目录 ──

fn log_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join(".soagents")
        .join("logs")
}

fn log_file_path() -> PathBuf {
    let now = time_now_iso();
    let date = &now[..10]; // YYYY-MM-DD
    log_dir().join(format!("unified-{}.log", date))
}

fn time_now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    let millis = dur.subsec_millis();

    // 手动计算 UTC 时间（无 chrono 依赖）
    let days = secs / 86400;
    let rem = secs % 86400;
    let h = rem / 3600;
    let m = (rem % 3600) / 60;
    let s = rem % 60;

    // 从 1970-01-01 计算年月日
    let (y, mo, d) = days_to_ymd(days);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        y, mo, d, h, m, s, millis
    )
}

fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    // 简单的格里高利历计算
    let mut y = 1970;
    loop {
        let dy = if is_leap(y) { 366 } else { 365 };
        if days < dy {
            break;
        }
        days -= dy;
        y += 1;
    }
    let leap = is_leap(y);
    let months: [u64; 12] = [
        31,
        if leap { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut mo = 1;
    for &ml in &months {
        if days < ml {
            break;
        }
        days -= ml;
        mo += 1;
    }
    (y, mo, days + 1)
}

fn is_leap(y: u64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}

// ── 磁盘持久化 ──

fn persist_log(entry: &LogEntry) {
    let dir = log_dir();
    let _ = fs::create_dir_all(&dir);
    let path = log_file_path();
    let src = match entry.source.as_str() {
        "rust" => "RUST ",
        "bun" => "BUN  ",
        "react" => "REACT",
        _ => "?????",
    };
    let lvl = match entry.level.as_str() {
        "info" => "INFO ",
        "warn" => "WARN ",
        "error" => "ERROR",
        "debug" => "DEBUG",
        _ => "?????",
    };
    let line = format!("{} [{}] [{}] {}\n", entry.timestamp, src, lvl, entry.message);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = f.write_all(line.as_bytes());
    }
}

// ── 公共 API ──

pub fn unified_log(level: &str, message: String) {
    let entry = LogEntry {
        source: "rust".to_string(),
        level: level.to_string(),
        message: message.clone(),
        timestamp: time_now_iso(),
    };

    // 写入磁盘
    persist_log(&entry);

    // 发送 Tauri 事件给前端
    if let Some(app) = GLOBAL_APP_HANDLE.get() {
        let _ = app.emit("log:rust", &entry);
    }

    // 同时输出到标准 log 宏
    match level {
        "error" => log::error!("{}", message),
        "warn" => log::warn!("{}", message),
        "debug" => log::debug!("{}", message),
        _ => log::info!("{}", message),
    }
}

// ── 宏 ──

#[macro_export]
macro_rules! ulog_info {
    ($($arg:tt)*) => {
        $crate::logger::unified_log("info", format!($($arg)*))
    };
}

#[macro_export]
macro_rules! ulog_warn {
    ($($arg:tt)*) => {
        $crate::logger::unified_log("warn", format!($($arg)*))
    };
}

#[macro_export]
macro_rules! ulog_error {
    ($($arg:tt)*) => {
        $crate::logger::unified_log("error", format!($($arg)*))
    };
}
