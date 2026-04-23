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

export type SessionStatus = 'active' | 'approval' | 'inactive' | 'archived';

export interface SessionMetadata {
  id: string;
  agentDir: string;
  title: string;
  createdAt: string;
  lastActiveAt: string;
  sdkSessionId?: string;
  stats?: SessionStats;
  archived?: boolean;
  manuallyRenamed?: boolean;
  /** Message source: 'desktop' (default), 'telegram_private', 'telegram_group', etc. */
  source?: string;
  lastMessageRole?: 'user' | 'assistant';
  lastViewedAt?: string;
}

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  path: string; // 相对路径: sessionId/attachmentId.ext
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: MessageAttachment[];
  usage?: MessageUsage;
  toolCount?: number;
  durationMs?: number;
  /**
   * SDK-assigned UUID for this message (from Claude Agent SDK).
   * Required for Rewind (Query.rewindFiles) and Fork (forkSession option) —
   * without it these actions are disabled for the message. Undefined for
   * legacy messages persisted before the feature landed.
   */
  sdkUuid?: string;
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
