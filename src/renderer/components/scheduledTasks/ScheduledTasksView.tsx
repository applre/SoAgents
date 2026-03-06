import { useState, useCallback } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { useScheduledTasks } from '../../context/ScheduledTaskContext';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import TaskDetail from './TaskDetail';
import AllRunsHistory from './AllRunsHistory';

interface Props {
  onNavigateToSession?: (agentDir: string, sessionId: string) => void;
}

type TabKey = 'tasks' | 'history';

export default function ScheduledTasksView({ onNavigateToSession }: Props) {
  const { viewMode, setViewMode, selectedTask, setSelectedTaskId } = useScheduledTasks();
  const [activeTab, setActiveTab] = useState<TabKey>('tasks');

  const handleBack = useCallback(() => {
    if (viewMode === 'edit') {
      setViewMode('detail');
    } else if (viewMode === 'detail' || viewMode === 'create') {
      setSelectedTaskId(null);
      setViewMode('list');
    }
  }, [viewMode, setViewMode, setSelectedTaskId]);

  const showBackButton = viewMode !== 'list';
  const showNewButton = viewMode === 'list' && activeTab === 'tasks';

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--paper)' }}>
      {/* 顶部栏 */}
      <div
        className="shrink-0 flex items-center justify-between px-6"
        style={{ height: 52, borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button
              onClick={handleBack}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[var(--hover)]"
              style={{ color: 'var(--ink-secondary)' }}
            >
              <ChevronLeft size={18} />
            </button>
          )}

          {/* Tabs */}
          {viewMode === 'list' && (
            <div className="flex gap-1">
              {([['tasks', '任务'], ['history', '历史']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="px-3 py-1.5 text-[14px] font-medium transition-colors"
                  style={{
                    color: activeTab === key ? 'var(--ink)' : 'var(--ink-tertiary)',
                    borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {viewMode !== 'list' && (
            <span className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
              {viewMode === 'create' ? '新建任务' : viewMode === 'edit' ? '编辑任务' : selectedTask?.name ?? '任务详情'}
            </span>
          )}
        </div>

        {showNewButton && (
          <button
            onClick={() => setViewMode('create')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={14} />
            新建任务
          </button>
        )}
      </div>

      {/* 内容区 */}
      {viewMode === 'list' && activeTab === 'tasks' && <TaskList />}
      {viewMode === 'list' && activeTab === 'history' && <AllRunsHistory onNavigateToSession={onNavigateToSession} />}
      {viewMode === 'create' && <TaskForm />}
      {viewMode === 'detail' && <TaskDetail onNavigateToSession={onNavigateToSession} />}
      {viewMode === 'edit' && <TaskForm editingTask={selectedTask} />}
    </div>
  );
}
