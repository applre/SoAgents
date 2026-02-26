import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Trash2 } from 'lucide-react';
import type { LogEntry, LogLevel, LogSource } from '../../shared/types/log';

const MAX_DISPLAY_LOGS = 3000;

const SOURCE_LABELS: Record<LogSource, string> = { react: 'REACT', bun: 'BUN', rust: 'RUST' };
const SOURCE_COLORS: Record<LogSource, string> = {
  react: 'bg-blue-500/15 text-blue-600',
  bun: 'bg-green-500/15 text-green-600',
  rust: 'bg-orange-500/15 text-orange-600',
};
const LEVEL_COLORS: Record<LogLevel, string> = {
  info: 'text-[var(--ink-secondary)]',
  warn: 'text-yellow-600',
  error: 'text-red-500',
  debug: 'text-[var(--ink-tertiary)]',
};

interface Props {
  sseLogs: LogEntry[];
  isVisible: boolean;
  onClose: () => void;
  onClearAll: () => void;
}

type SourceFilter = 'all' | LogSource;
type LevelFilter = 'all' | LogLevel;

export default function UnifiedLogsPanel({ sseLogs, isVisible, onClose, onClearAll }: Props) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isVisible, onClose]);

  // 隐藏时不计算
  const allLogs = useMemo(() => {
    if (!isVisible) return [];
    const limited = sseLogs.length > MAX_DISPLAY_LOGS
      ? sseLogs.slice(-MAX_DISPLAY_LOGS)
      : sseLogs;
    return [...limited].reverse(); // 最新在上
  }, [sseLogs, isVisible]);

  const filteredLogs = useMemo(() => {
    return allLogs
      .filter((log) => sourceFilter === 'all' || log.source === sourceFilter)
      .filter((log) => levelFilter === 'all' || log.level === levelFilter);
  }, [allLogs, sourceFilter, levelFilter]);

  // 来源计数
  const sourceCounts = useMemo(() => {
    const counts = { react: 0, bun: 0, rust: 0 };
    for (const log of allLogs) counts[log.source]++;
    return counts;
  }, [allLogs]);

  // 导出
  const handleDownload = useCallback(() => {
    const lines = filteredLogs.map((log) => {
      const time = log.timestamp.slice(11, 23); // HH:MM:SS.mmm
      const src = SOURCE_LABELS[log.source].padEnd(5);
      const lvl = log.level.toUpperCase().padEnd(5);
      return `[${src}] ${time} [${lvl}] ${log.message}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soagents-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  if (!isVisible) return null;

  const filterBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-0.5 text-[12px] font-medium transition-colors ${
        active
          ? 'bg-[var(--accent)] text-white'
          : 'bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
      }`}
    >
      {label}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* 面板 */}
      <div
        className="relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--paper)]"
        style={{ width: '95vw', maxWidth: 1100, height: '90vh', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Logs</h2>
            <span className="text-[12px] text-[var(--ink-tertiary)]">
              {filteredLogs.length} / {allLogs.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} title="导出" className="rounded-lg p-1.5 text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors">
              <Download size={15} />
            </button>
            <button onClick={onClearAll} title="清空" className="rounded-lg p-1.5 text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-red-500 transition-colors">
              <Trash2 size={15} />
            </button>
            <button onClick={onClose} title="关闭" className="rounded-lg p-1.5 text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 过滤栏 */}
        <div className="flex items-center gap-4 border-b border-[var(--border)] px-5 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--ink-tertiary)] font-medium">来源</span>
            {filterBtn('ALL', sourceFilter === 'all', () => setSourceFilter('all'))}
            {filterBtn('REACT', sourceFilter === 'react', () => setSourceFilter('react'))}
            {filterBtn('BUN', sourceFilter === 'bun', () => setSourceFilter('bun'))}
            {filterBtn('RUST', sourceFilter === 'rust', () => setSourceFilter('rust'))}
          </div>
          <div className="h-4 w-px bg-[var(--border)]" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--ink-tertiary)] font-medium">级别</span>
            {filterBtn('ALL', levelFilter === 'all', () => setLevelFilter('all'))}
            {filterBtn('INFO', levelFilter === 'info', () => setLevelFilter('info'))}
            {filterBtn('WARN', levelFilter === 'warn', () => setLevelFilter('warn'))}
            {filterBtn('ERROR', levelFilter === 'error', () => setLevelFilter('error'))}
            {filterBtn('DEBUG', levelFilter === 'debug', () => setLevelFilter('debug'))}
          </div>
        </div>

        {/* 日志列表 */}
        <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-[18px]">
          {filteredLogs.length === 0 ? (
            <p className="py-8 text-center text-[var(--ink-tertiary)]">暂无日志</p>
          ) : (
            filteredLogs.map((log, i) => {
              const time = log.timestamp.slice(11, 23);
              return (
                <div key={`${log.timestamp}-${i}`} className="flex items-start gap-2 py-px hover:bg-[var(--hover)] rounded px-1">
                  <span className={`inline-block w-[46px] shrink-0 rounded px-1 text-center text-[10px] font-semibold ${SOURCE_COLORS[log.source]}`}>
                    {SOURCE_LABELS[log.source]}
                  </span>
                  <span className="shrink-0 text-[var(--ink-tertiary)]">{time}</span>
                  <span className={`shrink-0 w-[42px] text-right font-semibold ${LEVEL_COLORS[log.level]}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className={`min-w-0 break-all ${log.level === 'error' ? 'text-red-500' : 'text-[var(--ink)]'}`}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-2 text-[11px] text-[var(--ink-tertiary)]">
          <div className="flex items-center gap-3">
            <span>REACT: {sourceCounts.react}</span>
            <span>BUN: {sourceCounts.bun}</span>
            <span>RUST: {sourceCounts.rust}</span>
            <span className="font-medium">Total: {allLogs.length}</span>
          </div>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
