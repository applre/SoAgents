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
import { listScheduledTasks, onTaskUpdated, onTaskDeleted } from '../api/scheduledTaskApi';
import type { SessionMetadata } from '../../shared/types/session';
import type { ScheduledTask } from '../../shared/types/scheduledTask';

export type SessionTag = { type: 'cron' };

export interface TaskCenterData {
  sessions: SessionMetadata[];
  scheduledTasks: ScheduledTask[];
  sessionTagsMap: Map<string, SessionTag[]>;
  isLoading: boolean;
  refresh: () => void;
  removeSession: (sessionId: string) => void;
}

export function useTaskCenterData(): TaskCenterData {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sessionsData, tasksData] = await Promise.all([
        globalApiGetJson<SessionMetadata[]>('/chat/sessions'),
        listScheduledTasks().catch(() => [] as ScheduledTask[]),
      ]);

      if (!isMountedRef.current) return;

      const sorted = [...sessionsData].sort(
        (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
      );
      setSessions(sorted);
      setScheduledTasks(tasksData);
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
    };

    void setup();
    return () => { unlisteners.forEach(fn => fn()); };
  }, []);

  // 计算 session tag
  const sessionTagsMap = useMemo(() => {
    const map = new Map<string, SessionTag[]>();

    // 收集正在运行的定时任务关联的 sessionId
    // ScheduledTask 目前没有 sessionId 字段，暂时通过 state.lastStatus === 'running' 标记
    // TODO: 后续如果 ScheduledTask 增加 sessionId 字段再精准匹配
    for (const _task of scheduledTasks) {
      // 当前 ScheduledTask 类型没有直接关联 sessionId
      // 先跳过，后续可以扩展
    }

    return map;
  }, [scheduledTasks]);

  const refresh = useCallback(() => { void fetchData(); }, [fetchData]);

  const removeSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  return {
    sessions,
    scheduledTasks,
    sessionTagsMap,
    isLoading,
    refresh,
    removeSession,
  };
}
