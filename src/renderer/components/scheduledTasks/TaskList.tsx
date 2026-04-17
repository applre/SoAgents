import { useState, useCallback } from 'react';
import { Plus, MoreVertical, Play, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { useScheduledTasks } from '../../context/ScheduledTaskContext';
import { formatScheduleLabel } from './scheduleUtils';
import DeleteConfirmModal from './DeleteConfirmModal';
import type { ScheduledTask } from '../../../shared/types/scheduledTask';

export default function TaskList() {
  const { tasks, loading, setViewMode, setSelectedTaskId, toggleTask, runManually, deleteTask, loadTasks } = useScheduledTasks();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState<ScheduledTask | null>(null);

  const handleOpenDetail = useCallback((task: ScheduledTask) => {
    setSelectedTaskId(task.id);
    setViewMode('detail');
  }, [setSelectedTaskId, setViewMode]);

  const handleToggle = useCallback(async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    try {
      await toggleTask(taskId);
      await loadTasks();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  }, [toggleTask, loadTasks]);

  const handleRunManually = useCallback(async (taskId: string) => {
    setMenuOpenId(null);
    try {
      await runManually(taskId);
    } catch (err) {
      console.error('Failed to run task manually:', err);
    }
  }, [runManually]);

  const handleEdit = useCallback((task: ScheduledTask) => {
    setMenuOpenId(null);
    setSelectedTaskId(task.id);
    setViewMode('edit');
  }, [setSelectedTaskId, setViewMode]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTask) return;
    try {
      await deleteTask(deletingTask.id);
      await loadTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
    setDeletingTask(null);
  }, [deletingTask, deleteTask, loadTasks]);

  const formatNextRun = useCallback((ms: number): string => {
    const dt = new Date(ms);
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeStr = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    if (dt.toDateString() === now.toDateString()) return timeStr;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dt.toDateString() === tomorrow.toDateString()) return `明天 ${timeStr}`;
    return `${pad(dt.getMonth() + 1)}/${pad(dt.getDate())} ${timeStr}`;
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--ink-tertiary)' }} />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-[15px]" style={{ color: 'var(--ink-tertiary)' }}>暂无定时任务</p>
        <button
          onClick={() => setViewMode('create')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium text-white transition-colors hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} />
          新建任务
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {menuOpenId && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
      )}
      <div className="flex flex-col gap-2">
        {tasks.map((task) => {
          const isRunning = task.state.lastStatus === 'running';
          const isMenuOpen = menuOpenId === task.id;

          return (
            <div
              key={task.id}
              onClick={() => handleOpenDetail(task)}
              className="group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--hover)]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              {/* 状态指示器 */}
              <div className="shrink-0">
                {isRunning ? (
                  <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                ) : (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: task.enabled
                        ? (task.state.lastStatus === 'error' ? 'var(--error)' : 'var(--success)')
                        : 'var(--ink-tertiary)',
                    }}
                  />
                )}
              </div>

              {/* 任务信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-[14px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {task.name}
                  </p>
                  {task.runMode === 'single_session' && (
                    <span
                      className="shrink-0 text-[11px] px-1.5 py-0.5 rounded-full"
                      style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
                    >
                      持续会话
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[12px] mt-0.5" style={{ color: 'var(--ink-tertiary)' }}>
                  <span>{task.workingDirectory.split('/').filter(Boolean).pop() ?? task.workingDirectory}</span>
                  <span>·</span>
                  <span>{formatScheduleLabel(task.schedule)}</span>
                  {task.enabled && task.state.nextRunAtMs && (
                    <>
                      <span>·</span>
                      <span>下次: {formatNextRun(task.state.nextRunAtMs)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Toggle 开关 */}
              <button
                onClick={(e) => handleToggle(e, task.id)}
                className="shrink-0 relative w-9 h-5 rounded-full transition-colors"
                style={{ background: task.enabled ? 'var(--accent)' : 'var(--border)' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-transform shadow-sm"
                  style={{ left: task.enabled ? 18 : 2, background: 'var(--paper)' }}
                />
              </button>

              {/* 更多菜单 */}
              <div className="relative shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : task.id); }}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                    isMenuOpen
                      ? 'bg-[var(--hover)]'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-[var(--hover)]'
                  }`}
                  style={{ color: 'var(--ink-secondary)' }}
                >
                  <MoreVertical size={14} />
                </button>

                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-xl border py-1"
                    style={{ background: 'var(--paper)', borderColor: 'var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(task); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--hover)] transition-colors"
                      style={{ color: 'var(--ink)' }}
                    >
                      <Edit2 size={14} />
                      编辑
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRunManually(task.id); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--hover)] transition-colors"
                      style={{ color: 'var(--ink)' }}
                    >
                      <Play size={14} />
                      手动执行
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setDeletingTask(task); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--hover)] transition-colors"
                      style={{ color: 'var(--error)' }}
                    >
                      <Trash2 size={14} />
                      删除
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {deletingTask && (
        <DeleteConfirmModal
          taskName={deletingTask.name}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingTask(null)}
        />
      )}
    </div>
  );
}
