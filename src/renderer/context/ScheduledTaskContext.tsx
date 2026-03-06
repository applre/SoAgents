import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { ScheduledTask, ScheduledTaskRun } from '../../shared/types/scheduledTask';
import * as api from '../api/scheduledTaskApi';

type ViewMode = 'list' | 'create' | 'detail' | 'edit';

interface ScheduledTaskContextValue {
  tasks: ScheduledTask[];
  loading: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  selectedTask: ScheduledTask | null;
  runs: ScheduledTaskRun[];
  allRuns: ScheduledTaskRun[];
  loadTasks: () => Promise<void>;
  loadRuns: (taskId: string) => Promise<void>;
  loadAllRuns: (offset?: number) => Promise<void>;
  createTask: typeof api.createScheduledTask;
  updateTask: typeof api.updateScheduledTask;
  deleteTask: typeof api.deleteScheduledTask;
  toggleTask: typeof api.toggleScheduledTask;
  runManually: typeof api.runScheduledTaskManually;
}

const ScheduledTaskContext = createContext<ScheduledTaskContextValue | null>(null);

export function ScheduledTaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [runs, setRuns] = useState<ScheduledTaskRun[]>([]);
  const [allRuns, setAllRuns] = useState<ScheduledTaskRun[]>([]);

  const loadTasks = useCallback(async () => {
    try {
      const result = await api.listScheduledTasks();
      setTasks(result);
    } catch (err) {
      console.error('Failed to load scheduled tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async (taskId: string) => {
    try {
      const result = await api.listScheduledTaskRuns(taskId);
      setRuns(result);
    } catch (err) {
      console.error('Failed to load task runs:', err);
    }
  }, []);

  const loadAllRuns = useCallback(async (offset = 0) => {
    try {
      const result = await api.listAllScheduledTaskRuns(50, offset);
      if (offset === 0) {
        setAllRuns(result);
      } else {
        setAllRuns(prev => [...prev, ...result]);
      }
    } catch (err) {
      console.error('Failed to load all runs:', err);
    }
  }, []);

  const selectedTask = useMemo(
    () => tasks.find(t => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  useEffect(() => {
    loadTasks();

    const unlisteners: Array<() => void> = [];

    api.onTaskUpdated((task) => {
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === task.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = task;
          return next;
        }
        return [...prev, task];
      });
    }).then(fn => unlisteners.push(fn));

    api.onRunUpdated((run) => {
      setRuns(prev => {
        const idx = prev.findIndex(r => r.id === run.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = run;
          return next;
        }
        return [run, ...prev];
      });
      setAllRuns(prev => {
        const idx = prev.findIndex(r => r.id === run.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = run;
          return next;
        }
        return [run, ...prev];
      });
    }).then(fn => unlisteners.push(fn));

    api.onTaskDeleted(({ id }) => {
      setTasks(prev => prev.filter(t => t.id !== id));
    }).then(fn => unlisteners.push(fn));

    return () => {
      unlisteners.forEach(fn => fn());
    };
  }, [loadTasks]);

  // Handle selectedTaskId cleanup when task is deleted
  useEffect(() => {
    if (selectedTaskId && !tasks.find(t => t.id === selectedTaskId)) {
      setSelectedTaskId(null);
      setViewMode('list');
    }
  }, [tasks, selectedTaskId]);

  const value = useMemo(
    () => ({
      tasks, loading, viewMode, setViewMode,
      selectedTaskId, setSelectedTaskId, selectedTask,
      runs, allRuns,
      loadTasks, loadRuns, loadAllRuns,
      createTask: api.createScheduledTask,
      updateTask: api.updateScheduledTask,
      deleteTask: api.deleteScheduledTask,
      toggleTask: api.toggleScheduledTask,
      runManually: api.runScheduledTaskManually,
    }),
    [tasks, loading, viewMode, selectedTaskId, selectedTask, runs, allRuns, loadTasks, loadRuns, loadAllRuns]
  );

  return (
    <ScheduledTaskContext.Provider value={value}>
      {children}
    </ScheduledTaskContext.Provider>
  );
}

export function useScheduledTasks(): ScheduledTaskContextValue {
  const ctx = useContext(ScheduledTaskContext);
  if (!ctx) throw new Error('useScheduledTasks must be used within ScheduledTaskProvider');
  return ctx;
}
