import { useState, useRef, useEffect } from 'react';
import { Clock, Trash2, Plus, MoreVertical, Edit2 } from 'lucide-react';
import { useTabState } from '../context/TabContext';
import { formatRelativeTime } from '../utils/formatTime';
import { formatTokens } from '../utils/formatTokens';

export default function SessionHistoryDropdown() {
  const [open, setOpen] = useState(false);
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { sessionId, sessions, loadSession, deleteSession, resetSession, updateSessionTitle, refreshSessions } = useTabState();

  // 自动聚焦输入框
  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingId]);

  const handleLoad = async (id: string) => {
    await loadSession(id);
    setOpen(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setDeleteConfirm({ id, title });
    setMenuOpenFor(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);

    // 如果删除的是当前 Session，先切换到新 Session
    if (id === sessionId) {
      await resetSession();
    }

    await deleteSession(id);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const handleNew = async () => {
    await resetSession();
    setOpen(false);
  };

  const handleMenuClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setMenuOpenFor(menuOpenFor === sessionId ? null : sessionId);
  };

  const handleRenameClick = (e: React.MouseEvent, sessionId: string, currentTitle: string) => {
    e.stopPropagation();
    setRenamingId(sessionId);
    setRenameValue(currentTitle);
    setMenuOpenFor(null);
  };

  const handleRenameSubmit = async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    await updateSessionTitle(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(v => !v); if (!open) refreshSessions(); }}
        className="p-1.5 rounded hover:bg-[var(--paper-dark)] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]"
        title="历史记录"
      >
        <Clock size={16} />
      </button>

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={handleDeleteCancel} />
          <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-80 rounded-xl border border-[var(--border)] bg-[var(--paper)] shadow-2xl">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-medium text-[var(--ink)]">确认删除</h3>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-[var(--ink-secondary)]">
                确定要删除会话 <span className="font-medium text-[var(--ink)]">"{deleteConfirm.title}"</span> 吗？
              </p>
              <p className="mt-2 text-xs text-[var(--ink-tertiary)]">
                此操作不可撤销。
              </p>
            </div>
            <div className="flex gap-2 px-4 py-3 border-t border-[var(--border)]">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--ink-secondary)] hover:bg-[var(--paper-dark)]"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                删除
              </button>
            </div>
          </div>
        </>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-72 rounded-xl border border-[var(--border)] bg-[var(--paper)] shadow-lg overflow-hidden">
            {/* 新对话按钮 */}
            <button
              onClick={handleNew}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--ink-secondary)] hover:bg-[var(--paper-dark)] border-b border-[var(--border)]"
            >
              <Plus size={14} />
              新对话
            </button>

            {/* 历史列表 */}
            <div className="max-h-80 overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-[var(--ink-tertiary)]">暂无历史记录</div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => renamingId !== s.id && handleLoad(s.id)}
                    onMouseEnter={() => setHoveredSession(s.id)}
                    onMouseLeave={() => setHoveredSession(null)}
                    className="group relative flex cursor-pointer items-start justify-between gap-2 px-3 py-2.5 hover:bg-[var(--paper-dark)]"
                  >
                    <div className="min-w-0 flex-1">
                      {/* 重命名输入框 */}
                      {renamingId === s.id ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={handleRenameSubmit}
                          onKeyDown={handleRenameKeyDown}
                          className="w-full px-1 py-0.5 text-sm font-medium bg-[var(--paper-dark)] border border-[var(--border)] rounded text-[var(--ink)] focus:outline-none focus:border-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="truncate text-sm font-medium text-[var(--ink)]">{s.title}</div>
                      )}
                      <div className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
                        {s.agentDir.split('/').pop()} · {formatRelativeTime(s.lastActiveAt)}
                        {s.stats && ` · ${s.stats.messageCount}条`}
                      </div>
                    </div>

                    {/* 菜单按钮 */}
                    <div className="relative flex gap-1 shrink-0">
                      <button
                        onClick={(e) => handleMenuClick(e, s.id)}
                        className="mt-0.5 p-0.5 opacity-0 group-hover:opacity-100 text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]"
                      >
                        <MoreVertical size={13} />
                      </button>

                      {/* 下拉菜单 */}
                      {menuOpenFor === s.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setMenuOpenFor(null); }} />
                          <div className="absolute right-0 top-6 z-40 w-32 rounded-lg border border-[var(--border)] bg-[var(--paper)] shadow-lg overflow-hidden">
                            <button
                              onClick={(e) => handleRenameClick(e, s.id, s.title)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--ink-secondary)] hover:bg-[var(--paper-dark)]"
                            >
                              <Edit2 size={13} />
                              重命名
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(e, s.id, s.title)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-[var(--paper-dark)]"
                            >
                              <Trash2 size={13} />
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Token 统计 Tooltip */}
                    {hoveredSession === s.id && s.stats && renamingId !== s.id && menuOpenFor !== s.id && (
                      <div className="absolute left-full top-0 ml-2 z-30 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 shadow-lg text-xs whitespace-nowrap">
                        <div className="text-[var(--ink-tertiary)]">消息数：{s.stats.messageCount}</div>
                        <div className="text-[var(--ink-tertiary)]">输入：{formatTokens(s.stats.totalInputTokens)} tokens</div>
                        <div className="text-[var(--ink-tertiary)]">输出：{formatTokens(s.stats.totalOutputTokens)} tokens</div>
                        <div className="text-[var(--ink-secondary)] font-medium mt-1 pt-1 border-t border-[var(--border)]">
                          总计：{formatTokens(s.stats.totalInputTokens + s.stats.totalOutputTokens)} tokens
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
