import { useEffect } from 'react';
import { useScheduledTasks } from '../../context/ScheduledTaskContext';
import { formatTimestamp, formatDuration } from './scheduleUtils';

const STATUS_LABELS: Record<string, string> = {
  success: '成功',
  error: '失败',
  running: '运行中',
};

export default function TaskRunHistory() {
  const { selectedTask, runs, loadRuns } = useScheduledTasks();

  useEffect(() => {
    if (selectedTask) {
      loadRuns(selectedTask.id);
    }
  }, [selectedTask, loadRuns]);

  if (!selectedTask) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h3 className="text-[16px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>
        {selectedTask.name} - 运行历史
      </h3>

      {runs.length === 0 ? (
        <p className="text-[14px] text-center py-8" style={{ color: 'var(--ink-tertiary)' }}>
          暂无运行记录
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px]" style={{ color: 'var(--ink)' }}>
                    {formatTimestamp(run.startedAtMs)}
                  </span>
                  {run.durationMs != null && (
                    <span className="text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>
                      {formatDuration(run.durationMs)}
                    </span>
                  )}
                </div>
                {run.error && (
                  <p className="text-[12px] mt-1 truncate" style={{ color: 'var(--error)' }}>
                    {run.error}
                  </p>
                )}
              </div>
              <span className="text-[12px] shrink-0" style={{ color: 'var(--ink-tertiary)' }}>
                {run.trigger === 'manual' ? '手动' : '定时'}
              </span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
