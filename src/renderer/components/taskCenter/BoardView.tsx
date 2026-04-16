import React, { useMemo, memo } from 'react';
import type { SessionMetadata, SessionStatus } from '../../../shared/types/session';
import type { SessionTag } from '@/hooks/useTaskCenterData';
import { computeSessionStatus, STATUS_CONFIG } from '@/utils/sessionStatus';
import { BoardColumn } from './BoardColumn';

export type GroupBy = 'workspace' | 'status' | 'time';

interface BoardViewProps {
  sessions: SessionMetadata[];
  groupBy: GroupBy;
  activeSidecarSessionIds: Set<string>;
  sessionTagsMap: Map<string, SessionTag[]>;
  onSessionClick: (agentDir: string, sessionId: string) => void;
}

interface ColumnDef {
  key: string;
  title: string;
  sessions: SessionMetadata[];
  statusDot?: { color: string; hollow?: boolean };
}

function sortByLastActive(sessions: SessionMetadata[]): SessionMetadata[] {
  return [...sessions].sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
  );
}

function groupByWorkspace(sessions: SessionMetadata[]): ColumnDef[] {
  const groups = new Map<string, SessionMetadata[]>();
  for (const s of sessions) {
    const key = s.agentDir;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return Array.from(groups.entries())
    .map(([dir, items]) => ({
      key: dir,
      title: dir.split('/').filter(Boolean).pop() ?? dir,
      sessions: sortByLastActive(items),
    }))
    .sort((a, b) => {
      const aTime = new Date(a.sessions[0]?.lastActiveAt ?? 0).getTime();
      const bTime = new Date(b.sessions[0]?.lastActiveAt ?? 0).getTime();
      return bTime - aTime;
    });
}

function groupByStatusFn(sessions: SessionMetadata[], statusMap: Map<string, SessionStatus>): ColumnDef[] {
  const order: SessionStatus[] = ['active', 'approval', 'inactive', 'archived'];
  const groups: Record<string, SessionMetadata[]> = { active: [], approval: [], inactive: [], archived: [] };
  for (const s of sessions) {
    const status = statusMap.get(s.id) ?? 'inactive';
    groups[status].push(s);
  }
  return order.map(status => {
    const cfg = STATUS_CONFIG[status];
    return {
      key: status,
      title: cfg.label,
      sessions: sortByLastActive(groups[status]),
      statusDot: {
        color: status === 'inactive' ? 'var(--ink-tertiary)' : cfg.color,
        hollow: status === 'inactive',
      },
    };
  });
}

function groupByTimeFn(sessions: SessionMetadata[]): ColumnDef[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const dayOfWeek = todayStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(todayStart.getTime() - mondayOffset * 86400000);

  const buckets: { key: string; title: string; sessions: SessionMetadata[] }[] = [
    { key: 'today', title: '今天', sessions: [] },
    { key: 'yesterday', title: '昨天', sessions: [] },
    { key: 'thisWeek', title: '本周', sessions: [] },
    { key: 'earlier', title: '更早', sessions: [] },
  ];

  for (const s of sessions) {
    const t = new Date(s.lastActiveAt);
    if (t >= todayStart) buckets[0].sessions.push(s);
    else if (t >= yesterdayStart) buckets[1].sessions.push(s);
    else if (t >= weekStart) buckets[2].sessions.push(s);
    else buckets[3].sessions.push(s);
  }

  return buckets
    .filter(b => b.sessions.length > 0)
    .map(b => ({ ...b, sessions: sortByLastActive(b.sessions) }));
}

export const BoardView = memo(function BoardView({
  sessions,
  groupBy,
  activeSidecarSessionIds,
  sessionTagsMap,
  onSessionClick,
}: BoardViewProps) {
  const statusMap = useMemo(() => {
    const map = new Map<string, SessionStatus>();
    for (const s of sessions) {
      map.set(s.id, computeSessionStatus(s, activeSidecarSessionIds));
    }
    return map;
  }, [sessions, activeSidecarSessionIds]);

  const columns = useMemo((): ColumnDef[] => {
    switch (groupBy) {
      case 'workspace': return groupByWorkspace(sessions);
      case 'status': return groupByStatusFn(sessions, statusMap);
      case 'time': return groupByTimeFn(sessions);
    }
  }, [sessions, groupBy, statusMap]);

  const showWorkspace = groupBy !== 'workspace';

  return (
    <div className="flex-1 flex gap-3 p-4 overflow-x-auto min-h-0 bg-[var(--surface)]">
      {columns.map(col => (
        <BoardColumn
          key={col.key}
          title={col.title}
          sessions={col.sessions}
          statusMap={statusMap}
          tagsMap={sessionTagsMap}
          showWorkspace={showWorkspace}
          statusDot={col.statusDot}
          onSessionClick={onSessionClick}
        />
      ))}
    </div>
  );
});
