import type { Schedule } from '../../../shared/types/scheduledTask';

export type ScheduleMode = 'once' | 'daily' | 'weekly' | 'monthly';

export interface ScheduleUI {
  mode: ScheduleMode;
  datetime: string;  // for 'once': ISO datetime-local value
  time: string;      // HH:MM
  weekday: number;   // 0-6 (Sun-Sat), used for 'weekly'
  monthDay: number;  // 1-31, used for 'monthly'
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function defaultScheduleUI(): ScheduleUI {
  return {
    mode: 'daily',
    datetime: '',
    time: '09:00',
    weekday: 1,
    monthDay: 1,
  };
}

export function scheduleUIToSchedule(ui: ScheduleUI): Schedule {
  if (ui.mode === 'once') {
    return { type: 'at', datetime: new Date(ui.datetime).toISOString() };
  }

  const [hour, minute] = ui.time.split(':').map(Number);

  let expression: string;
  switch (ui.mode) {
    case 'daily':
      expression = `${minute} ${hour} * * *`;
      break;
    case 'weekly':
      expression = `${minute} ${hour} * * ${ui.weekday}`;
      break;
    case 'monthly':
      expression = `${minute} ${hour} ${ui.monthDay} * *`;
      break;
    default:
      expression = `${minute} ${hour} * * *`;
  }

  return { type: 'cron', expression };
}

export function parseScheduleToUI(schedule: Schedule): ScheduleUI {
  if (schedule.type === 'at') {
    const dt = schedule.datetime ? new Date(schedule.datetime) : new Date();
    // Format for datetime-local input
    const pad = (n: number) => n.toString().padStart(2, '0');
    const datetime = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    return { mode: 'once', datetime, time: '09:00', weekday: 1, monthDay: 1 };
  }

  if (!schedule.expression) return defaultScheduleUI();

  const parts = schedule.expression.split(/\s+/);
  if (parts.length !== 5) return defaultScheduleUI();

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  if (dayOfWeek !== '*') {
    return { mode: 'weekly', datetime: '', time, weekday: parseInt(dayOfWeek, 10), monthDay: 1 };
  }
  if (dayOfMonth !== '*') {
    return { mode: 'monthly', datetime: '', time, weekday: 1, monthDay: parseInt(dayOfMonth, 10) };
  }
  return { mode: 'daily', datetime: '', time, weekday: 1, monthDay: 1 };
}

export function formatScheduleLabel(schedule: Schedule): string {
  if (schedule.type === 'at') {
    if (!schedule.datetime) return '单次执行';
    const dt = new Date(schedule.datetime);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${dt.getFullYear()}/${pad(dt.getMonth() + 1)}/${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  if (!schedule.expression) return '未知';

  const parts = schedule.expression.split(/\s+/);
  if (parts.length !== 5) return schedule.expression;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  if (dayOfWeek !== '*') {
    const wd = parseInt(dayOfWeek, 10);
    return `每${WEEKDAY_NAMES[wd] ?? `周${wd}`} ${timeStr}`;
  }
  if (dayOfMonth !== '*') {
    return `每月 ${dayOfMonth} 日 ${timeStr}`;
  }
  return `每天 ${timeStr}`;
}

export function formatTimestamp(ms: number): string {
  const dt = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const now = new Date();
  const isToday = dt.toDateString() === now.toDateString();
  const timeStr = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
  if (isToday) return `今天 ${timeStr}`;
  return `${pad(dt.getMonth() + 1)}/${pad(dt.getDate())} ${timeStr}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${minutes}m ${remainSeconds}s`;
}
