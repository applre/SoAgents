import { useState, useEffect, useCallback, useRef } from 'react';
import { globalApiGetJson, globalApiPutJson } from '../api/apiFetch';
import type { SessionMetadata } from '../../shared/types/session';

const POLL_INTERVAL_MS = 10_000;

/**
 * Custom event name used by TabProvider to signal "session has new activity"
 * (e.g. assistant message completed, title changed). Consumers can dispatch this
 * via `window.dispatchEvent(new CustomEvent('session:activity', { detail: { sessionId } }))`
 * and this hook will refresh its session list.
 */
export const SESSION_ACTIVITY_EVENT = 'soagents:session-activity';

/**
 * Independently fetch ALL sessions across workspaces for sidebar display.
 * Uses globalApiGetJson (through Rust proxy) — NOT raw fetch.
 * Polls every 10s + listens for session activity events from TabProvider.
 */
export function useSidebarSessions() {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await globalApiGetJson<SessionMetadata[]>('/chat/sessions');
      setSessions(data);
    } catch {
      // silently ignore — global sidecar may not be ready yet
    } finally {
      setLoading(false);
    }
  }, []);

  // API 成功后从本地列表移除
  const removeSession = useCallback((sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  // Optimistic update: 本地立刻更新标题
  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title } : s));
  }, []);

  /**
   * 乐观更新 + API 调用：将 session 标记为已查看，立即清除 approval 状态。
   */
  const markSessionViewed = useCallback((sessionId: string) => {
    const now = new Date().toISOString();
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, lastViewedAt: now } : s))
    );
    globalApiPutJson(`/chat/sessions/${sessionId}/viewed`, {}).catch(() => {});
  }, []);

  useEffect(() => {
    void fetchSessions();
    intervalRef.current = setInterval(() => { void fetchSessions(); }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSessions]);

  // 监听 session 活动事件（assistant 回复完成等）→ 立即刷新，不等 10s 轮询
  useEffect(() => {
    const handler = () => { void fetchSessions(); };
    window.addEventListener(SESSION_ACTIVITY_EVENT, handler);
    return () => window.removeEventListener(SESSION_ACTIVITY_EVENT, handler);
  }, [fetchSessions]);

  return { sessions, loading, refresh: fetchSessions, removeSession, updateSessionTitle, markSessionViewed };
}
