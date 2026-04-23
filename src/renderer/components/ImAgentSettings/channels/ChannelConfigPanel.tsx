import { useCallback, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { ChannelConfig } from '../../../../shared/types/agentConfig';
import type { ImBotStatus } from '../../../../shared/types/im';
import { verifyToken } from '../../../config/agentConfigService';

interface ChannelConfigPanelProps {
  channel: ChannelConfig;
  agentId: string;
  status?: ImBotStatus;
  onChange: (updated: ChannelConfig) => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
}

type ReVerifyState = 'idle' | 'loading' | 'valid' | 'invalid';

function maskToken(token: string): string {
  if (!token || token.length <= 8) return token;
  const visible = token.slice(-8);
  const dots = '•'.repeat(Math.min(token.length - 8, 24));
  return dots + visible;
}

function StatusDot({ status }: { status?: ImBotStatus }) {
  if (!status) return <span className="h-2 w-2 rounded-full bg-[var(--border)]" title="未知" />;
  const map: Record<string, { color: string; label: string }> = {
    online: { color: 'bg-[var(--running)]', label: '运行中' },
    connecting: { color: 'bg-[var(--warning)]', label: '连接中' },
    error: { color: 'bg-[var(--error)]', label: '错误' },
    stopped: { color: 'bg-[var(--ink-tertiary)]', label: '已停止' },
  };
  const s = map[status.status] ?? { color: 'bg-[var(--border)]', label: status.status };
  return <span className={`h-2 w-2 rounded-full ${s.color}`} title={s.label} />;
}

function PlatformIcon({ type }: { type: ChannelConfig['type'] }) {
  if (type === 'telegram') return <Send className="h-4 w-4 text-[var(--ink-tertiary)]" />;
  return null;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatRelativeTime(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export default function ChannelConfigPanel({
  channel,
  agentId: _agentId,
  status,
  onChange,
  onDelete,
  onStart,
  onStop,
}: ChannelConfigPanelProps) {
  const [tokenVisible, setTokenVisible] = useState(false);
  const [reVerifyState, setReVerifyState] = useState<ReVerifyState>('idle');
  const [reVerifyMsg, setReVerifyMsg] = useState('');

  const [newUser, setNewUser] = useState('');
  const [dangerOpen, setDangerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isRunning = status?.status === 'online' || status?.status === 'connecting';

  const handleReVerify = async () => {
    if (!channel.botToken) return;
    setReVerifyState('loading');
    setReVerifyMsg('');
    try {
      const username = await verifyToken(channel.type, channel.botToken);
      onChange({ ...channel, name: username });
      setReVerifyState('valid');
      setReVerifyMsg(`已验证：@${username}`);
    } catch (err) {
      setReVerifyState('invalid');
      setReVerifyMsg(err instanceof Error ? err.message : 'Token 验证失败');
    }
  };

  const handleAddUser = useCallback(() => {
    const trimmed = newUser.trim();
    if (!trimmed) return;
    const current = channel.allowedUsers ?? [];
    if (current.includes(trimmed)) {
      setNewUser('');
      return;
    }
    onChange({ ...channel, allowedUsers: [...current, trimmed] });
    setNewUser('');
  }, [newUser, channel, onChange]);

  const handleRemoveUser = useCallback(
    (user: string) => {
      onChange({
        ...channel,
        allowedUsers: (channel.allowedUsers ?? []).filter((u) => u !== user),
      });
    },
    [channel, onChange],
  );

  const handleDraftToggle = useCallback(
    (checked: boolean) => {
      onChange({ ...channel, telegramUseDraft: checked });
    },
    [channel, onChange],
  );

  const handleConfirmDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete();
  };

  return (
    <div className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <PlatformIcon type={channel.type} />
        <StatusDot status={status} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-[14px] font-medium text-[var(--ink)]">
            {channel.name ? `@${channel.name}` : channel.type}
          </p>
          {status?.botUsername && channel.name !== status.botUsername && (
            <p className="text-[12px] text-[var(--ink-tertiary)]">@{status.botUsername}</p>
          )}
        </div>
        {/* Start / Stop */}
        {isRunning ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)]"
          >
            <Square className="h-3.5 w-3.5" />
            停止
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <Play className="h-3.5 w-3.5" />
            启动
          </button>
        )}
      </div>

      {/* ── Runtime Status (when online) ── */}
      {status && (status.status === 'online' || status.status === 'connecting') && (
        <>
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-[var(--surface)] p-3">
            <div>
              <p className="text-[11px] text-[var(--ink-tertiary)]">运行时间</p>
              <p className="text-[13px] font-medium text-[var(--ink)]">{formatUptime(status.uptimeSeconds)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--ink-tertiary)]">活跃会话</p>
              <p className="text-[13px] font-medium text-[var(--ink)]">{status.activeSessions.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--ink-tertiary)]">最后消息</p>
              <p className="text-[13px] font-medium text-[var(--ink)]">
                {status.activeSessions.length > 0 ? formatRelativeTime(status.activeSessions[0].lastActive) : '-'}
              </p>
            </div>
          </div>
          {status.errorMessage && (
            <p className="rounded-lg bg-[var(--error)]/10 px-3 py-2 text-[12px] text-[var(--error)]">
              {status.errorMessage}
            </p>
          )}
          {status.bufferedMessages > 0 && (
            <p className="text-[12px] text-[var(--ink-tertiary)]">
              {status.bufferedMessages} 条消息已缓冲（等待 Sidecar 恢复后重放）
            </p>
          )}
        </>
      )}

      <div className="h-px bg-[var(--border)]" />

      {/* ── Token ── */}
      <div className="space-y-2">
        <label className="text-[13px] font-medium text-[var(--ink)]">Bot Token</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-[13px] text-[var(--ink-secondary)] select-all">
            {tokenVisible
              ? (channel.botToken ?? '')
              : maskToken(channel.botToken ?? '')}
          </div>
          <button
            type="button"
            onClick={() => setTokenVisible(!tokenVisible)}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
            title={tokenVisible ? '隐藏' : '显示'}
          >
            {tokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleReVerify}
            disabled={reVerifyState === 'loading' || !channel.botToken}
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-2 text-[13px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
            title="重新验证"
          >
            {reVerifyState === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            验证
          </button>
        </div>
        {reVerifyState === 'valid' && (
          <p className="flex items-center gap-1 text-[12px] text-[var(--success)]">
            <Check className="h-3.5 w-3.5" />
            {reVerifyMsg}
          </p>
        )}
        {reVerifyState === 'invalid' && (
          <p className="text-[12px] text-[var(--error)]">{reVerifyMsg}</p>
        )}
      </div>

      <div className="h-px bg-[var(--border)]" />

      {/* ── Allowed Users ── */}
      <div className="space-y-2">
        <label className="text-[13px] font-medium text-[var(--ink)]">允许的用户</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
            placeholder="Telegram User ID"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            onClick={handleAddUser}
            disabled={!newUser.trim()}
            className="rounded-lg bg-[var(--accent)] p-2 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {(channel.allowedUsers ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {(channel.allowedUsers ?? []).map((user) => (
              <span
                key={user}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--ink)]"
              >
                {user}
                <button
                  onClick={() => handleRemoveUser(user)}
                  className="rounded-full p-0.5 text-[var(--ink-tertiary)] transition-colors hover:text-[var(--error)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--ink-tertiary)]">
            未设置白名单，允许所有用户
          </p>
        )}
      </div>

      <div className="h-px bg-[var(--border)]" />

      {/* ── Draft Streaming ── */}
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[var(--ink)]">Draft 流式输出（实验性）</p>
          <p className="text-[12px] text-[var(--ink-tertiary)]">
            通过修改草稿实时推送 AI 回复，减少等待感
          </p>
        </div>
        <input
          type="checkbox"
          checked={channel.telegramUseDraft ?? true}
          onChange={(e) => handleDraftToggle(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
        />
      </label>

      <div className="h-px bg-[var(--border)]" />

      {/* ── Proxy URL ── */}
      {channel.type === 'telegram' && (
        <>
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--ink)]">代理地址</label>
            <input
              type="text"
              value={channel.proxyUrl ?? ''}
              onChange={(e) => onChange({ ...channel, proxyUrl: e.target.value || undefined })}
              placeholder="http://127.0.0.1:7890"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
            />
            <p className="text-[12px] text-[var(--ink-tertiary)]">
              Telegram API 在中国大陆被屏蔽，需设置 HTTP/SOCKS5 代理
            </p>
          </div>
          <div className="h-px bg-[var(--border)]" />
        </>
      )}

      {/* ── Danger Zone ── */}
      <div className="space-y-2">
        <button
          onClick={() => setDangerOpen(!dangerOpen)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink-tertiary)] transition-colors hover:text-[var(--ink)]"
        >
          {dangerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          危险操作
        </button>
        {dangerOpen && (
          <div className="rounded-lg border border-[var(--error)] bg-[var(--error-bg)] p-3">
            <p className="mb-3 text-[13px] text-[var(--error)]">
              删除此频道将停止 Bot 并移除所有配置，操作不可撤销。
            </p>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirmDelete}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--error)] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  确认删除
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)]"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--error)] px-3 py-1.5 text-[13px] font-medium text-[var(--error)] transition-colors hover:bg-[var(--error)] hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除频道
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
