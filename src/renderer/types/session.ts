export interface SessionMetadata {
  id: string;
  agentDir: string;
  title: string;
  createdAt: string;
  lastActiveAt: string;
  sdkSessionId?: string;
  stats?: {
    messageCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
}
