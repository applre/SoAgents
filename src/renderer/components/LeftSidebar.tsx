import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Clock, Folder, FolderOpen, FolderPlus, LayoutList, ListFilter, MessageSquarePlus, MoreHorizontal, PanelLeft, Pencil, Pin, RefreshCw, Settings } from 'lucide-react';
import appIcon from '../../../icon.png';
import { startWindowDrag, toggleMaximize } from '../utils/env';
import type { SessionMetadata } from '../../shared/types/session';
import { relativeTimeCompact } from '../utils/formatTime';

interface Props {
  sessions: SessionMetadata[];
  activeSessionId: string | null;
  agentDir?: string;
  pinnedSessionIds: Set<string>;
  runningSessions?: Set<string>;
  onNewChat: () => void;
  onNewChatInDir: (agentDir: string) => void;
  onNewWorkspace: () => void;
  onSelectSession: (sessionId: string) => void;
  onNavigateToSession: (agentDir: string, sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onUnarchiveSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onTogglePin: (sessionId: string) => void;
  onOpenSettings: () => void;
  onOpenScheduledTasks: () => void;
  onOpenTaskCenter: () => void;
  onCollapse: () => void;
  isSettingsActive?: boolean;
  isScheduledTasksActive?: boolean;
  isTaskCenterActive?: boolean;
  updateReady?: boolean;
  updateVersion?: string | null;
  onRestartAndUpdate?: () => void;
}

type SessionFilter = 'active' | 'archived' | 'all';

const filterLabel: Record<SessionFilter, string> = {
  active: '活跃',
  archived: '已归档',
  all: '全部',
};

export default function LeftSidebar({
  sessions,
  activeSessionId,
  agentDir: _agentDir,
  pinnedSessionIds,
  runningSessions,
  onNewChat,
  onNewChatInDir,
  onNewWorkspace,
  onSelectSession: _onSelectSession,
  onNavigateToSession,
  onArchiveSession,
  onUnarchiveSession,
  onRenameSession,
  onTogglePin,
  onOpenSettings,
  onOpenScheduledTasks,
  onOpenTaskCenter,
  onCollapse,
  isSettingsActive = false,
  isScheduledTasksActive = false,
  isTaskCenterActive = false,
  updateReady = false,
  updateVersion,
  onRestartAndUpdate,
}: Props) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('active');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const sessionTitle = useCallback((s: SessionMetadata) => {
    return s.title || '未命名对话';
  }, []);

  const startRename = useCallback((s: SessionMetadata) => {
    setEditingId(s.id);
    setEditingTitle(s.title || '');
    setMenuOpenId(null);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editingTitle.trim()) {
      onRenameSession(editingId, editingTitle.trim());
    }
    setEditingId(null);
  }, [editingId, editingTitle, onRenameSession]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const toggleGroup = useCallback((dir: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }, []);

  const dirName = useCallback((path: string) => {
    return path.split('/').filter(Boolean).pop() ?? path;
  }, []);

