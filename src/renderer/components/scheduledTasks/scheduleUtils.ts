import type { Schedule } from '../../../shared/types/scheduledTask';

export type ScheduleMode = 'once' | 'every' | 'daily' | 'weekly' | 'monthly';

export interface ScheduleUI {
  mode: ScheduleMode;
  datetime: string;  // for 'once': ISO datetime-local value
  minutes: number;   // for 'every': interval in minutes
  time: string;      // HH:MM
  weekday: number;   // 0-6 (Sun-Sat), used for 'weekly'
  monthDay: number;  // 1-31, used for 'monthly'
  timezone: string;  // IANA timezone, e.g. 'Asia/Shanghai'
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** Common timezones for the picker */
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '中国标准时间 (UTC+8)' },
  { value: 'Asia/Tokyo', label: '日本标准时间 (UTC+9)' },
  { value: 'Asia/Singapore', label: '新加坡时间 (UTC+8)' },
  { value: 'Asia/Kolkata', label: '印度标准时间 (UTC+5:30)' },
  { value: 'Asia/Dubai', label: '海湾标准时间 (UTC+4)' },
  { value: 'Europe/London', label: '英国时间 (GMT/BST)' },
  { value: 'Europe/Berlin', label: '中欧时间 (CET/CEST)' },
  { value: 'Europe/Moscow', label: '莫斯科时间 (UTC+3)' },
  { value: 'America/New_York', label: '美国东部 (EST/EDT)' },
  { value: 'America/Chicago', label: '美国中部 (CST/CDT)' },
  { value: 'America/Denver', label: '美国山区 (MST/MDT)' },
  { value: 'America/Los_Angeles', label: '美国太平洋 (PST/PDT)' },
  { value: 'Pacific/Auckland', label: '新西兰时间 (NZST/NZDT)' },
  { value: 'Australia/Sydney', label: '澳洲东部 (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
];

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export function defaultScheduleUI(): ScheduleUI {
  return {
    mode: 'daily',
    datetime: '',
    minutes: 30,
    time: '09:00',
    weekday: 1,
    monthDay: 1,
    timezone: getLocalTimezone(),
  };
}

export function scheduleUIToSchedule(ui: ScheduleUI): Schedule {
  if (ui.mode === 'once') {
    return { type: 'at', datetime: new Date(ui.datetime).toISOString() };
  }
  if (ui.mode === 'every') {
    return { type: 'every', minutes: ui.minutes };
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

  return { type: 'cron', expression, timezone: ui.timezone || undefined };
}

export function parseScheduleToUI(schedule: Schedule): ScheduleUI {
  const tz = schedule.timezone || getLocalTimezone();

  if (schedule.type === 'at') {
    const dt = schedule.datetime ? new Date(schedule.datetime) : new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const datetime = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    return { mode: 'once', datetime, minutes: 30, time: '09:00', weekday: 1, monthDay: 1, timezone: tz };
  }

  if (schedule.type === 'every') {
    return { mode: 'every', datetime: '', minutes: schedule.minutes ?? 30, time: '09:00', weekday: 1, monthDay: 1, timezone: tz };
  }

  if (!schedule.expression) return defaultScheduleUI();

  const parts = schedule.expression.split(/\s+/);
  if (parts.length !== 5) return defaultScheduleUI();

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  if (dayOfWeek !== '*') {
    return { mode: 'weekly', datetime: '', minutes: 30, time, weekday: parseInt(dayOfWeek, 10), monthDay: 1, timezone: tz };
  }
  if (dayOfMonth !== '*') {
    return { mode: 'monthly', datetime: '', minutes: 30, time, weekday: 1, monthDay: parseInt(dayOfMonth, 10), timezone: tz };
  }
  return { mode: 'daily', datetime: '', minutes: 30, time, weekday: 1, monthDay: 1, timezone: tz };
}

/** Format timezone for display: 'Asia/Shanghai' -> 'Asia/Shanghai' (short) */
function formatTzShort(tz?: string): string {
  if (!tz || tz === getLocalTimezone()) return '';
  return ` (${tz})`;
}

export function formatScheduleLabel(schedule: Schedule): string {
  const tzSuffix = schedule.type === 'cron' ? formatTzShort(schedule.timezone) : '';

  if (schedule.type === 'at') {
    if (!schedule.datetime) return '单次执行';
    const dt = new Date(schedule.datetime);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${dt.getFullYear()}/${pad(dt.getMonth() + 1)}/${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  if (schedule.type === 'every') {
    const m = schedule.minutes ?? 0;
    if (m < 60) return `每 ${m} 分钟`;
    const h = Math.floor(m / 60);
    const remainder = m % 60;
    return remainder > 0 ? `每 ${h} 小时 ${remainder} 分钟` : `每 ${h} 小时`;
  }

  if (!schedule.expression) return '未知';

  const parts = schedule.expression.split(/\s+/);
  if (parts.length !== 5) return schedule.expression;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  if (dayOfWeek !== '*') {
    const wd = parseInt(dayOfWeek, 10);
    return `每${WEEKDAY_NAMES[wd] ?? `周${wd}`} ${timeStr}${tzSuffix}`;
  }
  if (dayOfMonth !== '*') {
    return `每月 ${dayOfMonth} 日 ${timeStr}${tzSuffix}`;
  }
  return `每天 ${timeStr}${tzSuffix}`;
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
