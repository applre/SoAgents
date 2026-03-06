import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { useScheduledTasks } from '../../context/ScheduledTaskContext';
import { formatTimestamp, formatDuration } from './scheduleUtils';

const STATUS_LABELS: Record<string, string> = {
  success: '成功',
  error: '失败',
  running: '运行中',
};

interface Props {
  onNavigateToSession?: (agentDir: string, sessionId: string) => void;
}

export default function AllRunsHistory({ onNavigateToSession }: Props) {
  const { allRuns, loadAllRuns, tasks } = useScheduledTasks();

  useEffect(() => {
    loadAllRuns(0);
  }, [loadAllRuns]);

  if (allRuns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[14px]" style={{ color: 'var(--ink-tertiary)' }}>暂无运行记录</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-col gap-1">
        {allRuns.map((run) => (
          <div
            key={run.id}
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {/* 任务名 */}
            <span className="text-[13px] font-medium shrink-0 w-[120px] truncate" style={{ color: 'var(--ink)' }}>
              {run.taskName}
            </span>

            {/* 时间 + 耗时 */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-[13px]" style={{ color: 'var(--ink)' }}>
                {formatTimestamp(run.startedAtMs)}
              </span>
              {run.durationMs != null && (
                <span className="text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>
                  {formatDuration(run.durationMs)}
                </span>
              )}
            </div>

            {/* 状态 */}
            <span
              className="text-[12px] font-medium shrink-0"
              style={{
                color: run.status === 'success' ? 'var(--success)'
                  : run.status === 'error' ? 'var(--error)'
                  : 'var(--accent)',
              }}
            >
              {STATUS_LABELS[run.status]}
            </span>
            {run.sessionId && onNavigateToSession && (() => {
              const task = tasks.find(t => t.id === run.taskId);
              return task ? (
                <button
                  onClick={() => onNavigateToSession(task.workingDirectory, run.sessionId!)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors hover:bg-[var(--hover)]"
                  style={{ color: 'var(--accent)' }}
                  title="查看对话"
                >
                  <ExternalLink size={11} />
                  查看
                </button>
              ) : null;
            })()}
          </div>
        ))}
      </div>

      {/* 加载更多 */}
      {allRuns.length >= 50 && allRuns.length % 50 === 0 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => loadAllRuns(allRuns.length)}
            className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--hover)]"
            style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            加载更多
          </button>
        </div>
      )}
    </div>
  );
}
