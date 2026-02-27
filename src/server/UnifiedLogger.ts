import { appendFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { LogEntry } from '../shared/types/log';

// 开发模式（bun 直接执行 .ts）用 logs_dev，发布版用 logs
const isDev = import.meta.path.endsWith('.ts');
const LOG_DIR = join(homedir(), '.soagents', isDev ? 'logs_dev' : 'logs');
const RETENTION_DAYS = 30;

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return join(LOG_DIR, `unified-${date}.log`);
}

const SOURCE_PAD: Record<string, string> = {
  bun: 'BUN  ',
  rust: 'RUST ',
  react: 'REACT',
};

const LEVEL_PAD: Record<string, string> = {
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  debug: 'DEBUG',
};

function formatLogEntry(entry: LogEntry): string {
  const src = SOURCE_PAD[entry.source] ?? entry.source.toUpperCase().padEnd(5);
  const lvl = LEVEL_PAD[entry.level] ?? entry.level.toUpperCase().padEnd(5);
  return `${entry.timestamp} [${src}] [${lvl}] ${entry.message}`;
}

export function appendUnifiedLog(entry: LogEntry): void {
  try {
    ensureLogDir();
    appendFileSync(getLogFilePath(), formatLogEntry(entry) + '\n');
  } catch {
    // 写日志失败不应影响业务
  }
}

export function appendUnifiedLogBatch(entries: LogEntry[]): void {
  if (entries.length === 0) return;
  try {
    ensureLogDir();
    const lines = entries.map(formatLogEntry).join('\n') + '\n';
    appendFileSync(getLogFilePath(), lines);
  } catch {
    // 写日志失败不应影响业务
  }
}

export function cleanupOldLogs(): void {
  try {
    if (!existsSync(LOG_DIR)) return;
    const now = Date.now();
    const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const file of readdirSync(LOG_DIR)) {
      if (!file.startsWith('unified-') || !file.endsWith('.log')) continue;
      // 从文件名提取日期: unified-YYYY-MM-DD.log
      const dateStr = file.slice(8, 18);
      const fileTime = new Date(dateStr).getTime();
      if (isNaN(fileTime)) continue;
      if (now - fileTime > maxAge) {
        unlinkSync(join(LOG_DIR, file));
      }
    }
  } catch {
    // 清理失败不影响业务
  }
}
