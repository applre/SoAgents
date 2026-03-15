import { globalApiGetJson } from './apiFetch';
import type { SessionDetailedStats, GlobalStats } from '../../shared/types/session';

export type { SessionDetailedStats, GlobalStats };

export async function getSessionStats(sessionId: string): Promise<SessionDetailedStats | null> {
  try {
    return await globalApiGetJson<SessionDetailedStats>(`/sessions/${sessionId}/stats`);
  } catch {
    return null;
  }
}

export async function getGlobalStats(range: '7d' | '30d' | '60d'): Promise<GlobalStats | null> {
  try {
    return await globalApiGetJson<GlobalStats>(`/api/global-stats?range=${range}`);
  } catch {
    return null;
  }
}
