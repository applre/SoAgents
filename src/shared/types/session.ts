/** Per-model usage breakdown */
export interface ModelUsageEntry {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

/** Usage information for assistant messages */
export interface MessageUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  /** Primary model (highest token usage) */
  model?: string;
  /** Per-model breakdown (for detailed statistics) */
  modelUsage?: Record<string, ModelUsageEntry>;
}

export interface SessionStats {
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens?: number;
  totalCacheCreationTokens?: number;
}

export interface SessionMetadata {
  id: string;
  agentDir: string;
  title: string;
  createdAt: string;
  lastActiveAt: string;
  sdkSessionId?: string;
  stats?: SessionStats;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  usage?: MessageUsage;
  toolCount?: number;
  durationMs?: number;
}

// ── 统计 API 响应类型 ──

export interface SessionDetailedStats {
  summary: SessionStats;
  byModel: Record<string, { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; count: number }>;
  messageDetails: Array<{ userQuery: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; toolCount: number; durationMs: number }>;
}

export interface GlobalStats {
  summary: { totalSessions: number; messageCount: number; totalInputTokens: number; totalOutputTokens: number; totalCacheReadTokens: number; totalCacheCreationTokens: number };
  daily: Array<{ date: string; inputTokens: number; outputTokens: number; messageCount: number }>;
  byModel: Record<string, { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; count: number }>;
}
