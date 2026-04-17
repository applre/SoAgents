import React, { memo } from 'react';
import type { SessionMetadata, SessionStatus } from '../../../shared/types/session';
import type { SessionTag } from '@/hooks/useTaskCenterData';
import { STATUS_CONFIG } from '@/utils/sessionStatus';
import { relativeTimeCompact } from '@/utils/formatTime';

interface SessionCardProps {
  session: SessionMetadata;
  status: SessionStatus;
  tags?: SessionTag[];
  showWorkspace?: boolean;
  onClick: () => void;
}

export const SessionCard = memo(function SessionCard({
  session,
  status,
  tags,
  showWorkspace,
  onClick,
}: SessionCardProps) {
  const statusCfg = STATUS_CONFIG[status];
  const isInactive = status === 'inactive';
  const messageCount = session.stats?.messageCount ?? 0;
  const timeStr = relativeTimeCompact(session.lastActiveAt);

  const workspaceName = showWorkspace
    ? session.agentDir.split('/').filter(Boolean).pop() ?? ''
    : '';

  return (
    <div
      className="bg-[var(--paper)] border border-[var(--border)] rounded-lg px-3.5 py-3 cursor-pointer transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:border-[var(--ink-tertiary)]"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {status === 'active' ? (
          // Active: 绿色脉冲动画（与左侧栏/tab 栏一致）
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-[var(--running-light)] opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--running)]" />
          </span>
        ) : (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: isInactive ? 'transparent' : statusCfg.color,
              border: isInactive ? '1.5px solid var(--ink-tertiary)' : 'none',
            }}
          />
        )}
        <span className="text-[13px] font-medium truncate flex-1 text-[var(--ink)]">
          {session.title || '未命名对话'}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--ink-tertiary)]">
        <div className="flex items-center gap-2.5">
          <span>{timeStr}</span>
          <span>{messageCount}条</span>
        </div>
        <div className="flex items-center gap-2">
          {tags?.some(t => t.type === 'cron') && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] font-medium">
              定时
            </span>
          )}
          {showWorkspace && workspaceName && (
            <span className="text-[10px]">{workspaceName}</span>
          )}
        </div>
      </div>
    </div>
  );
});
