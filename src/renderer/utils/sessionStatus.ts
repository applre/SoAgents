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
  active:   { label: 'Active',   color: 'var(--success)' },
  approval: { label: 'Approval', color: 'var(--approval)' },
  inactive: { label: 'Inactive', color: 'transparent' },
  archived: { label: 'Archived', color: 'var(--ink-tertiary)' },
};
