import type { ImPlatform, GroupPermission, HeartbeatConfig } from './im';

export type ChannelType = ImPlatform;

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

  // Telegram
  botToken?: string;
  telegramUseDraft?: boolean;

  // Feishu (Phase 2)
  feishuAppId?: string;
  feishuAppSecret?: string;

  // DingTalk (Phase 2)
  dingtalkClientId?: string;
  dingtalkClientSecret?: string;

  // User management
  allowedUsers?: string[];
  groupPermissions?: GroupPermission[];
  groupActivation?: 'mention' | 'always';

  // Per-channel AI overrides
  overrides?: ChannelOverrides;
  setupCompleted?: boolean;
}

export interface ImAgentConfig {
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
  workspacePath: string;

  // Default AI config (inherited by all channels)
  providerId?: string;
  model?: string;
  providerEnvJson?: string;
  permissionMode: string;
  mcpEnabledServers?: string[];
  mcpServersJson?: string;

  // Phase 3
  heartbeat?: HeartbeatConfig;

  channels: ChannelConfig[];
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
  agent: ImAgentConfig,
  channel: ChannelConfig
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

export const DEFAULT_IM_AGENT_CONFIG: Partial<ImAgentConfig> = {
  enabled: true,
  permissionMode: 'bypassPermissions',
  channels: [],
};
