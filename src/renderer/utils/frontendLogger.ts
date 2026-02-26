import type { LogEntry, LogLevel } from '../../shared/types/log';
import { globalApiPostJson } from '../api/apiFetch';

// ── 常量 ──
export const REACT_LOG_EVENT = 'soagents:react-log';
const FLUSH_INTERVAL = 500; // ms
const MAX_BUFFER_SIZE = 50;

// ── 状态 ──
const logBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let _initialized = false;

// ── 保留原始 console ──
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

function createAndDispatch(level: LogLevel, args: unknown[]): void {
  const message = argsToString(args);

  // 循环防护：过滤自身日志
  if (message.includes('[FrontendLogger]')) return;

  const entry: LogEntry = {
    source: 'react',
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  // 1. 分发自定义事件给 TabProvider（实时 UI 显示）
  window.dispatchEvent(new CustomEvent(REACT_LOG_EVENT, { detail: entry }));

  // 2. 缓冲，待批量发送到 Global Sidecar 持久化
  logBuffer.push(entry);
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flushBuffer();
  } else {
    scheduleFlush();
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBuffer();
  }, FLUSH_INTERVAL);
}

function flushBuffer(): void {
  if (logBuffer.length === 0) return;
  const entries = logBuffer.splice(0);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  // 异步发送，失败静默（不 console 以免递归）
  globalApiPostJson('/api/unified-log', { entries }).catch(() => {});
}

// ── 初始化 ──
export function initFrontendLogger(): void {
  if (_initialized) return;
  _initialized = true;

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    createAndDispatch('info', args);
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    createAndDispatch('error', args);
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    createAndDispatch('warn', args);
  };

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    createAndDispatch('debug', args);
  };
}
