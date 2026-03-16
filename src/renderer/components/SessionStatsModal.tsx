import { BarChart2, Clock, Loader2, MessageSquare, Wrench, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessionStats, type SessionDetailedStats } from '../api/statsApi';
import { formatTokens, formatDuration } from '../utils/formatTokens';

interface SessionStatsModalProps {
  sessionId: string;
  sessionTitle: string;
  onClose: () => void;
}

export default function SessionStatsModal({ sessionId, sessionTitle, onClose }: SessionStatsModalProps) {
  const [stats, setStats] = useState<SessionDetailedStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      try {
        const data = await getSessionStats(sessionId);
        if (cancelled) return;
        if (data) {
          setStats(data);
        } else {
          setError('无法加载统计数据');
        }
      } catch {
        if (!cancelled) setError('加载失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadStats();
    return () => { cancelled = true; };
  }, [sessionId]);

  const mouseDownTargetRef = useRef<EventTarget | null>(null);

  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownTargetRef.current = e.target;
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const totalTokens = (stats?.summary.totalInputTokens ?? 0) + (stats?.summary.totalOutputTokens ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      style={{ padding: '4vh 4vw' }}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="flex max-h-full w-full max-w-2xl select-text flex-col overflow-hidden rounded-2xl bg-[var(--paper)] shadow-2xl border border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] bg-opacity-15">
              <BarChart2 className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[var(--ink)]">会话统计</div>
              <div className="truncate text-[11px] text-[var(--ink-tertiary)]">{sessionTitle}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center gap-2 text-[var(--ink-tertiary)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          ) : error ? (
            <div className="flex h-32 items-center justify-center text-[var(--error)]">{error}</div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-2 text-[var(--ink-tertiary)]">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-xs">消息数</span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{stats.summary.messageCount}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-2 text-[var(--ink-tertiary)]">
                    <BarChart2 className="h-4 w-4" />
                    <span className="text-xs">总 Tokens</span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{formatTokens(totalTokens)}</div>
                  <div className="mt-1 text-xs text-[var(--ink-tertiary)]">
                    输入 {formatTokens(stats.summary.totalInputTokens)} / 输出 {formatTokens(stats.summary.totalOutputTokens)}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-2 text-[var(--ink-tertiary)]">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">输入缓存</span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                    {formatTokens((stats.summary.totalCacheReadTokens ?? 0) + (stats.summary.totalCacheCreationTokens ?? 0))}
                  </div>
                  <div className="mt-1 text-xs text-[var(--ink-tertiary)]">输入缓存 tokens</div>
                </div>
              </div>

              {/* By Model Table */}
              {Object.keys(stats.byModel).length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">按模型统计</h3>
                  <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--surface)]">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ink-tertiary)]">模型</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">输入</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">输出</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">输入缓存</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">次数</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {Object.entries(stats.byModel).map(([model, data]) => (
                          <tr key={model}>
                            <td className="px-4 py-2 text-[var(--ink)]">{model}</td>
                            <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">{formatTokens(data.inputTokens)}</td>
                            <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">{formatTokens(data.outputTokens)}</td>
                            <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">
                              {formatTokens((data.cacheReadTokens ?? 0) + (data.cacheCreationTokens ?? 0))}
                            </td>
                            <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">{data.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Message Details Table */}
              {stats.messageDetails.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">消息明细</h3>
                  <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-[var(--surface)]">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ink-tertiary)]">问题</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">输入</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">输出</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">输入缓存</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">
                              <Wrench className="inline h-3 w-3" />
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">
                              <Clock className="inline h-3 w-3" />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {stats.messageDetails.map((detail, index) => (
                            <tr key={index}>
                              <td className="max-w-[200px] truncate px-4 py-2 text-[var(--ink)]" title={detail.userQuery}>
                                {detail.userQuery || '-'}
                              </td>
                              <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">{formatTokens(detail.inputTokens)}</td>
                              <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">{formatTokens(detail.outputTokens)}</td>
                              <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">
                                {formatTokens((detail.cacheReadTokens ?? 0) + (detail.cacheCreationTokens ?? 0))}
                              </td>
                              <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">{detail.toolCount ?? '-'}</td>
                              <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">
                                {detail.durationMs ? formatDuration(detail.durationMs) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {stats.messageDetails.length === 0 && (
                <div className="py-8 text-center text-sm text-[var(--ink-tertiary)]">暂无统计数据</div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--hover)]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