  // Group sessions by agentDir
  const groupedSessions = React.useMemo(() => {
    // 先按归档状态过滤
    const filtered = sessions.filter(s => {
      if (sessionFilter === 'active') return !s.archived;
      if (sessionFilter === 'archived') return s.archived === true;
      return true; // 'all'
    });

    const groups = new Map<string, SessionMetadata[]>();
    for (const s of filtered) {
      const dir = s.agentDir || '未分类';
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir)!.push(s);
    }
    // Sort within each group: pinned first, then by lastActiveAt desc
    for (const [, list] of groups) {
      list.sort((a, b) => {
        const ap = pinnedSessionIds.has(a.id);
        const bp = pinnedSessionIds.has(b.id);
        if (ap !== bp) return ap ? -1 : 1;
        return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
      });
    }
    // Sort groups by their latest session time desc
    return [...groups.entries()].sort((a, b) => {
      const aLatest = new Date(a[1][0]?.lastActiveAt ?? 0).getTime();
      const bLatest = new Date(b[1][0]?.lastActiveAt ?? 0).getTime();
      return bLatest - aLatest;
    });
  }, [sessions, pinnedSessionIds, sessionFilter]);

  const handleSessionClick = useCallback((s: SessionMetadata) => {
    onNavigateToSession(s.agentDir, s.id);
  }, [onNavigateToSession]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[var(--surface)]"
      style={{
        width: 300,
        minWidth: 300,
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* 顶部固定区：Logo + 菜单 */}
      <div
        className="shrink-0"
        style={{ paddingTop: 10, paddingLeft: 14, paddingRight: 14 }}
        onMouseDown={startWindowDrag}
        onDoubleClick={toggleMaximize}
      >
        {/* Logo + 折叠按钮（预留macOS traffic lights 空间）*/}
        <div
          className="flex items-center justify-between"
          style={{ height: 48, paddingLeft: 4, paddingRight: 4, marginTop: 24 }}
        >
          <div className="flex items-center gap-2">
            <img src={appIcon} alt="SoAgents" className="h-6 w-6 rounded-[6px]" />
            <span className="text-[20px] font-semibold text-[var(--ink)]">SoAgents</span>
          </div>
          <button
            onClick={onCollapse}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
          >
            <PanelLeft size={16} />
          </button>
        </div>

        {/* 主菜单 */}
        <div className="flex flex-col gap-1 mt-3" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <button
            onClick={onNewChat}
            className="flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-[15px] font-medium text-[var(--ink)] hover:bg-[var(--hover)] transition-colors text-left"
          >
            <MessageSquarePlus size={16} className="shrink-0" style={{ color: 'var(--ink-secondary)' }} />
            新建对话
          </button>
          <button
            onClick={onOpenTaskCenter}
            className={`flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-[15px] font-medium transition-colors text-left ${
              isTaskCenterActive
                ? 'bg-[var(--hover)] text-[var(--ink)]'
                : 'text-[var(--ink)] hover:bg-[var(--hover)]'
            }`}
          >
            <LayoutList size={16} className="shrink-0" style={{ color: 'var(--ink-secondary)' }} />
            任务中心
          </button>
          <button
            onClick={onOpenScheduledTasks}
            className={`flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-[15px] font-medium transition-colors text-left ${
              isScheduledTasksActive
                ? 'bg-[var(--hover)] text-[var(--ink)]'
                : 'text-[var(--ink)] hover:bg-[var(--hover)]'
            }`}
          >
            <Clock size={16} className="shrink-0" style={{ color: 'var(--ink-secondary)' }} />
            定时任务
          </button>
        </div>
      </div>

      {/* 最近对话标题 + 新建 + 筛选（固定） */}
      {!isSettingsActive && sessions.length > 0 && (
        <div className="shrink-0 flex items-center justify-between" style={{ padding: '12px 22px 6px' }}>
          <span className="text-[13px] font-semibold text-[var(--ink-secondary)]">最近对话</span>
          <div className="relative flex items-center gap-2">
            <button onClick={onNewWorkspace} title="新建工作区">
              <FolderPlus size={16} className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors" />
            </button>
            <button
              onClick={() => setShowFilterMenu(v => !v)}
              className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                sessionFilter !== 'active'
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
              }`}
            >
              <ListFilter size={14} />
            </button>
            {showFilterMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                <div
                  className="absolute right-0 top-full mt-1 z-50 min-w-[100px] rounded-xl border border-[var(--border)] bg-white py-1"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                >
                  {(['active', 'archived', 'all'] as SessionFilter[]).map(key => (
                    <button
                      key={key}
                      onClick={() => { setSessionFilter(key); setShowFilterMenu(false); }}
                      className={`flex w-full items-center px-3 py-1.5 text-[13px] transition-colors ${
                        sessionFilter === key
                          ? 'text-[var(--accent)] font-medium'
                          : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                      }`}
                    >
                      {filterLabel[key]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 可滚动区：session 列表（按工作区分组） */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ paddingLeft: 14, paddingRight: 14 }}>
        {!isSettingsActive && sessions.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {menuOpenId && (
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
            )}
            {groupedSessions.map(([agentDirKey, groupSessions]) => {
              const isCollapsed = collapsedGroups.has(agentDirKey);
              return (
                <div key={agentDirKey}>
                  {/* Group header */}
                  <div className="group/gh flex items-center">
                    <button
                      onClick={() => toggleGroup(agentDirKey)}
                      className="flex flex-1 min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--hover)] transition-colors"
                    >
                      {isCollapsed
                        ? <ChevronRight size={12} className="shrink-0 text-[var(--ink-tertiary)]" />
                        : <ChevronDown size={12} className="shrink-0 text-[var(--ink-tertiary)]" />
                      }
                      {isCollapsed
                        ? <Folder size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
                        : <FolderOpen size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
                      }
                      <span className="truncate text-[14px] font-normal text-[var(--ink-secondary)]">
                        {dirName(agentDirKey)}
                      </span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onNewChatInDir(agentDirKey); }}
                      title="新建对话"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 group-hover/gh:opacity-100 text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-all"
                    >
                      <MessageSquarePlus size={14} />
                    </button>
                  </div>

                  {/* Session items */}
                  {!isCollapsed && (
                    <div className="flex flex-col gap-0.5" style={{ paddingBottom: 4 }}>
                      {groupSessions.map((s) => {
                        const isActive = s.id === activeSessionId;
                        const isPinned = pinnedSessionIds.has(s.id);
                        const isMenuOpen = menuOpenId === s.id;
                        const isEditing = editingId === s.id;

                        return (
                          <div key={s.id} className="group relative">
                            {isEditing ? (
                              <input
                                ref={editInputRef}
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitRename();
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                onBlur={commitRename}
                                className="w-full rounded-lg px-2 py-1.5 text-[14px] bg-white border border-[var(--accent)] outline-none text-[var(--ink)]"
                              />
                            ) : (
                              <>
                                <button
                                  onClick={() => handleSessionClick(s)}
                                  className={`w-full rounded-lg px-2 py-1.5 text-left text-[14px] transition-colors pr-8 flex items-center gap-1.5 ${
                                    isActive
                                      ? 'bg-[var(--border)] text-[var(--ink)]'
                                      : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                                  }`}
                                  style={{ paddingLeft: 26 }}
                                >
                                  {runningSessions?.has(s.id) && (
                                    <span className="relative flex h-2 w-2 shrink-0">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--running-light)] opacity-75" />
                                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--running)]" />
                                    </span>
                                  )}
                                  {isPinned && <Pin size={12} className="shrink-0 text-[var(--ink-tertiary)]" />}
                                  <span className="truncate">{sessionTitle(s)}</span>
                                  <span className="ml-auto shrink-0 text-[11px] text-[var(--ink-tertiary)]">
                                    {relativeTimeCompact(s.lastActiveAt)}
                                  </span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : s.id); }}
                                  className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded transition-all ${
                                    isMenuOpen
                                      ? 'opacity-100 bg-[var(--hover)]'
                                      : 'opacity-0 group-hover:opacity-100 hover:bg-[var(--hover)]'
                                  }`}
                                >
                                  <MoreHorizontal size={14} className="text-[var(--ink-secondary)]" />
                                </button>
                              </>
                            )}

                            {isMenuOpen && (
                              <div
                                className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-[var(--border)] bg-white py-1"
                                style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                              >
                                <button
                                  onClick={() => startRename(s)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
                                >
                                  <Pencil size={14} />
                                  重命名
                                </button>
                                <button
                                  onClick={() => { onTogglePin(s.id); setMenuOpenId(null); }}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
                                >
                                  <Pin size={14} />
                                  {isPinned ? '取消置顶' : '置顶'}
                                </button>
                                {s.archived ? (
                                  <button
                                    onClick={() => { onUnarchiveSession(s.id); setMenuOpenId(null); }}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
                                  >
                                    <ArchiveRestore size={14} />
                                    取消归档
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { onArchiveSession(s.id); setMenuOpenId(null); }}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
                                  >
                                    <Archive size={14} />
                                    归档
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 固定底部：更新提示 + 设置 */}
      <div style={{ padding: '0 14px 14px' }}>
        {updateReady && onRestartAndUpdate && (
          <button
            onClick={onRestartAndUpdate}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-2 mb-2 h-[38px] text-[13px] font-semibold text-white transition-all hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            <RefreshCw size={14} />
            重启以更新 {updateVersion && `v${updateVersion}`}
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-2.5 px-2 rounded-lg h-[38px] w-full transition-colors text-left ${
            isSettingsActive
              ? 'bg-[var(--hover)] text-[var(--ink)]'
              : 'hover:bg-[var(--hover)] text-[var(--ink)]'
          }`}
        >
          <Settings size={16} className="shrink-0" style={{ color: 'var(--ink-secondary)' }} />
          <span className="text-[14px] font-medium">设置</span>
        </button>
      </div>
    </div>
  );
}
