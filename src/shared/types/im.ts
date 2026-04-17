// IM platform and status types

export type ImPlatform = 'telegram' | 'feishu' | 'dingtalk';
export type ImStatus = 'online' | 'connecting' | 'error' | 'stopped';
export type ImSourceType = 'private' | 'group';
export type GroupPermissionStatus = 'pending' | 'approved';
export type GroupActivation = 'mention' | 'always';
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
  sourceId?: string;
  senderName?: string;
}

export interface ImBotStatus {
  botUsername?: string;
  status: ImStatus;
  uptimeSeconds: number;
  lastMessageAt?: string;
  activeSessions: ImActiveSession[];
  errorMessage?: string;
  restartCount: number;
  bufferedMessages: number;
  groupPermissions?: GroupPermission[];
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
  status: GroupPermissionStatus;
  discoveredAt: string;
}

export interface HeartbeatConfig {
  enabled: boolean;
  intervalMinutes: number;
  activeHours?: { start: string; end: string; timezone: string };
  ackMaxChars?: number;
}

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  enabled: false,
  intervalMinutes: 30,
};

export interface MemoryAutoUpdateConfig {
  enabled: boolean;
  intervalHours: 24 | 48 | 72;
  queryThreshold: number;
  updateWindowStart: string;   // HH:MM
  updateWindowEnd: string;     // HH:MM
  updateWindowTimezone?: string;
  lastBatchAt?: string;        // ISO timestamp
  lastBatchSessionCount?: number;
}

export const DEFAULT_MEMORY_AUTO_UPDATE_CONFIG: MemoryAutoUpdateConfig = {
  enabled: false,
  intervalHours: 24,
  queryThreshold: 5,
  updateWindowStart: '00:00',
  updateWindowEnd: '06:00',
};
