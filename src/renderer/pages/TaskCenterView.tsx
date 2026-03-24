/**
 * TaskCenterView - 任务中心页面
 *
 * 左列：Session 列表（搜索 + 过滤 + 管理）
 * 右列：定时任务列表（摘要 + 跳转入口）
 */

import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Archive, ArchiveRestore, BarChart2, Clock, Folder, Plus, Search, X } from 'lucide-react';
import { useTaskCenterData } from '../hooks/useTaskCenterData';
import { globalApiGetJson } from '../api/apiFetch';
import { relativeTimeCompact } from '../utils/formatTime';
import { formatScheduleLabel } from '../components/scheduledTasks/scheduleUtils';
import SessionStatsModal from '../components/SessionStatsModal';
import CustomSelect from '../components/CustomSelect';
import type { SessionMetadata } from '../../shared/types/session';
import type { ScheduledTask } from '../../shared/types/scheduledTask';

// ── 搜索结果类型 ──

interface SearchMatch {
  id: string;
  role: string;
  preview: string;
}

interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  matches: SearchMatch[];
}

// ── Props ──

interface TaskCenterViewProps {
  onNavigateToSession: (agentDir: string, sessionId: string) => void;
  onOpenScheduledTasks: () => void;
  onArchiveSession: (sessionId: string) => void;
  onUnarchiveSession: (sessionId: string) => void;
}

type StatusFilter = 'all' | 'cron' | 'archived';

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'cron', label: '定时' },
  { key: 'archived', label: '已归档' },
];

