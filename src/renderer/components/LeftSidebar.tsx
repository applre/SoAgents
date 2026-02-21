import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal, PanelLeft, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { startWindowDrag } from '../utils/env';
import type { SessionMetadata } from '../../shared/types/session';
import SearchModal from './SearchModal';

interface Props {
  sessions: SessionMetadata[];
  activeSessionId: string | null;
  pinnedSessionIds: Set<string>;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onTogglePin: (sessionId: string) => void;
  onOpenSettings: () => void;
  onCollapse: () => void;
  isSettingsActive?: boolean;
}

export default function LeftSidebar({
  sessions,
  activeSessionId,
  pinnedSessionIds,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onTogglePin,
  onOpenSettings,
  onCollapse,
  isSettingsActive = false,
}: Props) {
  const [showSearch, setShowSearch] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
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

  const sortedSessions = React.useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aPinned = pinnedSessionIds.has(a.id);
      const bPinned = pinnedSessionIds.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return 0;
    });
  }, [sessions, pinnedSessionIds]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[var(--surface)]"
      style={{
        width: 278,
        minWidth: 278,
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* 顶部固定区：Logo + 菜单 */}
      <div className="shrink-0" style={{ paddingTop: 10, paddingLeft: 14, paddingRight: 14 }}>
        {/* Logo + 折叠按钮（预留macOS traffic lights 空间）*/}
        <div
          className="flex items-center justify-between"
          style={{ height: 48, paddingLeft: 4, paddingRight: 4, marginTop: 24 }}
          onMouseDown={startWindowDrag}
        >
          <div className="flex items-center gap-2">
            <span className="text-[20px] font-semibold text-[var(--ink)]">SoAgents</span>
          </div>
          <PanelLeft
            size={20}
            className="text-[var(--ink-tertiary)] cursor-pointer hover:text-[var(--ink)] transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onCollapse}
          />
        </div>

        {/* 主菜单 */}
        <div className="flex flex-col gap-1 mt-3">
          <button
            onClick={onNewChat}
            className="flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--hover)] transition-colors text-left"
          >
            新建对话
          </button>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--hover)] transition-colors text-left"
          >
            搜索对话
          </button>
        </div>
      </div>

      {/* 最近对话标题（固定） */}
      {!isSettingsActive && sessions.length > 0 && (
        <div className="shrink-0 flex items-center justify-between" style={{ padding: '12px 22px 6px' }}>
          <span className="text-[14px] font-semibold text-[var(--ink-secondary)]">最近对话</span>
          <button onClick={onNewChat}>
            <Plus size={16} className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors" />
          </button>
        </div>
      )}

      {/* 可滚动区：session 列表 */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ paddingLeft: 14, paddingRight: 14 }}>
        {!isSettingsActive && sessions.length > 0 && (
          <div className="flex flex-col gap-0.5 rounded-2xl relative" style={{ background: '#F5F3F0', padding: '6px 8px' }}>
            {menuOpenId && (
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
            )}
            {sortedSessions.slice(0, 10).map((s) => {
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
                        onClick={() => onSelectSession(s.id)}
                        className={`w-full rounded-lg px-2 py-1.5 text-left text-[14px] transition-colors truncate pr-8 flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-[var(--border)] text-[var(--ink)]'
                            : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                        }`}
                      >
                        {isPinned && <Pin size={12} className="shrink-0 text-[var(--ink-tertiary)]" />}
                        <span className="truncate">{sessionTitle(s)}</span>
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
                      <button
                        onClick={() => { onDeleteSession(s.id); setMenuOpenId(null); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 搜索弹窗 */}
      {showSearch && (
        <SearchModal
          onSelectSession={onSelectSession}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* 固定底部：设置 */}
      <div style={{ padding: '0 14px 14px' }}>
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-2.5 px-2 rounded-lg h-[38px] w-full transition-colors text-left ${
            isSettingsActive
              ? 'bg-[var(--hover)] text-[var(--ink)]'
              : 'hover:bg-[var(--hover)] text-[var(--ink)]'
          }`}
        >
          <span className="text-[14px] font-medium">设置</span>
        </button>
      </div>
    </div>
  );
}
