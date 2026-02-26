import { broadcast } from './sse';
import { appendUnifiedLog, cleanupOldLogs } from './UnifiedLogger';
import type { LogEntry, LogLevel } from '../shared/types/log';

// ── Ring Buffer: 新 SSE 客户端连接时补发 ──
const MAX_HISTORY = 100;
const logHistory: LogEntry[] = [];

export function getLogHistory(): LogEntry[] {
  return logHistory;
}

// ── 保留原始 console 方法 ──
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  debug: console.debug.bind(console),
};

function argsToString(args: unknown[]): string {
  return args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
}

function createAndBroadcast(level: LogLevel, args: unknown[]): void {
  const message = argsToString(args);

  // 过滤 SSE 心跳等内部噪音
  if (message.startsWith('[sse]')) return;

  const entry: LogEntry = {
    source: 'bun',
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  // 1. Ring Buffer
  logHistory.push(entry);
  if (logHistory.length > MAX_HISTORY) logHistory.shift();

  // 2. 磁盘持久化
  appendUnifiedLog(entry);

  // 3. SSE 广播
  try {
    broadcast('chat:log', entry);
  } catch {
    // SSE 广播失败不影响日志记录
  }
}

// ── 初始化：劫持 console 方法 ──
let _initialized = false;

export function initLogger(): void {
  if (_initialized) return;
  _initialized = true;

  // 启动时清理旧日志
  cleanupOldLogs();

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    createAndBroadcast('info', args);
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    createAndBroadcast('error', args);
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    createAndBroadcast('warn', args);
  };

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    createAndBroadcast('debug', args);
  };
}

// ── 直接发送日志（不经 console）──
export function sendLog(level: LogLevel, message: string): void {
  createAndBroadcast(level, [message]);
}
