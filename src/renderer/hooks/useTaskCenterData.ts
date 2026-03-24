/**
 * useTaskCenterData - 任务中心的数据 hook
 *
 * 负责：
 * 1. 拉取全部 sessions（跨工作区）
 * 2. 拉取全部定时任务
 * 3. 监听 Tauri 事件实时更新
 * 4. 计算 session tag（定时任务关联）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { globalApiGetJson } from '../api/apiFetch';
import { listScheduledTasks, listAllScheduledTaskRuns, onTaskUpdated, onTaskDeleted, onRunUpdated } from '../api/scheduledTaskApi';
import type { SessionMetadata } from '../../shared/types/session';
import type { ScheduledTask, ScheduledTaskRun } from '../../shared/types/scheduledTask';

export type SessionTag = { type: 'cron' };

export interface TaskCenterData {
  sessions: SessionMetadata[];
  scheduledTasks: ScheduledTask[];
  cronSessionIds: Set<string>;
  sessionTagsMap: Map<string, SessionTag[]>;
  isLoading: boolean;
  refresh: () => void;
  removeSession: (sessionId: string) => void;
}

export function useTaskCenterData(): TaskCenterData {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [taskRuns, setTaskRuns] = useState<ScheduledTaskRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sessionsData, tasksData, runsData] = await Promise.all([
        globalApiGetJson<SessionMetadata[]>('/chat/sessions'),
        listScheduledTasks().catch(() => [] as ScheduledTask[]),
        listAllScheduledTaskRuns(500, 0).catch(() => [] as ScheduledTaskRun[]),
      ]);

      if (!isMountedRef.current) return;

      const sorted = [...sessionsData].sort(
        (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
      );
      setSessions(sorted);
      setScheduledTasks(tasksData);
      setTaskRuns(runsData);
    } catch (err) {
      console.error('[useTaskCenterData] Failed to load:', err);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    isMountedRef.current = true;
    void fetchData();
    return () => { isMountedRef.current = false; };
  }, [fetchData]);

  // 监听定时任务事件
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const u1 = await onTaskUpdated(() => {
        if (isMountedRef.current) {
          listScheduledTasks().then(tasks => {
            if (isMountedRef.current) setScheduledTasks(tasks);
          }).catch(() => {});
        }
      });
      unlisteners.push(u1);

      const u2 = await onTaskDeleted(() => {
        if (isMountedRef.current) {
          listScheduledTasks().then(tasks => {
            if (isMountedRef.current) setScheduledTasks(tasks);
          }).catch(() => {});
        }
      });
      unlisteners.push(u2);

      const u3 = await onRunUpdated((run) => {
        if (isMountedRef.current) {
          setTaskRuns(prev => {
            const idx = prev.findIndex(r => r.id === run.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = run;
              return next;
            }
            return [run, ...prev];
          });
        }
      });
      unlisteners.push(u3);
    };

    void setup();
    return () => { unlisteners.forEach(fn => fn()); };
  }, []);

  // 从运行记录中收集定时任务关联的 sessionId
  const cronSessionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of taskRuns) {
      if (run.sessionId) ids.add(run.sessionId);
    }
    return ids;
  }, [taskRuns]);

  // 计算 session tag
  const sessionTagsMap = useMemo(() => {
    const map = new Map<string, SessionTag[]>();
    for (const sessionId of cronSessionIds) {
      map.set(sessionId, [{ type: 'cron' }]);
    }
    return map;
  }, [cronSessionIds]);

  const refresh = useCallback(() => { void fetchData(); }, [fetchData]);

  const removeSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  return {
    sessions,
    scheduledTasks,
    cronSessionIds,
    sessionTagsMap,
    isLoading,
    refresh,
    removeSession,
  };
}
