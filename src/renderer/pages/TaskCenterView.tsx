/**
 * TaskCenterView - 任务中心页面
 *
 * 支持看板视图和列表视图切换
 * 看板视图：按工作区/状态/时间分组的卡片看板
 * 列表视图：搜索 + 过滤 + 管理
 */

import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Archive, ArchiveRestore, BarChart2, Clock, Folder, Search, X } from 'lucide-react';
import { useTaskCenterData } from '../hooks/useTaskCenterData';
import { globalApiGetJson, globalApiPutJson } from '../api/apiFetch';
import { relativeTimeCompact } from '../utils/formatTime';
import { BoardView, type GroupBy } from '../components/taskCenter/BoardView';
import SessionStatsModal from '../components/SessionStatsModal';
import CustomSelect from '../components/CustomSelect';
import type { SessionMetadata } from '../../shared/types/session';

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
  onOpenScheduledTasks: _onOpenScheduledTasks,
  onArchiveSession,
  onUnarchiveSession,
}: TaskCenterViewProps) {
  // 视图模式
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [groupBy, setGroupBy] = useState<GroupBy>('workspace');

  const { sessions, cronSessionIds, sessionTagsMap, isLoading, activeSidecarSessionIds } =
    useTaskCenterData(viewMode === 'board');

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

  // ── 看板视图 sessions（包含归档，供 status 分组使用） ──

  const boardSessions = useMemo(() => {
    if (groupBy === 'status') return sessions; // 包含归档
    return sessions.filter(s => !s.archived);
  }, [sessions, groupBy]);

  // ── 事件处理 ──

  const handleSessionClick = useCallback((agentDir: string, sessionId: string) => {
    // Mark as viewed (fire-and-forget)
    globalApiPutJson(`/chat/sessions/${sessionId}/viewed`, {}).catch(() => {});
    // Navigate to session
    onNavigateToSession(agentDir, sessionId);
  }, [onNavigateToSession]);

  const handleListSessionClick = useCallback((session: SessionMetadata) => {
    handleSessionClick(session.agentDir, session.id);
  }, [handleSessionClick]);

  const handleSearchResultClick = useCallback((sessionId: string) => {
    // 从 sessions 找到 agentDir
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      handleSessionClick(session.agentDir, session.id);
    }
  }, [sessions, handleSessionClick]);

  const handleShowStats = useCallback((e: React.MouseEvent, session: SessionMetadata) => {
    e.stopPropagation();
    setStatsSession({ id: session.id, title: session.title || '未命名对话' });
  }, []);

  const dirName = useCallback((path: string) => {
    return path.split('/').filter(Boolean).pop() ?? path;
  }, []);

  // ── 渲染 ──

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">

      {/* ══ 工具栏 ══ */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
        <span className="text-[14px] font-semibold text-[var(--ink)] mr-1">任务中心</span>

        {/* View tabs */}
        <div className="flex border border-[var(--border)] rounded-lg overflow-hidden">
          <button
            className={`px-3.5 py-1.5 text-[12px] transition-colors ${
              viewMode === 'board'
                ? 'bg-[var(--accent)] text-white font-medium'
                : 'text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
            }`}
            onClick={() => setViewMode('board')}
          >
            看板
          </button>
          <button
            className={`px-3.5 py-1.5 text-[12px] border-l border-[var(--border)] transition-colors ${
              viewMode === 'list'
                ? 'bg-[var(--accent)] text-white font-medium'
                : 'text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
            }`}
            onClick={() => setViewMode('list')}
          >
            列表
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--border)]" />

        {/* Group segment control — only in board mode */}
        {viewMode === 'board' && (
          <div className="flex border border-[var(--border)] rounded-lg overflow-hidden">
            {(['workspace', 'status', 'time'] as const).map((g, i) => (
              <button
                key={g}
                className={`px-3 py-1.5 text-[12px] transition-colors ${
                  i > 0 ? 'border-l border-[var(--border)]' : ''
                } ${
                  groupBy === g
                    ? 'bg-[var(--surface)] text-[var(--ink)] font-medium'
                    : 'text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
                }`}
                onClick={() => setGroupBy(g)}
              >
                {{ workspace: '工作区', status: '状态', time: '时间' }[g]}
              </button>
            ))}
          </div>
        )}

        {/* Search (push to right) */}
        <div className="ml-auto">
          <div
            className="flex items-center gap-2 rounded-lg"
            style={{
              height: 34,
              padding: '0 10px',
              width: 220,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <Search size={13} className="shrink-0 text-[var(--ink-tertiary)]" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索对话内容…"
              className="flex-1 bg-transparent text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)]"
            />
            {query && (
              <button onClick={() => setQuery('')} className="shrink-0">
                <X size={12} className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ 内容区 ══ */}
      {viewMode === 'board' && !isSearchMode ? (
        <BoardView
          sessions={boardSessions}
          groupBy={groupBy}
          activeSidecarSessionIds={activeSidecarSessionIds}
          sessionTagsMap={sessionTagsMap}
          onSessionClick={handleSessionClick}
        />
      ) : (
        /* ── 列表视图 ── */
        <div className="flex flex-1 flex-col min-w-0 min-h-0" style={{ padding: '16px 0 24px 32px' }}>

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
                        onClick={() => handleListSessionClick(session)}
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
      )}

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
