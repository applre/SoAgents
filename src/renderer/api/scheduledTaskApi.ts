import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ScheduledTask, ScheduledTaskInput, ScheduledTaskRun } from '../../shared/types/scheduledTask';

export async function listScheduledTasks(): Promise<ScheduledTask[]> {
  return invoke('cmd_scheduler_list_tasks');
}

export async function createScheduledTask(input: ScheduledTaskInput): Promise<ScheduledTask> {
  return invoke('cmd_scheduler_create_task', { input });
}

export async function updateScheduledTask(id: string, input: ScheduledTaskInput): Promise<ScheduledTask> {
  return invoke('cmd_scheduler_update_task', { id, input });
}

export async function deleteScheduledTask(id: string): Promise<void> {
  return invoke('cmd_scheduler_delete_task', { id });
}

export async function toggleScheduledTask(id: string): Promise<ScheduledTask> {
  return invoke('cmd_scheduler_toggle_task', { id });
}

export async function runScheduledTaskManually(id: string): Promise<void> {
  return invoke('cmd_scheduler_run_task', { id });
}

export async function listScheduledTaskRuns(taskId: string, limit?: number, offset?: number): Promise<ScheduledTaskRun[]> {
  return invoke('cmd_scheduler_list_runs', { taskId, limit: limit ?? 50, offset: offset ?? 0 });
}

export async function listAllScheduledTaskRuns(limit?: number, offset?: number): Promise<ScheduledTaskRun[]> {
  return invoke('cmd_scheduler_list_all_runs', { limit: limit ?? 50, offset: offset ?? 0 });
}

// Event listeners
export function onTaskUpdated(callback: (task: ScheduledTask) => void): Promise<UnlistenFn> {
  return listen<ScheduledTask>('scheduler:task-updated', (event) => callback(event.payload));
}

export function onRunUpdated(callback: (run: ScheduledTaskRun) => void): Promise<UnlistenFn> {
  return listen<ScheduledTaskRun>('scheduler:run-updated', (event) => callback(event.payload));
}

export function onTaskDeleted(callback: (payload: { id: string }) => void): Promise<UnlistenFn> {
  return listen<{ id: string }>('scheduler:task-deleted', (event) => callback(event.payload));
}
