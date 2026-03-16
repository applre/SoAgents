import { useState, useEffect, useCallback, useRef } from 'react';
import { globalApiGetJson } from '../api/apiFetch';
import type { SessionMetadata } from '../../shared/types/session';

const POLL_INTERVAL_MS = 10_000;

/**
 * Independently fetch ALL sessions across workspaces for sidebar display.
 * Uses globalApiGetJson (through Rust proxy) — NOT raw fetch.
 * Polls every 10s for updates since no Tauri events exist for session changes.
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

  useEffect(() => {
    fetchSessions();
    intervalRef.current = setInterval(fetchSessions, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSessions]);

  return { sessions, loading, refresh: fetchSessions };
}
