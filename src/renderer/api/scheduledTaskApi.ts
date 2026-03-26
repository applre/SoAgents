import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ScheduledTask, ScheduledTaskInput, ScheduledTaskRun } from '../../shared/types/scheduledTask';

export async function listScheduledTasks(): Promise<ScheduledTask[]> {
  return invoke('cmd_scheduled_task_list');
}

export async function createScheduledTask(input: ScheduledTaskInput): Promise<ScheduledTask> {
  return invoke('cmd_scheduled_task_create', { input });
}

export async function updateScheduledTask(id: string, input: ScheduledTaskInput): Promise<ScheduledTask> {
  return invoke('cmd_scheduled_task_update', { id, input });
}

export async function deleteScheduledTask(id: string): Promise<void> {
  return invoke('cmd_scheduled_task_delete', { id });
}

export async function toggleScheduledTask(id: string): Promise<ScheduledTask> {
  return invoke('cmd_scheduled_task_toggle', { id });
}

export async function runScheduledTaskManually(id: string): Promise<void> {
  return invoke('cmd_scheduled_task_run', { id });
}

export async function listScheduledTaskRuns(taskId: string, limit?: number, offset?: number): Promise<ScheduledTaskRun[]> {
  return invoke('cmd_scheduled_task_list_runs', { taskId, limit: limit ?? 50, offset: offset ?? 0 });
}

export async function listAllScheduledTaskRuns(limit?: number, offset?: number): Promise<ScheduledTaskRun[]> {
  return invoke('cmd_scheduled_task_list_all_runs', { limit: limit ?? 50, offset: offset ?? 0 });
}

// Event listeners
export function onTaskUpdated(callback: (task: ScheduledTask) => void): Promise<UnlistenFn> {
  return listen<ScheduledTask>('scheduled-task:updated', (event) => callback(event.payload));
}

export function onRunUpdated(callback: (run: ScheduledTaskRun) => void): Promise<UnlistenFn> {
  return listen<ScheduledTaskRun>('scheduled-task:run-updated', (event) => callback(event.payload));
}

export function onTaskDeleted(callback: (payload: { id: string }) => void): Promise<UnlistenFn> {
  return listen<{ id: string }>('scheduled-task:deleted', (event) => callback(event.payload));
}

export async function stopScheduledTask(id: string, reason?: string): Promise<void> {
  await invoke('cmd_scheduled_task_stop', { id, reason });
}

export async function onTaskExitRequested(
  handler: (data: { taskId: string; reason: string }) => void
): Promise<UnlistenFn> {
  return listen<{ taskId: string; reason: string }>('scheduled-task:exit-requested', (event) => {
    handler(event.payload);
  });
}
