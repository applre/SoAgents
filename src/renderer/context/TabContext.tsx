import { createContext, useContext } from 'react';
import type { Message } from '../types/chat';
import type { SessionMetadata } from '../types/session';

export interface TabState {
  tabId: string;
  agentDir: string;
  sessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  sessionState: 'idle' | 'running' | 'error';
  sendMessage: (text: string) => Promise<void>;
  stopResponse: () => Promise<void>;
  resetSession: () => Promise<void>;
  apiGet: <T>(path: string) => Promise<T>;
  apiPost: <T>(path: string, body: unknown) => Promise<T>;
  pendingPermission: { toolName: string; toolUseId: string; toolInput: Record<string, unknown> } | null;
  pendingQuestion: { question: string; options?: string[]; toolUseId: string } | null;
  respondPermission: (toolUseId: string, allow: boolean) => Promise<void>;
  respondQuestion: (toolUseId: string, response: string) => Promise<void>;
  sessions: SessionMetadata[];
  sessionsFetched: boolean;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

export const TabContext = createContext<TabState | null>(null);

export function useTabState(): TabState {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTabState must be used within TabProvider');
  return ctx;
}
