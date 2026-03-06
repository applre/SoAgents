use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{Notify, RwLock};

use crate::sidecar::{self, SidecarOwner};
use crate::commands::SidecarState;

pub type SchedulerState = Arc<RwLock<SchedulerManager>>;

// ── Data Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Schedule {
    #[serde(rename = "at")]
    At { datetime: String },
    #[serde(rename = "every")]
    Every { minutes: u32 },
    #[serde(rename = "cron")]
    Cron {
        expression: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timezone: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskProviderEnv {
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub auth_type: Option<String>,
    pub api_protocol: Option<String>,
    pub timeout: Option<u64>,
    pub disable_nonessential: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskState {
    pub next_run_at_ms: Option<i64>,
    pub last_run_at_ms: Option<i64>,
    pub last_status: Option<String>,
    pub consecutive_errors: u32,
    pub running_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTask {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub schedule: Schedule,
    pub prompt: String,
    pub working_directory: String,
    pub state: TaskState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_env: Option<TaskProviderEnv>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub permission_mode: Option<String>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskInput {
    pub name: String,
    pub schedule: Schedule,
    pub prompt: String,
    pub working_directory: String,
    pub enabled: bool,
    #[serde(default)]
    pub provider_env: Option<TaskProviderEnv>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub permission_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskRun {
    pub id: String,
    pub task_id: String,
    pub task_name: String,
    pub session_id: Option<String>,
    pub status: String,
    pub started_at_ms: i64,
    pub finished_at_ms: Option<i64>,
    pub duration_ms: Option<i64>,
    pub error: Option<String>,
    pub trigger: String,
}

// ── SchedulerManager ──

pub struct SchedulerManager {
    tasks: HashMap<String, ScheduledTask>,
    storage_path: PathBuf,
    runs_dir: PathBuf,
    shutdown: bool,
    executing_tasks: HashSet<String>,
    app_handle: Option<AppHandle>,
    notify: Arc<Notify>,
}

impl SchedulerManager {
    pub fn new() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
        let base = home.join(".soagents");
        let storage_path = base.join("scheduled-tasks.json");
        let runs_dir = base.join("scheduled-task-runs");

        let mut mgr = SchedulerManager {
            tasks: HashMap::new(),
            storage_path,
            runs_dir,
            shutdown: false,
            executing_tasks: HashSet::new(),
            app_handle: None,
            notify: Arc::new(Notify::new()),
        };

        mgr.load_tasks();
        mgr.recover_running_states();
        mgr
    }

    pub fn set_app_handle(&mut self, handle: AppHandle) {
        self.app_handle = Some(handle);
    }

    /// Start the scheduler loop in a background task
    pub async fn start(&self) {
        let notify = self.notify.clone();
        // We need to read from self, but the loop will re-acquire the lock each tick.
        // The caller should spawn this properly.
        // This method just triggers the notify to kick off the first tick.
        notify.notify_one();
    }

    pub fn stop(&mut self) {
        self.shutdown = true;
        self.notify.notify_one();
    }

    pub fn get_notify(&self) -> Arc<Notify> {
        self.notify.clone()
    }

    pub fn is_shutdown(&self) -> bool {
        self.shutdown
    }

    // ── CRUD Methods ──

    pub fn list_tasks(&self) -> Vec<ScheduledTask> {
        let mut tasks: Vec<ScheduledTask> = self.tasks.values().cloned().collect();
        tasks.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
        tasks
    }

    pub fn create_task(&mut self, input: ScheduledTaskInput) -> Result<ScheduledTask, String> {
        let now = Utc::now().timestamp_millis();
        let id = uuid::Uuid::new_v4().to_string();

        let next_run = if input.enabled {
            calculate_next_run_time(&input.schedule, None)?
        } else {
            None
        };

        let task = ScheduledTask {
            id: id.clone(),
            name: input.name,
            enabled: input.enabled,
            schedule: input.schedule,
            prompt: input.prompt,
            working_directory: input.working_directory,
            state: TaskState {
                next_run_at_ms: next_run,
                last_run_at_ms: None,
                last_status: None,
                consecutive_errors: 0,
                running_at_ms: None,
            },
            provider_env: input.provider_env,
            model: input.model,
            permission_mode: input.permission_mode,
            created_at_ms: now,
            updated_at_ms: now,
        };

        self.tasks.insert(id, task.clone());
        self.save_tasks();
        self.notify.notify_one();

        Ok(task)
    }

    pub fn update_task(&mut self, id: String, input: ScheduledTaskInput) -> Result<ScheduledTask, String> {
        let task = self.tasks.get_mut(&id).ok_or_else(|| format!("Task not found: {}", id))?;
        let now = Utc::now().timestamp_millis();

        task.name = input.name;
        task.schedule = input.schedule.clone();
        task.prompt = input.prompt;
        task.working_directory = input.working_directory;
        task.enabled = input.enabled;
        task.provider_env = input.provider_env;
        task.model = input.model;
        task.permission_mode = input.permission_mode;
        task.updated_at_ms = now;

        if input.enabled {
            task.state.next_run_at_ms = calculate_next_run_time(&input.schedule, task.state.last_run_at_ms)?;
            task.state.consecutive_errors = 0;
        } else {
            task.state.next_run_at_ms = None;
        }

        let updated = task.clone();
        self.save_tasks();
        self.notify.notify_one();

        Ok(updated)
    }

    pub fn delete_task(&mut self, id: &str) -> Result<(), String> {
        self.tasks.remove(id).ok_or_else(|| format!("Task not found: {}", id))?;
        self.save_tasks();

        // Delete runs file
        let runs_file = self.runs_dir.join(format!("{}.jsonl", id));
        let _ = fs::remove_file(runs_file);

        if let Some(ref app) = self.app_handle {
            let _ = app.emit("scheduler:task-deleted", id);
        }

        Ok(())
    }

    pub fn toggle_task(&mut self, id: &str) -> Result<ScheduledTask, String> {
        let task = self.tasks.get_mut(id).ok_or_else(|| format!("Task not found: {}", id))?;
        task.enabled = !task.enabled;
        task.updated_at_ms = Utc::now().timestamp_millis();

        if task.enabled {
            task.state.next_run_at_ms = calculate_next_run_time(&task.schedule, task.state.last_run_at_ms)?;
            task.state.consecutive_errors = 0;
        } else {
            task.state.next_run_at_ms = None;
        }

        let toggled = task.clone();
        self.save_tasks();
        self.notify.notify_one();

        if let Some(ref app) = self.app_handle {
            let _ = app.emit("scheduler:task-updated", &toggled);
        }

        Ok(toggled)
    }

    pub fn get_task(&self, id: &str) -> Option<&ScheduledTask> {
        self.tasks.get(id)
    }

    pub fn get_task_mut(&mut self, id: &str) -> Option<&mut ScheduledTask> {
        self.tasks.get_mut(id)
    }

    pub fn is_executing(&self, id: &str) -> bool {
        self.executing_tasks.contains(id)
    }

    pub fn mark_executing(&mut self, id: &str) {
        self.executing_tasks.insert(id.to_string());
    }

    pub fn unmark_executing(&mut self, id: &str) {
        self.executing_tasks.remove(id);
    }

    pub fn app_handle(&self) -> Option<&AppHandle> {
        self.app_handle.as_ref()
    }

    // ── Tick: collect due tasks ──

    pub fn collect_due_tasks(&self) -> Vec<String> {
        let now = Utc::now().timestamp_millis();
        let mut due = Vec::new();

        for (id, task) in &self.tasks {
            if !task.enabled {
                continue;
            }
            if self.executing_tasks.contains(id) {
                continue;
            }
            if let Some(next_run) = task.state.next_run_at_ms {
                if next_run <= now {
                    due.push(id.clone());
                }
            }
        }

        due
    }

    pub fn calculate_min_delay(&self) -> std::time::Duration {
        let now = Utc::now().timestamp_millis();
        let mut min_delay_ms: i64 = 60_000; // default 60s

        for task in self.tasks.values() {
            if !task.enabled {
                continue;
            }
            if let Some(next_run) = task.state.next_run_at_ms {
                let delay = next_run - now;
                if delay < min_delay_ms {
                    min_delay_ms = delay;
                }
            }
        }

        if min_delay_ms < 1000 {
            min_delay_ms = 1000; // minimum 1s
        }

        std::time::Duration::from_millis(min_delay_ms as u64)
    }

    // ── Persistence ──

    fn load_tasks(&mut self) {
        if !self.storage_path.exists() {
            return;
        }
        match fs::read_to_string(&self.storage_path) {
            Ok(data) => {
                match serde_json::from_str::<Vec<ScheduledTask>>(&data) {
                    Ok(tasks) => {
                        for task in tasks {
                            self.tasks.insert(task.id.clone(), task);
                        }
                        log::info!("[scheduler] Loaded {} tasks", self.tasks.len());
                    }
                    Err(e) => {
                        log::error!("[scheduler] Failed to parse tasks file: {}", e);
                    }
                }
            }
            Err(e) => {
                log::error!("[scheduler] Failed to read tasks file: {}", e);
            }
        }
    }

    fn recover_running_states(&mut self) {
        // Reset any tasks that were "running" when app crashed
        for task in self.tasks.values_mut() {
            if task.state.last_status.as_deref() == Some("running") {
                task.state.last_status = Some("error".to_string());
                task.state.running_at_ms = None;
            }
        }
    }

    pub fn save_tasks(&self) {
        let tasks: Vec<&ScheduledTask> = self.tasks.values().collect();
        let data = match serde_json::to_string_pretty(&tasks) {
            Ok(d) => d,
            Err(e) => {
                log::error!("[scheduler] Failed to serialize tasks: {}", e);
                return;
            }
        };

        // Atomic write: write to tmp then rename
        if let Some(parent) = self.storage_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let tmp_path = self.storage_path.with_extension("json.tmp");
        match fs::write(&tmp_path, &data) {
            Ok(_) => {
                if let Err(e) = fs::rename(&tmp_path, &self.storage_path) {
                    log::error!("[scheduler] Failed to rename tmp file: {}", e);
                }
            }
            Err(e) => {
                log::error!("[scheduler] Failed to write tmp file: {}", e);
            }
        }
    }

    pub fn append_run(&self, run: &ScheduledTaskRun) {
        let _ = fs::create_dir_all(&self.runs_dir);
        let runs_file = self.runs_dir.join(format!("{}.jsonl", run.task_id));
        if let Ok(line) = serde_json::to_string(run) {
            if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&runs_file) {
                let _ = writeln!(f, "{}", line);
            }
        }
    }

    pub fn update_run(&self, run: &ScheduledTaskRun) {
        // Read all runs, replace the matching one, rewrite
        let runs_file = self.runs_dir.join(format!("{}.jsonl", run.task_id));
        if !runs_file.exists() {
            self.append_run(run);
            return;
        }

        let mut lines = Vec::new();
        let mut found = false;
        if let Ok(f) = fs::File::open(&runs_file) {
            let reader = BufReader::new(f);
            for line in reader.lines().flatten() {
                if let Ok(existing) = serde_json::from_str::<ScheduledTaskRun>(&line) {
                    if existing.id == run.id {
                        if let Ok(updated_line) = serde_json::to_string(run) {
                            lines.push(updated_line);
                        }
                        found = true;
                        continue;
                    }
                }
                lines.push(line);
            }
        }
        if !found {
            if let Ok(line) = serde_json::to_string(run) {
                lines.push(line);
            }
        }
        let _ = fs::write(&runs_file, lines.join("\n") + "\n");
    }

    pub fn load_runs(&self, task_id: &str, limit: usize, offset: usize) -> Vec<ScheduledTaskRun> {
        let runs_file = self.runs_dir.join(format!("{}.jsonl", task_id));
        if !runs_file.exists() {
            return Vec::new();
        }

        let mut runs = Vec::new();
        if let Ok(f) = fs::File::open(&runs_file) {
            let reader = BufReader::new(f);
            for line in reader.lines().flatten() {
                if let Ok(run) = serde_json::from_str::<ScheduledTaskRun>(&line) {
                    runs.push(run);
                }
            }
        }

        // Sort newest first
        runs.sort_by(|a, b| b.started_at_ms.cmp(&a.started_at_ms));

        runs.into_iter().skip(offset).take(limit).collect()
    }

    pub fn load_all_runs(&self, limit: usize, offset: usize) -> Vec<ScheduledTaskRun> {
        let mut all_runs = Vec::new();

        if let Ok(entries) = fs::read_dir(&self.runs_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
                    if let Ok(f) = fs::File::open(&path) {
                        let reader = BufReader::new(f);
                        for line in reader.lines().flatten() {
                            if let Ok(run) = serde_json::from_str::<ScheduledTaskRun>(&line) {
                                all_runs.push(run);
                            }
                        }
                    }
                }
            }
        }

        all_runs.sort_by(|a, b| b.started_at_ms.cmp(&a.started_at_ms));
        all_runs.into_iter().skip(offset).take(limit).collect()
    }

    pub fn trim_runs(&self, task_id: &str) {
        let runs_file = self.runs_dir.join(format!("{}.jsonl", task_id));
        if !runs_file.exists() {
            return;
        }

        let mut runs = Vec::new();
        if let Ok(f) = fs::File::open(&runs_file) {
            let reader = BufReader::new(f);
            for line in reader.lines().flatten() {
                runs.push(line);
            }
        }

        if runs.len() <= 200 {
            return;
        }

        // Parse all, sort by started_at_ms desc, keep newest 200
        let mut parsed: Vec<(i64, String)> = runs
            .into_iter()
            .filter_map(|line| {
                serde_json::from_str::<ScheduledTaskRun>(&line)
                    .ok()
                    .map(|r| (r.started_at_ms, line))
            })
            .collect();
        parsed.sort_by(|a, b| b.0.cmp(&a.0));
        parsed.truncate(200);

        let content: String = parsed.into_iter().map(|(_, line)| line + "\n").collect();
        let _ = fs::write(&runs_file, content);
    }
}

// ── Cron Helpers ──

fn calculate_next_run_time(schedule: &Schedule, last_run_at_ms: Option<i64>) -> Result<Option<i64>, String> {
    match schedule {
        Schedule::At { datetime } => {
            let dt = chrono::DateTime::parse_from_rfc3339(datetime)
                .map_err(|e| format!("Invalid datetime '{}': {}", datetime, e))?;
            let now = Utc::now();
            if dt.with_timezone(&Utc) > now {
                Ok(Some(dt.timestamp_millis()))
            } else {
                Ok(None) // Already passed
            }
        }
        Schedule::Every { minutes } => {
            let now = Utc::now().timestamp_millis();
            let interval_ms = (*minutes as i64) * 60 * 1000;
            let base = last_run_at_ms.unwrap_or(now);
            let mut next = base + interval_ms;
            // If next is in the past (e.g. app was offline), schedule from now
            if next <= now {
                next = now + interval_ms;
            }
            Ok(Some(next))
        }
        Schedule::Cron { expression, timezone } => {
            // 5-field cron -> 7-field: prepend "0" (seconds) and append "*" (year)
            let seven_field = format!("0 {} *", expression.trim());
            let cron_schedule = seven_field
                .parse::<cron::Schedule>()
                .map_err(|e| format!("Invalid cron expression '{}': {}", expression, e))?;

            // Use specified timezone or fall back to UTC
            if let Some(tz_str) = timezone {
                let tz: chrono_tz::Tz = tz_str
                    .parse()
                    .map_err(|_| format!("Invalid timezone '{}'", tz_str))?;
                let now_in_tz = Utc::now().with_timezone(&tz);
                let next = cron_schedule.after(&now_in_tz).next();
                Ok(next.map(|dt| dt.with_timezone(&Utc).timestamp_millis()))
            } else {
                let next = cron_schedule.upcoming(Utc).next();
                Ok(next.map(|dt| dt.timestamp_millis()))
            }
        }
    }
}

// ── Scheduler Loop (free function, runs in tokio::spawn) ──

pub async fn scheduler_loop(state: SchedulerState) {
    log::info!("[scheduler] Scheduler loop started");

    loop {
        let (is_shutdown, delay, notify) = {
            let mgr = state.read().await;
            (mgr.is_shutdown(), mgr.calculate_min_delay(), mgr.get_notify())
        };

        if is_shutdown {
            log::info!("[scheduler] Scheduler loop shutting down");
            break;
        }

        tokio::select! {
            _ = tokio::time::sleep(delay) => {},
            _ = notify.notified() => {},
        }

        // Check shutdown again after waking
        {
            let mgr = state.read().await;
            if mgr.is_shutdown() {
                log::info!("[scheduler] Scheduler loop shutting down after wake");
                break;
            }
        }

        // Collect due tasks
        let due_task_ids = {
            let mgr = state.read().await;
            mgr.collect_due_tasks()
        };

        for task_id in due_task_ids {
            let state_clone = state.clone();
            tokio::spawn(async move {
                execute_task(state_clone, task_id, "scheduled".to_string()).await;
            });
        }
    }

    log::info!("[scheduler] Scheduler loop exited");
}

// ── Task Execution ──

async fn execute_task(state: SchedulerState, task_id: String, trigger: String) {
    log::info!("[scheduler] execute_task START: task_id={}, trigger={}", task_id, trigger);
    let now = Utc::now().timestamp_millis();
    let run_id = uuid::Uuid::new_v4().to_string();

    // Pre-execution setup: check guard, create run record, update task state
    let (task_name, prompt, working_dir, provider_env, model, permission_mode, app_handle) = {
        let mut mgr = state.write().await;

        // Re-entry guard
        if mgr.is_executing(&task_id) {
            log::warn!("[scheduler] Task {} is already executing, skipping", task_id);
            return;
        }

        let task = match mgr.get_task(&task_id) {
            Some(t) => t.clone(),
            None => {
                log::error!("[scheduler] Task {} not found", task_id);
                return;
            }
        };

        let app_handle = match mgr.app_handle() {
            Some(h) => h.clone(),
            None => {
                log::error!("[scheduler] No app handle available");
                return;
            }
        };

        mgr.mark_executing(&task_id);

        // Create initial run record
        let run = ScheduledTaskRun {
            id: run_id.clone(),
            task_id: task_id.clone(),
            task_name: task.name.clone(),
            session_id: None,
            status: "running".to_string(),
            started_at_ms: now,
            finished_at_ms: None,
            duration_ms: None,
            error: None,
            trigger: trigger.clone(),
        };
        mgr.append_run(&run);

        // Update task state
        if let Some(t) = mgr.get_task_mut(&task_id) {
            t.state.running_at_ms = Some(now);
            t.state.last_status = Some("running".to_string());
        }
        mgr.save_tasks();

        let _ = app_handle.emit("scheduler:run-updated", &run);
        if let Some(t) = mgr.get_task(&task_id) {
            let _ = app_handle.emit("scheduler:task-updated", t);
        }

        (task.name, task.prompt, task.working_directory, task.provider_env, task.model, task.permission_mode, app_handle)
    };

    // Channel to receive sessionId as soon as session is created (before execution)
    let (sid_tx, sid_rx) = tokio::sync::oneshot::channel::<String>();

    // Spawn helper: update run record with sessionId + emit session-started event
    {
        let state2 = state.clone();
        let run_id2 = run_id.clone();
        let task_id2 = task_id.clone();
        let task_name2 = task_name.clone();
        let working_dir2 = working_dir.clone();
        let app_handle2 = app_handle.clone();
        let trigger2 = trigger.clone();
        tokio::spawn(async move {
            if let Ok(sid) = sid_rx.await {
                let mgr = state2.read().await;
                let run = ScheduledTaskRun {
                    id: run_id2,
                    task_id: task_id2,
                    task_name: task_name2,
                    session_id: Some(sid.clone()),
                    status: "running".to_string(),
                    started_at_ms: now,
                    finished_at_ms: None,
                    duration_ms: None,
                    error: None,
                    trigger: trigger2,
                };
                mgr.update_run(&run);
                let _ = app_handle2.emit("scheduler:run-updated", &run);
                let _ = app_handle2.emit("scheduler:session-started", serde_json::json!({
                    "sessionId": sid,
                    "workingDirectory": working_dir2,
                }));
            }
        });
    }

    // Execute: create session, start sidecar with sessionId, send prompt, poll for completion
    let result =
        execute_with_sidecar(
            &app_handle,
            &prompt,
            &working_dir,
            &task_name,
            provider_env.as_ref(),
            model.as_deref(),
            permission_mode.as_deref(),
            Some(sid_tx),
        ).await;

    // Post-execution: update run + task state
    let finished_at = Utc::now().timestamp_millis();
    let duration = finished_at - now;

    let (status, error, session_id) = match &result {
        Ok(sid) => ("success".to_string(), None, Some(sid.clone())),
        Err(e) => ("error".to_string(), Some(e.clone()), None),
    };

    {
        let mut mgr = state.write().await;

        // Update run
        let run = ScheduledTaskRun {
            id: run_id,
            task_id: task_id.clone(),
            task_name,
            session_id,
            status: status.clone(),
            started_at_ms: now,
            finished_at_ms: Some(finished_at),
            duration_ms: Some(duration),
            error,
            trigger,
        };
        mgr.update_run(&run);
        let _ = app_handle.emit("scheduler:run-updated", &run);

        // Update task state
        if let Some(task) = mgr.get_task_mut(&task_id) {
            task.state.last_run_at_ms = Some(finished_at);
            task.state.last_status = Some(status.clone());
            task.state.running_at_ms = None;

            if status == "error" {
                task.state.consecutive_errors += 1;
                // Auto-disable after 5 consecutive errors
                if task.state.consecutive_errors >= 5 {
                    task.state.next_run_at_ms = None;
                    task.enabled = false;
                    log::warn!("[scheduler] Task {} auto-disabled after 5 consecutive errors", task_id);
                }
            } else {
                task.state.consecutive_errors = 0;
            }

            // For "at" schedule, disable after execution
            if matches!(task.schedule, Schedule::At { .. }) {
                task.enabled = false;
                task.state.next_run_at_ms = None;
            } else if task.enabled {
                // Calculate next run for cron
                match calculate_next_run_time(&task.schedule, task.state.last_run_at_ms) {
                    Ok(next) => task.state.next_run_at_ms = next,
                    Err(e) => log::error!("[scheduler] Failed to calculate next run: {}", e),
                }
            }

            task.updated_at_ms = Utc::now().timestamp_millis();
        }

        mgr.save_tasks();
        mgr.unmark_executing(&task_id);

        if let Some(task) = mgr.get_task(&task_id) {
            let _ = app_handle.emit("scheduler:task-updated", task);
        }

        mgr.trim_runs(&task_id);

        // Notify frontend that the scheduled session has finished
        if let Some(sid) = &run.session_id {
            let _ = app_handle.emit("scheduler:session-finished", serde_json::json!({
                "sessionId": sid,
                "workingDirectory": working_dir,
            }));
        }
    }
}

async fn execute_with_sidecar(
    app_handle: &AppHandle,
    prompt: &str,
    working_dir: &str,
    task_name: &str,
    provider_env: Option<&TaskProviderEnv>,
    model: Option<&str>,
    permission_mode: Option<&str>,
    session_id_sender: Option<tokio::sync::oneshot::Sender<String>>,
) -> Result<String, String> {
    let bun_path = sidecar::find_bun_executable(app_handle)?;
    let script_path = sidecar::find_server_script(app_handle)?;

    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // Step 1: Create session via global sidecar to get sessionId first
    let global_port = {
        let sidecar_state: tauri::State<SidecarState> = app_handle.state();
        let mgr = sidecar_state.lock().map_err(|e| format!("Lock error: {}", e))?;
        mgr.get_port(sidecar::GLOBAL_SIDECAR_ID)
            .ok_or_else(|| "Global sidecar not running".to_string())?
    };

    let create_url = format!("http://127.0.0.1:{}/sessions/create", global_port);
    let create_resp = client
        .post(&create_url)
        .json(&serde_json::json!({
            "agentDir": working_dir,
            "title": prompt.chars().take(50).collect::<String>(),
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to create session: {}", e))?;

    if !create_resp.status().is_success() {
        return Err(format!("Failed to create session: {}", create_resp.status()));
    }

    let create_json: serde_json::Value = create_resp.json().await
        .map_err(|e| format!("Failed to parse create session response: {}", e))?;
    let session_id = create_json
        .get("sessionId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "No sessionId in create response".to_string())?
        .to_string();

    log::info!(
        "[scheduler] Created session '{}' for task '{}'",
        session_id,
        task_name
    );

    // Notify execute_task immediately with sessionId
    if let Some(tx) = session_id_sender {
        let _ = tx.send(session_id.clone());
    }

    // Step 2: Start sidecar with sessionId as ID (same as Tab sidecar)
    let owner = SidecarOwner::Session(session_id.clone());
    let sidecar_state: tauri::State<SidecarState> = app_handle.state();
    let sidecar_arc = (*sidecar_state).clone();
    let sid = session_id.clone();
    let wd = PathBuf::from(working_dir);
    let owner_clone = owner.clone();
    let bun_path_clone = bun_path.clone();
    let script_path_clone = script_path.clone();
    let port = tokio::task::spawn_blocking(move || {
        let mut mgr = sidecar_arc.lock().map_err(|e| format!("Lock error: {}", e))?;
        mgr.start_sidecar(
            sid,
            Some(wd),
            &bun_path_clone,
            &script_path_clone,
            Some(owner_clone),
        )
    })
    .await
    .map_err(|e| format!("spawn_blocking join error: {}", e))??;

    log::info!(
        "[scheduler] Sidecar started (id='{}') on port {}",
        session_id,
        port
    );

    // Step 3: Send prompt with sessionId
    let mut body = serde_json::Map::new();
    body.insert("sessionId".to_string(), serde_json::Value::String(session_id.clone()));
    body.insert("message".to_string(), serde_json::Value::String(prompt.to_string()));
    body.insert("agentDir".to_string(), serde_json::Value::String(working_dir.to_string()));
    body.insert(
        "permissionMode".to_string(),
        serde_json::Value::String(permission_mode.unwrap_or("bypassPermissions").to_string()),
    );
    if let Some(m) = model {
        body.insert("model".to_string(), serde_json::Value::String(m.to_string()));
    }
    if let Some(pe) = provider_env {
        let mut env_map = serde_json::Map::new();
        if let Some(ref v) = pe.base_url {
            env_map.insert("baseUrl".to_string(), serde_json::Value::String(v.clone()));
        }
        if let Some(ref v) = pe.api_key {
            env_map.insert("apiKey".to_string(), serde_json::Value::String(v.clone()));
        }
        if let Some(ref v) = pe.auth_type {
            env_map.insert("authType".to_string(), serde_json::Value::String(v.clone()));
        }
        if let Some(ref v) = pe.api_protocol {
            env_map.insert("apiProtocol".to_string(), serde_json::Value::String(v.clone()));
        }
        if let Some(v) = pe.timeout {
            env_map.insert("timeout".to_string(), serde_json::json!(v));
        }
        if let Some(v) = pe.disable_nonessential {
            env_map.insert("disableNonessential".to_string(), serde_json::json!(v));
        }
        body.insert("providerEnv".to_string(), serde_json::Value::Object(env_map));
    }

    let url = format!("http://127.0.0.1:{}/chat/send", port);
    log::info!("[scheduler] POST {} body={}", url, serde_json::to_string(&serde_json::Value::Object(body.clone())).unwrap_or_default());

    let resp = client
        .post(&url)
        .json(&serde_json::Value::Object(body))
        .send()
        .await
        .map_err(|e| {
            log::error!("[scheduler] Failed to send prompt: {}", e);
            format!("Failed to send prompt: {}", e)
        })?;

    log::info!("[scheduler] POST response status: {}", resp.status());

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        log::error!("[scheduler] Send failed ({}): {}", status, body);
        return Err(format!("Send failed ({}): {}", status, body));
    }

    // Step 4: Poll for completion (max 10 minutes, check every 3 seconds)
    let state_url = format!("http://127.0.0.1:{}/agent/state", port);
    let max_wait = std::time::Duration::from_secs(600);
    let poll_interval = std::time::Duration::from_secs(3);
    let start = std::time::Instant::now();

    loop {
        if start.elapsed() > max_wait {
            return Err("Task execution timed out (10 minutes)".to_string());
        }

        tokio::time::sleep(poll_interval).await;

        match client.get(&state_url).send().await {
            Ok(resp) => {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    let is_running = json
                        .get("isRunning")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true);
                    if !is_running {
                        log::info!(
                            "[scheduler] Task completed, session '{}'",
                            session_id
                        );
                        break;
                    }
                }
            }
            Err(e) => {
                log::warn!(
                    "[scheduler] State poll failed for session '{}': {}",
                    session_id,
                    e
                );
            }
        }
    }

    // Do NOT release sidecar — leave it alive for TabProvider to discover and connect.
    // It will be reclaimed by TabProvider's idle timeout (5 min).
    log::info!(
        "[scheduler] Task '{}' done. Sidecar '{}' kept alive for Tab reuse.",
        task_name,
        session_id
    );

    Ok(session_id)
}

// ── Manual Run Helper ──

pub async fn run_task_manually(state: SchedulerState, task_id: String) -> Result<(), String> {
    {
        let mgr = state.read().await;
        if mgr.get_task(&task_id).is_none() {
            return Err(format!("Task not found: {}", task_id));
        }
        if mgr.is_executing(&task_id) {
            return Err("Task is already running".to_string());
        }
    }

    let state_clone = state.clone();
    tokio::spawn(async move {
        execute_task(state_clone, task_id, "manual".to_string()).await;
    });

    Ok(())
}

// ── Tauri Commands ──

#[tauri::command]
pub async fn cmd_scheduler_list_tasks(
    state: tauri::State<'_, SchedulerState>,
) -> Result<Vec<ScheduledTask>, String> {
    let mgr = state.read().await;
    Ok(mgr.list_tasks())
}

#[tauri::command]
pub async fn cmd_scheduler_create_task(
    state: tauri::State<'_, SchedulerState>,
    input: ScheduledTaskInput,
) -> Result<ScheduledTask, String> {
    let mut mgr = state.write().await;
    mgr.create_task(input)
}

#[tauri::command]
pub async fn cmd_scheduler_update_task(
    state: tauri::State<'_, SchedulerState>,
    id: String,
    input: ScheduledTaskInput,
) -> Result<ScheduledTask, String> {
    let mut mgr = state.write().await;
    mgr.update_task(id, input)
}

#[tauri::command]
pub async fn cmd_scheduler_delete_task(
    state: tauri::State<'_, SchedulerState>,
    id: String,
) -> Result<(), String> {
    let mut mgr = state.write().await;
    mgr.delete_task(&id)
}

#[tauri::command]
pub async fn cmd_scheduler_toggle_task(
    state: tauri::State<'_, SchedulerState>,
    id: String,
) -> Result<ScheduledTask, String> {
    let mut mgr = state.write().await;
    mgr.toggle_task(&id)
}

#[tauri::command]
pub async fn cmd_scheduler_run_task(
    state: tauri::State<'_, SchedulerState>,
    id: String,
) -> Result<(), String> {
    log::info!("[scheduler] cmd_scheduler_run_task called with id={}", id);
    let result = run_task_manually(state.inner().clone(), id).await;
    log::info!("[scheduler] cmd_scheduler_run_task result: {:?}", result);
    result
}

#[tauri::command]
pub async fn cmd_scheduler_list_runs(
    state: tauri::State<'_, SchedulerState>,
    task_id: String,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<ScheduledTaskRun>, String> {
    let mgr = state.read().await;
    Ok(mgr.load_runs(&task_id, limit.unwrap_or(50), offset.unwrap_or(0)))
}

#[tauri::command]
pub async fn cmd_scheduler_list_all_runs(
    state: tauri::State<'_, SchedulerState>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<ScheduledTaskRun>, String> {
    let mgr = state.read().await;
    Ok(mgr.load_all_runs(limit.unwrap_or(50), offset.unwrap_or(0)))
}
