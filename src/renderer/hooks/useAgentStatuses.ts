// Hook: Poll agent statuses from Rust cmd_all_agents_status (5s interval)
import { useState, useEffect, useRef, useCallback } from 'react';
import { isTauri } from '../utils/env';

interface ChannelStatusData {
  channelId: string;
  channelType: string;
  name?: string;
  status: 'online' | 'connecting' | 'error' | 'stopped';
  botUsername?: string;
  uptimeSeconds: number;
  lastMessageAt?: string;
  activeSessions: unknown[];
  errorMessage?: string;
  restartCount: number;
  bufferedMessages: number;
}

export interface AgentStatusData {
  agentId: string;
  agentName: string;
  enabled: boolean;
  channels: ChannelStatusData[];
}

export type AgentStatusMap = Record<string, AgentStatusData>;

const POLL_INTERVAL_MS = 5000;

export function useAgentStatuses(enabled = true) {
  const [statuses, setStatuses] = useState<AgentStatusMap>({});
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const fetchRef = useRef<() => void>(() => {});

  const refresh = useCallback(() => {
    fetchRef.current();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled || !isTauri()) {
      setLoading(false);
      return;
    }

    const fetchStatuses = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<AgentStatusMap>('cmd_all_agents_status');
        if (isMountedRef.current) {
          setStatuses(result);
          setLoading(false);
        }
      } catch {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };
    fetchRef.current = fetchStatuses;

    fetchStatuses();
    const id = setInterval(fetchStatuses, POLL_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      clearInterval(id);
    };
  }, [enabled]);

  return { statuses, loading, refresh };
}
