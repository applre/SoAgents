import type { ProviderEnv } from './config';

export interface Schedule {
  type: 'at' | 'cron';
  datetime?: string;   // ISO 8601, when type = 'at'
  expression?: string; // 5-field cron, when type = 'cron'
}

export interface TaskState {
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastStatus: 'success' | 'error' | 'running' | null;
  consecutiveErrors: number;
  runningAtMs: number | null;
}

export interface ScheduledTask {
  id: string;
  name: string;
  enabled: boolean;
  schedule: Schedule;
  prompt: string;
  workingDirectory: string;
  state: TaskState;
  providerEnv?: ProviderEnv;
  model?: string;
  permissionMode?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ScheduledTaskInput {
  name: string;
  schedule: Schedule;
  prompt: string;
  workingDirectory: string;
  enabled: boolean;
  providerEnv?: ProviderEnv;
  model?: string;
  permissionMode?: string;
}

export interface ScheduledTaskRun {
  id: string;
  taskId: string;
  taskName: string;
  sessionId: string | null;
  status: 'running' | 'success' | 'error';
  startedAtMs: number;
  finishedAtMs: number | null;
  durationMs: number | null;
  error: string | null;
  trigger: 'scheduled' | 'manual';
}

export interface ScheduledTaskRunWithName extends ScheduledTaskRun {
  taskName: string;
}
