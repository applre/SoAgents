import type { ImPlatform, GroupPermission, GroupActivation, HeartbeatConfig, MemoryAutoUpdateConfig } from './im';

export type ChannelType = ImPlatform;

/**
 * Last active channel tracking for heartbeat/cron routing
 */
export interface LastActiveChannel {
  channelId: string;
  sessionKey: string;
  lastActiveAt: string; // ISO timestamp
}

export interface ChannelOverrides {
  providerId?: string;
  providerEnvJson?: string;
  model?: string;
  permissionMode?: string;
  toolsDeny?: string[];
}

export interface ChannelConfig {
  id: string;
  type: ChannelType;
  name?: string;
  enabled: boolean;

  // Platform credentials
  botToken?: string;
  telegramUseDraft?: boolean;
  feishuAppId?: string;
  feishuAppSecret?: string;
  dingtalkClientId?: string;
  dingtalkClientSecret?: string;
  dingtalkUseAiCard?: boolean;
  dingtalkCardTemplateId?: string;

  // User management
  allowedUsers?: string[];
  groupPermissions?: GroupPermission[];
  groupActivation?: GroupActivation;

  // Proxy
  proxyUrl?: string;

  // Per-channel overrides
  overrides?: ChannelOverrides;
  setupCompleted?: boolean;
}

export interface AgentConfig {
  // Identity
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;

  // Core: Workspace
  workspacePath: string;

  // AI Configuration (defaults for all channels + desktop sessions)
  providerId?: string;
  model?: string;
  providerEnvJson?: string;
  permissionMode: string;
  mcpEnabledServers?: string[];
  mcpServersJson?: string;

  // Heartbeat
  heartbeat?: HeartbeatConfig;

  // Memory Auto-Update
  memoryAutoUpdate?: MemoryAutoUpdateConfig;

  // Channels
  channels: ChannelConfig[];

  // Active message routing
  lastActiveChannel?: LastActiveChannel;

  // Runtime
  setupCompleted?: boolean;
}

export interface EffectiveConfig {
  providerId?: string;
  providerEnvJson?: string;
  model?: string;
  permissionMode: string;
  mcpEnabledServers?: string[];
  mcpServersJson?: string;
}

export function resolveEffectiveConfig(
  agent: AgentConfig,
  channel: ChannelConfig,
): EffectiveConfig {
  return {
    providerId: channel.overrides?.providerId ?? agent.providerId,
    providerEnvJson: channel.overrides?.providerEnvJson ?? agent.providerEnvJson,
    model: channel.overrides?.model ?? agent.model,
    permissionMode: channel.overrides?.permissionMode ?? agent.permissionMode,
    mcpEnabledServers: agent.mcpEnabledServers,
    mcpServersJson: agent.mcpServersJson,
  };
}

export const DEFAULT_AGENT_CONFIG: Partial<AgentConfig> = {
  enabled: true,
  permissionMode: 'bypassPermissions',
  channels: [],
};
