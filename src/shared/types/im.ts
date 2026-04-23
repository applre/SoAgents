// IM platform and status types

/** Rust-native adapters — baked into src-tauri/src/im/ */
export type ImPlatformBuiltin = 'telegram' | 'feishu' | 'dingtalk';

/** OpenClaw plugin channels — loaded dynamically via Plugin Bridge.
 *  The string is the pluginId (e.g. "qqbot", "openclaw-weixin").
 *  Format: "openclaw:<pluginId>". */
export type ImPlatformOpenClaw = `openclaw:${string}`;

export type ImPlatform = ImPlatformBuiltin | ImPlatformOpenClaw;

export type ImStatus = 'online' | 'connecting' | 'error' | 'stopped';
export type ImSourceType = 'private' | 'group';
export type GroupPermissionStatus = 'pending' | 'approved';
export type GroupActivation = 'mention' | 'always';
export type MessageSource =
  | 'desktop'
  | `${ImPlatformBuiltin}_${ImSourceType}`       // e.g. telegram_private, feishu_group
  | `openclaw:${string}_${ImSourceType}`;        // e.g. openclaw:qqbot_private

/** Narrow helper: distinguish builtin vs OpenClaw at runtime. */
export function isOpenClawPlatform(p: ImPlatform): p is ImPlatformOpenClaw {
  return typeof p === 'string' && p.startsWith('openclaw:');
}

/** Extract pluginId from an OpenClaw platform string.
 *  Returns undefined for builtin platforms. */
export function getOpenClawPluginId(p: ImPlatform): string | undefined {
  return isOpenClawPlatform(p) ? p.slice('openclaw:'.length) : undefined;
}

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
