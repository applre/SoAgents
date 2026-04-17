// Channel detail view — accordion layout inside overlay.
// Sections: Header, Credentials, User Binding, Group Permissions, Draft Streaming, Proxy, Danger Zone.
import { useCallback, useState } from 'react';
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import type { ChannelConfig } from '../../../../shared/types/agentConfig';
import type { ImBotStatus, GroupPermission } from '../../../../shared/types/im';
import {
  verifyToken,
  verifyFeishuCredentials,
  verifyDingtalkCredentials,
  approveGroupPermission,
  rejectGroupPermission,
  removeGroupPermission,
} from '../../../config/agentConfigService';
import FeishuCredentialInput from './FeishuCredentialInput';
import DingtalkCredentialInput from './DingtalkCredentialInput';
import GroupPermissionList from './GroupPermissionList';

interface ChannelDetailViewProps {
  channel: ChannelConfig;
  agentId: string;
  status?: ImBotStatus;
  onChange: (updated: ChannelConfig) => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
}

type ReVerifyState = 'idle' | 'loading' | 'valid' | 'invalid';

function maskToken(token: string): string {
  if (!token || token.length <= 8) return token;
  const visible = token.slice(-8);
  const dots = '\u2022'.repeat(Math.min(token.length - 8, 24));
  return dots + visible;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return '<1m';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

// ── Accordion wrapper ──
function AccordionSection({
  title,
  badge,
  badgeColor = 'var(--success)',
  expanded,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  badgeColor?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--paper)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-5 transition-colors hover:bg-[var(--hover)]"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-[var(--ink)]">{title}</h3>
          {!expanded && badge && (
            <span className="text-[12px]" style={{ color: badgeColor }}>
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[var(--ink-tertiary)] transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
      </button>
      {expanded && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ── Platform icons ──
function PlatformIcon({ type }: { type: string }) {
  if (type === 'feishu') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: '#00b96b' }}>
        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
    );
  }
  if (type === 'dingtalk') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: '#2d6ef5' }}>
        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0088cc]">
      <Send className="h-4 w-4 text-white" />
    </div>
  );
}

const platformName = (type: string) => {
  if (type === 'feishu') return '飞书';
  if (type === 'dingtalk') return '钉钉';
  return 'Telegram';
};

