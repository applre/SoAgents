export interface SessionStats {
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
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
  usage?: { inputTokens: number; outputTokens: number };
}