export default memo(function TaskCenterView({
  onNavigateToSession,
  onOpenScheduledTasks,
  onArchiveSession,
  onUnarchiveSession,
}: TaskCenterViewProps) {
  const { sessions, scheduledTasks, cronSessionIds, isLoading } = useTaskCenterData();

  // 搜索状态
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 过滤状态
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all');

  // 弹窗状态
  const [statsSession, setStatsSession] = useState<{ id: string; title: string } | null>(null);

  const isSearchMode = query.trim().length > 0;

  // ── 搜索逻辑 ──

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    abortRef.current?.abort();

    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await globalApiGetJson<SearchResult[]>(
          `/chat/search?q=${encodeURIComponent(q)}`
        );
        if (!controller.signal.aborted) setSearchResults(data);
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      abortRef.current?.abort();
    };
  }, [query]);

  // ── 工作区选项 ──

  const workspaceOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const s of sessions) {
      if (s.agentDir) seen.add(s.agentDir);
    }
    return [...seen].sort().map(dir => ({
      value: dir,
      label: dir.split('/').filter(Boolean).pop() ?? dir,
    }));
  }, [sessions]);

  const workspaceSelectOptions = useMemo(() => [
    { value: 'all', label: '全部工作区' },
    ...workspaceOptions.map(ws => ({
      value: ws.value,
      label: ws.label,
      icon: <Folder size={13} className="text-[var(--ink-tertiary)]" />,
    })),
  ], [workspaceOptions]);

  // ── 过滤 sessions ──

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // 归档过滤
      if (statusFilter === 'archived') {
        if (!session.archived) return false;
      } else {
        // 非归档视图默认隐藏已归档的
        if (session.archived) return false;

        // 定时任务过滤：只显示由定时任务创建的 session
        if (statusFilter === 'cron') {
          if (!cronSessionIds.has(session.id)) return false;
        }
      }

      // 工作区过滤
      if (workspaceFilter !== 'all' && session.agentDir !== workspaceFilter) return false;

      return true;
    });
  }, [sessions, statusFilter, workspaceFilter, cronSessionIds]);

  // ── 定时任务排序 ──

  const sortedTasks = useMemo(() => {
    return [...scheduledTasks].sort((a, b) => {
      // 启用优先
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      // running 优先
      const aRunning = a.state.lastStatus === 'running';
      const bRunning = b.state.lastStatus === 'running';
      if (aRunning !== bRunning) return aRunning ? -1 : 1;
      // 按下次执行时间 ASC
      if (a.enabled && a.state.nextRunAtMs && b.state.nextRunAtMs) {
        return a.state.nextRunAtMs - b.state.nextRunAtMs;
      }
      // 按更新时间 DESC
      return b.updatedAtMs - a.updatedAtMs;
    });
  }, [scheduledTasks]);

  // ── 事件处理 ──

  const handleSessionClick = useCallback((session: SessionMetadata) => {
    onNavigateToSession(session.agentDir, session.id);
  }, [onNavigateToSession]);

  const handleSearchResultClick = useCallback((sessionId: string) => {
    // 从 sessions 找到 agentDir
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      onNavigateToSession(session.agentDir, session.id);
    }
  }, [sessions, onNavigateToSession]);

  const handleShowStats = useCallback((e: React.MouseEvent, session: SessionMetadata) => {
    e.stopPropagation();
    setStatsSession({ id: session.id, title: session.title || '未命名对话' });
  }, []);

  const handleCronClick = useCallback((_task: ScheduledTask) => {
    onOpenScheduledTasks();
  }, [onOpenScheduledTasks]);

  const handleCreateTask = useCallback(() => {
    onOpenScheduledTasks();
  }, [onOpenScheduledTasks]);

  const dirName = useCallback((path: string) => {
    return path.split('/').filter(Boolean).pop() ?? path;
  }, []);

  // ── 渲染 ──

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ══ 左列：Session 管理 ══ */}
      <div className="flex flex-1 flex-col min-w-0" style={{ padding: '24px 0 24px 32px' }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3.5"
          style={{ color: 'rgba(153,153,153,0.6)' }}>
          最近任务
        </div>

        {/* 搜索框 */}
        <div
          className="flex items-center gap-2 rounded-lg mb-2.5"
          style={{
            height: 38,
            padding: '0 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            marginRight: 24,
          }}
        >
          <Search size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索对话内容…"
            className="flex-1 bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="shrink-0">
              <X size={13} className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors" />
            </button>
          )}
        </div>

        {/* 过滤栏（搜索模式时隐藏） */}
        {!isSearchMode && (
          <div className="flex items-center gap-2 mb-3.5" style={{ marginRight: 24 }}>
            <div className="flex gap-1">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setStatusFilter(opt.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    statusFilter === opt.key
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {workspaceOptions.length > 1 && (
              <CustomSelect
                value={workspaceFilter}
                options={workspaceSelectOptions}
                onChange={setWorkspaceFilter}
                className="w-[140px]"
              />
            )}
          </div>
        )}

        {/* Session 列表 / 搜索结果 */}
        <div className="flex-1 overflow-y-auto" style={{ paddingRight: 24 }}>

          {/* 加载中 */}
          {isLoading && !isSearchMode && (
            <div className="flex items-center justify-center py-16 text-[13px] text-[var(--ink-tertiary)]">
              加载中…
            </div>
          )}

          {/* ── 搜索模式 ── */}
          {isSearchMode && (
            <>
              {searching && (
                <div className="flex items-center justify-center py-16 text-[13px] text-[var(--ink-tertiary)]">
                  搜索中…
                </div>
              )}
              {!searching && searchResults.length === 0 && (
                <div className="flex items-center justify-center py-16 text-[13px] text-[var(--ink-tertiary)]">
                  没有找到相关对话
                </div>
              )}
              {!searching && searchResults.map(r => (
                <div key={r.sessionId}>
                  <button
                    onClick={() => handleSearchResultClick(r.sessionId)}
                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-[var(--hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] font-semibold text-[var(--ink)] truncate">{r.sessionTitle}</span>
                    </div>
                    {r.matches.map(m => (
                      <div key={m.id} className="ml-0 text-[12px] text-[var(--ink-tertiary)] truncate" style={{ marginBottom: 2 }}>
                        <span className="text-[var(--ink-secondary)] mr-1">{m.role === 'user' ? '你' : 'AI'}:</span>
                        {m.preview}
                      </div>
                    ))}
                  </button>
                  <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />
                </div>
              ))}
            </>
          )}

          {/* ── 列表模式 ── */}
          {!isSearchMode && !isLoading && (
            <>
              {filteredSessions.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-[13px] text-[var(--ink-tertiary)]">
                  暂无匹配的任务
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredSessions.map(session => (
                    <div
                      key={session.id}
                      role="button"
                      onClick={() => handleSessionClick(session)}
                      className="group relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--hover)]"
                    >
                      {/* 时间 */}
                      <div className="flex w-12 shrink-0 items-center gap-1 text-[11px]" style={{ color: 'rgba(153,153,153,0.5)' }}>
                        <Clock className="h-2.5 w-2.5" />
                        <span>{relativeTimeCompact(session.lastActiveAt)}</span>
                      </div>

                      {/* 标题 */}
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-secondary)] transition-colors group-hover:text-[var(--ink)]">
                        {session.title || '未命名对话'}
                        {session.stats?.messageCount != null && (
                          <span className="ml-1.5 text-[10px]" style={{ color: 'rgba(153,153,153,0.4)' }}>
                            {session.stats.messageCount}条
                          </span>
                        )}
                      </span>

                      {/* 工作区 */}
                      <div className="flex shrink-0 items-center gap-1 text-[11px]" style={{ color: 'rgba(153,153,153,0.45)' }}>
                        <Folder className="h-3 w-3" />
                        <span className="max-w-[80px] truncate">{dirName(session.agentDir)}</span>
                      </div>

                      {/* Hover 操作 */}
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                        <div className="h-full w-10 bg-gradient-to-r from-transparent to-[var(--hover)]" />
                        <div className="flex h-full items-center gap-1 bg-[var(--hover)] pr-3">
                          <button
                            onClick={e => handleShowStats(e, session)}
                            title="查看统计"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                          >
                            <BarChart2 className="h-3.5 w-3.5" />
                          </button>
                          {session.archived ? (
                            <button
                              onClick={e => { e.stopPropagation(); onUnarchiveSession(session.id); }}
                              title="取消归档"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                            >
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); onArchiveSession(session.id); }}
                              title="归档"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ 右列：定时任务 ══ */}
      <div
        className="flex w-[300px] shrink-0 flex-col"
        style={{ borderLeft: '1px solid var(--border)', padding: '24px 24px 24px 20px' }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3.5"
          style={{ color: 'rgba(153,153,153,0.6)' }}>
          定时任务
        </div>

        {/* 新建按钮 */}
        <button
          onClick={handleCreateTask}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-[13px] font-medium transition-colors hover:bg-[var(--hover)]"
          style={{ borderColor: 'var(--border)', color: 'var(--ink-tertiary)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          新建定时任务
        </button>

        {/* 定时任务列表 */}
        <div className="flex-1 overflow-y-auto">
          {sortedTasks.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[13px] text-[var(--ink-tertiary)]">
              暂无定时任务
            </div>
          ) : (
            <div className="space-y-0.5">
              {sortedTasks.map(task => {
                const isRunning = task.state.lastStatus === 'running';
                return (
                  <button
                    key={task.id}
                    onClick={() => handleCronClick(task)}
                    className="group flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)]"
                  >
                    <div className="flex items-center gap-2">
                      {/* 状态圆点 */}
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background: isRunning
                            ? 'var(--accent)'
                            : task.enabled
                              ? 'var(--success)'
                              : 'var(--ink-tertiary)',
                          animation: isRunning ? 'pulse 2s ease-in-out infinite' : undefined,
                        }}
                      />
                      {/* 状态文字 */}
                      <span
                        className="text-[12px] font-medium"
                        style={{
                          color: isRunning
                            ? 'var(--accent)'
                            : task.enabled
                              ? 'var(--success)'
                              : 'var(--ink-tertiary)',
                        }}
                      >
                        {isRunning ? '执行中' : task.enabled ? '已启用' : '已停用'}
                      </span>
                      {/* 任务名 */}
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-secondary)] transition-colors group-hover:text-[var(--ink)]">
                        {task.name || task.prompt.slice(0, 30)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: 'rgba(153,153,153,0.5)' }}>
                      <span>{dirName(task.workingDirectory)}</span>
                      <span>{formatScheduleLabel(task.schedule)}</span>
                      {task.enabled && task.state.nextRunAtMs && (
                        <span style={{ marginLeft: 'auto' }}>
                          下次: {formatNextRun(task.state.nextRunAtMs)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 弹窗 ── */}

      {statsSession && (
        <SessionStatsModal
          sessionId={statsSession.id}
          sessionTitle={statsSession.title}
          onClose={() => setStatsSession(null)}
        />
      )}
    </div>
  );
});

// ── 辅助函数 ──

function formatNextRun(ms: number): string {
  const dt = new Date(ms);
  const now = new Date();
  const isToday = dt.toDateString() === now.toDateString();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  if (isToday) return timeStr;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dt.toDateString() === tomorrow.toDateString()) return `明天 ${timeStr}`;
  return `${pad(dt.getMonth() + 1)}/${pad(dt.getDate())} ${timeStr}`;
}