export default function ChannelDetailView({
  channel,
  agentId,
  status,
  onChange,
  onDelete,
  onStart,
  onStop,
  onBack: _onBack,
}: ChannelDetailViewProps) {
  // Accordion states
  const hasCredentials = !!(channel.botToken || channel.feishuAppId || channel.dingtalkClientId);
  const hasUsers = (channel.allowedUsers?.length ?? 0) > 0;
  const hasGroupPerms = (channel.groupPermissions?.length ?? 0) > 0;
  const [credentialsExpanded, setCredentialsExpanded] = useState(!hasCredentials);
  const [bindingExpanded, setBindingExpanded] = useState(!hasUsers);
  const [groupPermsExpanded, setGroupPermsExpanded] = useState(hasGroupPerms);

  // Token verify (Telegram)
  const [tokenVisible, setTokenVisible] = useState(false);
  const [reVerifyState, setReVerifyState] = useState<ReVerifyState>('idle');
  const [reVerifyMsg, setReVerifyMsg] = useState('');

  // Feishu/DingTalk re-verify
  const [credVerifyState, setCredVerifyState] = useState<ReVerifyState>('idle');
  const [credVerifyMsg, setCredVerifyMsg] = useState('');

  // User management
  const [newUser, setNewUser] = useState('');

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isRunning = status?.status === 'online' || status?.status === 'connecting';

  const statusText = status?.status === 'online'
    ? '运行中'
    : status?.status === 'connecting'
      ? '连接中'
      : status?.status === 'error'
        ? '异常'
        : '已停止';
  const statusColor = status?.status === 'online'
    ? 'var(--success)'
    : status?.status === 'connecting'
      ? '#eab308'
      : status?.status === 'error'
        ? 'var(--error)'
        : 'var(--ink-tertiary)';
  const uptimeText = status && status.uptimeSeconds > 0
    ? formatUptime(status.uptimeSeconds)
    : undefined;
  const sessionCount = status?.activeSessions?.length ?? 0;

  // Group permissions from status (runtime) + config (persisted)
  const runtimeGroupPerms: GroupPermission[] = (status as { groupPermissions?: GroupPermission[] } | undefined)?.groupPermissions ?? [];
  const configGroupPerms: GroupPermission[] = channel.groupPermissions ?? [];
  // Merge: runtime has latest (pending + approved), config is the source of truth for approved
  const mergedGroupPerms: GroupPermission[] = runtimeGroupPerms.length > 0 ? runtimeGroupPerms : configGroupPerms;

  // ── Handlers ──

  const handleReVerifyTelegram = async () => {
    if (!channel.botToken) return;
    setReVerifyState('loading');
    setReVerifyMsg('');
    try {
      const username = await verifyToken('telegram', channel.botToken, channel.proxyUrl);
      onChange({ ...channel, name: username.replace('@', '') });
      setReVerifyState('valid');
      setReVerifyMsg(`已验证：${username}`);
    } catch (err) {
      setReVerifyState('invalid');
      setReVerifyMsg(err instanceof Error ? err.message : 'Token 验证失败');
    }
  };

  const handleReVerifyFeishu = async () => {
    if (!channel.feishuAppId || !channel.feishuAppSecret) return;
    setCredVerifyState('loading');
    setCredVerifyMsg('');
    try {
      const name = await verifyFeishuCredentials(channel.feishuAppId, channel.feishuAppSecret);
      onChange({ ...channel, name });
      setCredVerifyState('valid');
      setCredVerifyMsg(`已验证: ${name}`);
    } catch (err) {
      setCredVerifyState('invalid');
      setCredVerifyMsg(err instanceof Error ? err.message : '凭证验证失败');
    }
  };

  const handleReVerifyDingtalk = async () => {
    if (!channel.dingtalkClientId || !channel.dingtalkClientSecret) return;
    setCredVerifyState('loading');
    setCredVerifyMsg('');
    try {
      const name = await verifyDingtalkCredentials(channel.dingtalkClientId, channel.dingtalkClientSecret);
      onChange({ ...channel, name });
      setCredVerifyState('valid');
      setCredVerifyMsg(`已验证: ${name}`);
    } catch (err) {
      setCredVerifyState('invalid');
      setCredVerifyMsg(err instanceof Error ? err.message : '凭证验证失败');
    }
  };

  const handleAddUser = useCallback(() => {
    const trimmed = newUser.trim();
    if (!trimmed) return;
    const current = channel.allowedUsers ?? [];
    if (current.includes(trimmed)) { setNewUser(''); return; }
    onChange({ ...channel, allowedUsers: [...current, trimmed] });
    setNewUser('');
  }, [newUser, channel, onChange]);

  const handleRemoveUser = useCallback(
    (user: string) => {
      onChange({ ...channel, allowedUsers: (channel.allowedUsers ?? []).filter((u) => u !== user) });
    },
    [channel, onChange],
  );

  const handleDraftToggle = useCallback(() => {
    onChange({ ...channel, telegramUseDraft: !(channel.telegramUseDraft ?? true) });
  }, [channel, onChange]);

  const handleGroupApprove = useCallback(async (groupId: string) => {
    await approveGroupPermission(agentId, channel.id, groupId);
    // Update local config
    const updated = (channel.groupPermissions ?? []).map((g) =>
      g.groupId === groupId ? { ...g, status: 'approved' as const } : g,
    );
    onChange({ ...channel, groupPermissions: updated });
  }, [agentId, channel, onChange]);

  const handleGroupReject = useCallback(async (groupId: string) => {
    await rejectGroupPermission(agentId, channel.id, groupId);
    const updated = (channel.groupPermissions ?? []).filter((g) => g.groupId !== groupId);
    onChange({ ...channel, groupPermissions: updated });
  }, [agentId, channel, onChange]);

  const handleGroupRemove = useCallback(async (groupId: string) => {
    await removeGroupPermission(agentId, channel.id, groupId);
    const updated = (channel.groupPermissions ?? []).filter((g) => g.groupId !== groupId);
    onChange({ ...channel, groupPermissions: updated });
  }, [agentId, channel, onChange]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlatformIcon type={channel.type} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold text-[var(--ink)]">
                {channel.name ? (channel.type === 'telegram' ? `@${channel.name}` : channel.name) : platformName(channel.type)}
              </h2>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
                <span className="text-[12px]" style={{ color: statusColor }}>{statusText}</span>
              </div>
              {uptimeText && (
                <span className="text-[12px] text-[var(--ink-tertiary)]">{uptimeText}</span>
              )}
              {sessionCount > 0 && (
                <span className="text-[12px] text-[var(--ink-tertiary)]">{sessionCount} 个会话</span>
              )}
            </div>
            <p className="text-[12px] text-[var(--ink-tertiary)]">{platformName(channel.type)} Channel</p>
          </div>
        </div>

        {/* Start / Stop */}
        <button
          onClick={isRunning ? onStop : onStart}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-medium transition-colors ${
            isRunning
              ? 'bg-[var(--error-bg)] text-[var(--error)] hover:brightness-95'
              : 'bg-[var(--accent)] text-white hover:opacity-90'
          }`}
        >
          {isRunning ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          {isRunning ? '停止' : '启动'}
        </button>
      </div>

      {/* Error / Buffer messages */}
      {status?.errorMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/5 px-4 py-3">
          <p className="text-[13px] text-[var(--error)]">{status.errorMessage}</p>
        </div>
      )}
      {status && status.bufferedMessages > 0 && (
        <p className="text-[12px] text-[var(--ink-tertiary)]">
          {status.bufferedMessages} 条消息已缓冲（等待 Sidecar 恢复后重放）
        </p>
      )}

      {/* ══ Section 1: Credentials ══ */}
      <AccordionSection
        title={channel.type === 'telegram' ? 'Telegram Bot' : channel.type === 'feishu' ? '飞书应用凭证' : '钉钉应用凭证'}
        badge={hasCredentials ? (credVerifyState === 'valid' || reVerifyState === 'valid' ? '已验证' : channel.name || '已配置') : undefined}
        expanded={credentialsExpanded}
        onToggle={() => setCredentialsExpanded(!credentialsExpanded)}
      >
        {/* Telegram credentials */}
        {channel.type === 'telegram' && (
          <div className="space-y-3">
            <label className="text-[13px] font-medium text-[var(--ink)]">Bot Token</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-[13px] text-[var(--ink-secondary)] select-all">
                {tokenVisible ? (channel.botToken ?? '') : maskToken(channel.botToken ?? '')}
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
                onClick={() => void handleReVerifyTelegram()}
                disabled={reVerifyState === 'loading' || !channel.botToken}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-2 text-[13px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
                title="重新验证"
              >
                {reVerifyState === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                验证
              </button>
            </div>
            {reVerifyState === 'valid' && (
              <p className="flex items-center gap-1 text-[12px] text-[var(--success)]">
                <Check className="h-3.5 w-3.5" />{reVerifyMsg}
              </p>
            )}
            {reVerifyState === 'invalid' && (
              <p className="text-[12px] text-[var(--error)]">{reVerifyMsg}</p>
            )}
          </div>
        )}

        {/* Feishu credentials */}
        {channel.type === 'feishu' && (
          <div className="space-y-4">
            <FeishuCredentialInput
              appId={channel.feishuAppId ?? ''}
              appSecret={channel.feishuAppSecret ?? ''}
              onAppIdChange={(v) => onChange({ ...channel, feishuAppId: v })}
              onAppSecretChange={(v) => onChange({ ...channel, feishuAppSecret: v })}
              verifyStatus={credVerifyState === 'loading' ? 'verifying' : credVerifyState === 'valid' ? 'valid' : credVerifyState === 'invalid' ? 'invalid' : 'idle'}
              botName={channel.name}
              showGuide={false}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleReVerifyFeishu()}
                disabled={credVerifyState === 'loading' || !channel.feishuAppId || !channel.feishuAppSecret}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
              >
                {credVerifyState === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                重新验证
              </button>
              {credVerifyState === 'valid' && <span className="flex items-center gap-1 text-[12px] text-[var(--success)]"><Check className="h-3.5 w-3.5" />{credVerifyMsg}</span>}
              {credVerifyState === 'invalid' && <span className="text-[12px] text-[var(--error)]">{credVerifyMsg}</span>}
            </div>
          </div>
        )}

        {/* DingTalk credentials */}
        {channel.type === 'dingtalk' && (
          <div className="space-y-4">
            <DingtalkCredentialInput
              clientId={channel.dingtalkClientId ?? ''}
              clientSecret={channel.dingtalkClientSecret ?? ''}
              onClientIdChange={(v) => onChange({ ...channel, dingtalkClientId: v })}
              onClientSecretChange={(v) => onChange({ ...channel, dingtalkClientSecret: v })}
              verifyStatus={credVerifyState === 'loading' ? 'verifying' : credVerifyState === 'valid' ? 'valid' : credVerifyState === 'invalid' ? 'invalid' : 'idle'}
              botName={channel.name}
              showGuide={false}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleReVerifyDingtalk()}
                disabled={credVerifyState === 'loading' || !channel.dingtalkClientId || !channel.dingtalkClientSecret}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
              >
                {credVerifyState === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                重新验证
              </button>
              {credVerifyState === 'valid' && <span className="flex items-center gap-1 text-[12px] text-[var(--success)]"><Check className="h-3.5 w-3.5" />{credVerifyMsg}</span>}
              {credVerifyState === 'invalid' && <span className="text-[12px] text-[var(--error)]">{credVerifyMsg}</span>}
            </div>
          </div>
        )}
      </AccordionSection>

      {/* ══ Section 2: User Binding ══ */}
      <AccordionSection
        title="用户白名单"
        badge={hasUsers ? `${channel.allowedUsers!.length} 个用户` : undefined}
        badgeColor="var(--ink-tertiary)"
        expanded={bindingExpanded}
        onToggle={() => setBindingExpanded(!bindingExpanded)}
      >
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--ink-tertiary)]">
            {channel.type === 'telegram'
              ? '添加允许使用的 Telegram User ID（数字 ID）'
              : '添加允许使用的用户 ID'}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
              placeholder={channel.type === 'telegram' ? 'Telegram User ID' : '用户 ID'}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              onClick={handleAddUser}
              disabled={!newUser.trim()}
              className="rounded-lg bg-[var(--accent)] p-2 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {hasUsers ? (
            <div className="flex flex-wrap gap-2">
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
            <p className="text-[12px] text-[var(--ink-tertiary)]">未设置白名单，允许所有用户</p>
          )}
        </div>
      </AccordionSection>

      {/* ══ Section 3: Group Permissions (Feishu + DingTalk) ══ */}
      {(channel.type === 'feishu' || channel.type === 'dingtalk') && (
        <AccordionSection
          title="群聊权限"
          badge={mergedGroupPerms.length > 0 ? `${mergedGroupPerms.filter((g) => g.status === 'pending').length} 待审核` : undefined}
          badgeColor="#eab308"
          expanded={groupPermsExpanded}
          onToggle={() => setGroupPermsExpanded(!groupPermsExpanded)}
        >
          <GroupPermissionList
            permissions={mergedGroupPerms}
            onApprove={handleGroupApprove}
            onReject={handleGroupReject}
            onRemove={handleGroupRemove}
          />
        </AccordionSection>
      )}

      {/* ══ Section 4: Draft Streaming (Telegram only) ══ */}
      {channel.type === 'telegram' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium text-[var(--ink)]">Draft 流式模式</p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-tertiary)]">
                使用 sendMessageDraft 实现打字机效果，默认开启。修改后需重启 Channel 生效。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={channel.telegramUseDraft ?? true}
              onClick={handleDraftToggle}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                (channel.telegramUseDraft ?? true) ? 'bg-[var(--accent)]' : 'bg-[var(--ink-tertiary)]/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  (channel.telegramUseDraft ?? true) ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* ══ Section 5: Proxy URL (Telegram only) ══ */}
      {channel.type === 'telegram' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5">
          <div className="space-y-2">
            <label className="text-[14px] font-medium text-[var(--ink)]">代理地址</label>
            <input
              type="text"
              value={channel.proxyUrl ?? ''}
              onChange={(e) => onChange({ ...channel, proxyUrl: e.target.value || undefined })}
              placeholder="http://127.0.0.1:7890"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
            />
            <p className="text-[12px] text-[var(--ink-tertiary)]">
              Telegram API 在中国大陆被屏蔽，需设置 HTTP/SOCKS5 代理。修改后需重启 Channel 生效。
            </p>
          </div>
        </div>
      )}

      {/* ══ Section 6: Danger Zone ══ */}
      <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error-bg)]/50 p-5">
        <h3 className="mb-3 text-[14px] font-semibold text-[var(--error)]">危险操作</h3>
        {showDeleteConfirm ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onDelete}
              className="flex items-center gap-2 rounded-lg bg-[var(--error)] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <Trash2 className="h-4 w-4" />
              确认删除
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)]"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--error-bg)] px-4 py-2 text-[14px] font-medium text-[var(--error)] transition-colors hover:brightness-95"
          >
            <Trash2 className="h-4 w-4" />
            删除 Channel
          </button>
        )}
      </div>
    </div>
  );
}
