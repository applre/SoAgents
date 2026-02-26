export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogSource = 'bun' | 'rust' | 'react';

export interface LogEntry {
  source: LogSource;
  level: LogLevel;
  message: string;
  timestamp: string; // ISO 8601
}
