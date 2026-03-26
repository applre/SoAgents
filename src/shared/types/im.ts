// IM platform and status types

export type ImPlatform = 'telegram' | 'feishu' | 'dingtalk';
export type ImStatus = 'online' | 'connecting' | 'error' | 'stopped';
export type ImSourceType = 'private' | 'group';
export type MessageSource =
  | 'desktop'
  | 'telegram_private'
  | 'telegram_group'
  | 'feishu_private'
  | 'feishu_group'
  | 'dingtalk_private'
  | 'dingtalk_group';

export interface MessageMetadata {
  source: MessageSource;
  sourceId: string;
  senderName?: string;
}

export interface ImBotStatus {
  botUsername?: string;
  status: ImStatus;
  uptimeSeconds: number;
  activeSessions: ImActiveSession[];
  errorMessage?: string;
  restartCount: number;
  bufferedMessages: number;
}

export interface ImActiveSession {
  sessionKey: string;
  sessionId: string;
  messageCount: number;
  lastActive: string;
}

export interface GroupPermission {
  groupId: string;
  groupName: string;
  platform: ImPlatform;
  status: 'pending' | 'approved';
  discoveredAt: string;
}

export interface HeartbeatConfig {
  enabled: boolean;
  intervalMinutes: number;
  activeHours?: { start: string; end: string; timezone: string };
}

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  enabled: false,
  intervalMinutes: 30,
};
