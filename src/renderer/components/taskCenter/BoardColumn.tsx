import React, { memo } from 'react';
import type { SessionMetadata, SessionStatus } from '../../../shared/types/session';
import type { SessionTag } from '@/hooks/useTaskCenterData';
import { SessionCard } from './SessionCard';

interface BoardColumnProps {
  title: string;
  sessions: SessionMetadata[];
  statusMap: Map<string, SessionStatus>;
  tagsMap: Map<string, SessionTag[]>;
  showWorkspace: boolean;
  statusDot?: { color: string; hollow?: boolean };
  onSessionClick: (agentDir: string, sessionId: string) => void;
}

export const BoardColumn = memo(function BoardColumn({
  title,
  sessions,
  statusMap,
  tagsMap,
  showWorkspace,
  statusDot,
  onSessionClick,
}: BoardColumnProps) {
  return (
    <div className="w-[280px] min-w-[280px] flex flex-col max-h-full flex-shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 mb-2 text-[13px] font-semibold text-[var(--ink)]">
        {statusDot && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: statusDot.hollow ? 'transparent' : statusDot.color,
              border: statusDot.hollow ? `1.5px solid ${statusDot.color}` : 'none',
            }}
          />
        )}
        <span>{title}</span>
        <span className="text-[11px] font-normal text-[var(--ink-tertiary)] bg-[var(--hover)] px-1.5 py-0.5 rounded-full">
          {sessions.length}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pb-2 px-1">
        {sessions.length === 0 ? (
          <div className="text-center text-[12px] text-[var(--ink-tertiary)] py-5">
            暂无对话
          </div>
        ) : (
          sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              status={statusMap.get(session.id) ?? 'inactive'}
              tags={tagsMap.get(session.id)}
              showWorkspace={showWorkspace}
              onClick={() => onSessionClick(session.agentDir, session.id)}
            />
          ))
        )}
      </div>
    </div>
  );
});
