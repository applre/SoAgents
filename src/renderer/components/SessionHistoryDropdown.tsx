import { useState } from 'react';
import { Clock, Trash2, Plus } from 'lucide-react';
import { useTabState } from '../context/TabContext';
import { formatRelativeTime } from '../utils/formatTime';

export default function SessionHistoryDropdown() {
  const [open, setOpen] = useState(false);
  const { sessions, loadSession, deleteSession, resetSession, refreshSessions } = useTabState();

  const handleLoad = async (id: string) => {
    await loadSession(id);
    setOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('确认删除此会话？')) return;
    await deleteSession(id);
  };

  const handleNew = async () => {
    await resetSession();
    setOpen(false);
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
                    onClick={() => handleLoad(s.id)}
                    className="group flex cursor-pointer items-start justify-between gap-2 px-3 py-2.5 hover:bg-[var(--paper-dark)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[var(--ink)]">{s.title}</div>
                      <div className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
                        {s.agentDir.split('/').pop()} · {formatRelativeTime(s.lastActiveAt)}
                        {s.stats && ` · ${s.stats.messageCount}条`}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, s.id)}
                      className="mt-0.5 shrink-0 p-0.5 opacity-0 group-hover:opacity-100 text-[var(--ink-tertiary)] hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
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
