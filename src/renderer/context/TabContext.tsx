import { createContext, useContext } from 'react';
import type { Message, ChatImage } from '../types/chat';
import type { LogEntry } from '../../shared/types/log';
import type { ProviderEnv } from '../../shared/types/config';

// ── TabState: 完整状态（包含 messages 等频繁变化的字段）──

export interface TabState {
  tabId: string;
  agentDir: string;
  sessionId: string | null;
  sidecarReady: boolean;
  // 拆分消息：history（streaming 期间不变）+ streaming（仅此更新）
  historyMessages: Message[];
  streamingMessage: Message | null;
  // 组合视图（向后兼容）
  messages: Message[];
  isLoading: boolean;
  sessionState: 'idle' | 'running' | 'stopping' | 'error';
  sendMessage: (text: string, permissionMode?: string, skills?: { name: string; content: string }[], images?: ChatImage[], model?: string, providerEnv?: ProviderEnv, mcpEnabledServerIds?: string[]) => Promise<boolean>;
  stopResponse: () => Promise<void>;
  resetSession: () => Promise<void>;
  pendingPermission: { toolName: string; toolUseId: string; toolInput: Record<string, unknown> } | null;
  pendingQuestion: {
    toolUseId: string;
    questions: Array<{
      question: string;
      header: string;
      options: Array<{ label: string; description: string }>;
      multiSelect: boolean;
    }>;
  } | null;
  respondPermission: (toolUseId: string, decision: 'deny' | 'allow_once' | 'always_allow') => Promise<void>;
  respondQuestion: (toolUseId: string, answers: Record<string, string>) => Promise<void>;
  pendingExitPlanMode: { requestId: string; plan?: string } | null;
  pendingEnterPlanMode: { requestId: string } | null;
  respondExitPlanMode: (requestId: string, approved: boolean) => Promise<void>;
  respondEnterPlanMode: (requestId: string, approved: boolean) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  /** Rewind to a user message — truncate chat + try to roll back workspace files. */
  rewindToUserMessage: (userMessageId: string) => Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }>;
  /** Fork a new session from an assistant message. Returns the new session info
   *  for the caller to open in a new tab. */
  forkFromAssistantMessage: (assistantMessageId: string) => Promise<{
    success: boolean;
    newSessionId?: string;
    agentDir?: string;
    title?: string;
    error?: string;
  }>;
  unifiedLogs: LogEntry[];
  clearUnifiedLogs: () => void;
}

export const TabContext = createContext<TabState | null>(null);

// ── TabApiContext: 轻量、stable（streaming 期间不变）──
// 只含 tabId/agentDir + API 函数，不含 messages 等频繁变化字段
// 消费者不会因 SSE chunk 重渲染

export interface TabApiContextValue {
  tabId: string;
  agentDir: string;
  sessionId: string | null;
  apiGet: <T>(path: string) => Promise<T>;
  apiPost: <T>(path: string, body: unknown) => Promise<T>;
  /** 是否有消息（用于 ChatInput 锁定 provider 判断，避免订阅完整 messages 数组） */
  hasMessages: boolean;
}

export const TabApiContext = createContext<TabApiContextValue | null>(null);

// ── TabActiveContext: 隔离 isActive，Tab 切换不触发全树重渲染 ──

export const TabActiveContext = createContext<boolean>(false);

// ── Hooks ──

export function useTabState(): TabState {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTabState must be used within TabProvider');
  return ctx;
}

/**
 * 轻量 hook：只订阅 tabId/agentDir + API 函数，streaming 期间不重渲染。
 * 用于只需要调 API 不关心消息内容的组件。
 */
export function useTabApi(): TabApiContextValue {
  const ctx = useContext(TabApiContext);
  if (!ctx) throw new Error('useTabApi must be used within TabProvider');
  return ctx;
}

/** 当前 Tab 是否为活跃 Tab（独立 context，避免 isActive 变化触发全子树重渲染） */
export function useTabActive(): boolean {
  return useContext(TabActiveContext);
}
