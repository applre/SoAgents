import type { SessionMetadata, SessionStatus } from '../../shared/types/session';

export function computeSessionStatus(
  session: SessionMetadata,
  activeSidecarSessionIds: Set<string>
): SessionStatus {
  if (session.archived) return 'archived';
  if (activeSidecarSessionIds.has(session.id)) return 'active';
  if (
    session.lastMessageRole === 'assistant' &&
    (!session.lastViewedAt || new Date(session.lastViewedAt) < new Date(session.lastActiveAt))
  ) {
    return 'approval';
  }
  return 'inactive';
}

export const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string }> = {
  active:   { label: '运行中',  color: 'var(--running)' },
  approval: { label: '待确认',  color: 'var(--accent-warm)' },
  inactive: { label: '未活跃',  color: 'transparent' },
  archived: { label: '已归档',  color: 'var(--ink-tertiary)' },
};
