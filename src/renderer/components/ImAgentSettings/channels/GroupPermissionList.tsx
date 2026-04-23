import { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import type { GroupPermission } from '../../../../shared/types/im';

interface GroupPermissionListProps {
  permissions: GroupPermission[];
  onApprove: (groupId: string) => Promise<void>;
  onReject: (groupId: string) => Promise<void>;
  onRemove: (groupId: string) => Promise<void>;
}

const platformLabel = (platform: string) => {
  if (platform === 'telegram') return 'Telegram';
  if (platform === 'dingtalk') return '钉钉';
  return '飞书';
};

export default function GroupPermissionList({
  permissions,
  onApprove,
  onReject,
  onRemove,
}: GroupPermissionListProps) {
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = permissions.filter((p) => p.status === 'pending');
  const approved = permissions.filter((p) => p.status === 'approved');

  const handleAction = async (action: () => Promise<void>, groupId: string) => {
    setLoading(groupId);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-[12px] text-[var(--error)]">{error}</p>}

      {/* Pending groups */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <label className="text-[12px] font-medium" style={{ color: '#eab308' }}>待审核</label>
          {pending.map((g) => (
            <div
              key={g.groupId}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
              style={{ borderColor: 'rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.05)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[var(--ink)]">{g.groupName}</p>
                <p className="text-[12px] text-[var(--ink-tertiary)]">
                  {platformLabel(g.platform)}
                </p>
              </div>
              <div className="ml-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { void handleAction(() => onApprove(g.groupId), g.groupId); }}
                  disabled={loading === g.groupId}
                  className="rounded-md bg-[var(--accent)] p-1.5 text-white transition-colors hover:opacity-90 disabled:opacity-50"
                  title="允许"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { void handleAction(() => onReject(g.groupId), g.groupId); }}
                  disabled={loading === g.groupId}
                  className="rounded-md bg-[var(--surface)] p-1.5 text-[var(--ink-tertiary)] transition-colors hover:text-[var(--error)] disabled:opacity-50"
                  title="拒绝"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approved groups */}
      {approved.length > 0 && (
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-[var(--ink-tertiary)]">已授权群聊</label>
          {approved.map((g) => (
            <div
              key={g.groupId}
              className="group flex items-center justify-between rounded-lg bg-[var(--surface)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-[var(--ink)]">{g.groupName}</p>
                <p className="text-[12px] text-[var(--ink-tertiary)]">{platformLabel(g.platform)}</p>
              </div>
              {confirmRemove === g.groupId ? (
                <div className="ml-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { void handleAction(() => onRemove(g.groupId), g.groupId); setConfirmRemove(null); }}
                    className="rounded-md bg-[var(--error)] px-2 py-1 text-[11px] font-medium text-white hover:opacity-90"
                  >
                    确认移除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(null)}
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--ink-tertiary)] hover:bg-[var(--hover)]"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(g.groupId)}
                  className="ml-3 rounded-md p-1.5 text-[var(--ink-tertiary)] opacity-0 transition-all hover:text-[var(--error)] group-hover:opacity-100"
                  title="移除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {permissions.length === 0 && (
        <p className="text-[12px] text-[var(--ink-tertiary)]">
          暂无群聊。将 Bot 拉入群后，在群内发送任意消息即可被识别，届时群聊会出现在这里等待授权。
        </p>
      )}
    </div>
  );
}
