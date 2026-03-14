import { useEffect, useState, useCallback } from 'react';
import { Edit2, Play, Trash2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useScheduledTasks } from '../../context/ScheduledTaskContext';
import { formatScheduleLabel, formatTimestamp, formatDuration } from './scheduleUtils';
import DeleteConfirmModal from './DeleteConfirmModal';

const STATUS_LABELS: Record<string, string> = {
  success: '成功',
  error: '失败',
  running: '运行中',
};

interface Props {
  onNavigateToSession?: (agentDir: string, sessionId: string) => void;
}

export default function TaskDetail({ onNavigateToSession }: Props) {
  const { selectedTask, setViewMode, runs, loadRuns, deleteTask, runManually, loadTasks } = useScheduledTasks();
  const [deletingTask, setDeletingTask] = useState(false);

  useEffect(() => {
    if (selectedTask) {
      loadRuns(selectedTask.id);
    }
  }, [selectedTask, loadRuns]);

  const handleDelete = useCallback(async () => {
    if (!selectedTask) return;
    try {
      await deleteTask(selectedTask.id);
      await loadTasks();
      setViewMode('list');
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
    setDeletingTask(false);
  }, [selectedTask, deleteTask, loadTasks, setViewMode]);

  const handleRunManually = useCallback(async () => {
    if (!selectedTask) return;
    try {
      await runManually(selectedTask.id);
    } catch (err) {
      console.error('Failed to run task manually:', err);
    }
  }, [selectedTask, runManually]);

  if (!selectedTask) return null;

  const { state } = selectedTask;
  const recentRuns = runs.slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* 顶部：任务名 + 操作 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>
          {selectedTask.name}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('edit')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--hover)]"
            style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            <Edit2 size={14} />
            编辑
          </button>
          <button
            onClick={handleRunManually}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Play size={14} />
            手动执行
          </button>
          <button
            onClick={() => setDeletingTask(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors hover:bg-red-50"
            style={{ border: '1px solid var(--border)', color: 'var(--error)' }}
          >
            <Trash2 size={14} />
            删除
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 max-w-[640px]">
        {/* Prompt 卡片 */}
        <div className="rounded-lg p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: 'var(--ink-secondary)' }}>Prompt</h3>
          <pre className="text-[14px] whitespace-pre-wrap" style={{ color: 'var(--ink)', fontFamily: 'inherit' }}>
            {selectedTask.prompt}
          </pre>
        </div>

        {/* 配置卡片 */}
        <div className="rounded-lg p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: 'var(--ink-secondary)' }}>配置</h3>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>调度</span>
              <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                {formatScheduleLabel(selectedTask.schedule)}
              </span>
            </div>
            {selectedTask.schedule.type === 'cron' && selectedTask.schedule.timezone && (
              <div className="flex justify-between">
                <span className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>时区</span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                  {selectedTask.schedule.timezone}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>工作目录</span>
              <span className="text-[13px] font-medium truncate ml-4" style={{ color: 'var(--ink)' }}>
                {selectedTask.workingDirectory}
              </span>
            </div>
          </div>
        </div>

        {/* 状态卡片 */}
        <div className="rounded-lg p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: 'var(--ink-secondary)' }}>状态</h3>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>启用状态</span>
              <span
                className="text-[13px] font-medium"
                style={{ color: selectedTask.enabled ? 'var(--success)' : 'var(--ink-tertiary)' }}
              >
                {selectedTask.enabled ? '已启用' : '已禁用'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>下次执行</span>
              <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                {state.nextRunAtMs ? formatTimestamp(state.nextRunAtMs) : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>上次执行</span>
              <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                {state.lastRunAtMs ? formatTimestamp(state.lastRunAtMs) : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>上次状态</span>
              <span
                className="text-[13px] font-medium"
                style={{
                  color: state.lastStatus === 'success' ? 'var(--success)'
                    : state.lastStatus === 'error' ? 'var(--error)'
                    : state.lastStatus === 'running' ? 'var(--accent)'
                    : 'var(--ink-tertiary)',
                }}
              >
                {state.lastStatus ? STATUS_LABELS[state.lastStatus] : '-'}
              </span>
            </div>
            {state.consecutiveErrors >= 3 && (
              <div
                className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg"
                style={{ background: 'var(--error)', color: 'white' }}
              >
                <AlertTriangle size={14} />
                <span className="text-[13px] font-medium">连续失败 {state.consecutiveErrors} 次</span>
              </div>
            )}
            {state.consecutiveErrors > 0 && state.consecutiveErrors < 3 && (
              <div className="flex justify-between">
                <span className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>连续错误</span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--error)' }}>
                  {state.consecutiveErrors} 次
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 最近运行记录 */}
        <div className="rounded-lg p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: 'var(--ink-secondary)' }}>最近运行</h3>
          {recentRuns.length === 0 ? (
            <p className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>暂无运行记录</p>
          ) : (
            <div className="flex flex-col gap-1">
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between py-1.5">
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
                  <div className="flex items-center gap-2">
                    <span className="text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>
                      {run.trigger === 'manual' ? '手动' : '定时'}
                    </span>
                    <span
                      className="text-[12px] font-medium"
                      style={{
                        color: run.status === 'success' ? 'var(--success)'
                          : run.status === 'error' ? 'var(--error)'
                          : 'var(--accent)',
                      }}
                    >
                      {STATUS_LABELS[run.status]}
                    </span>
                    {run.sessionId && onNavigateToSession && (
                      <button
                        onClick={() => onNavigateToSession(selectedTask.workingDirectory, run.sessionId!)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors hover:bg-[var(--hover)]"
                        style={{ color: 'var(--accent)' }}
                        title="查看对话"
                      >
                        <ExternalLink size={11} />
                        查看
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {deletingTask && (
        <DeleteConfirmModal
          taskName={selectedTask.name}
          onConfirm={handleDelete}
          onCancel={() => setDeletingTask(false)}
        />
      )}
    </div>
  );
}
