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

  // OpenClaw plugin fields — only set when type starts with "openclaw:".
  // Present for any channel backed by a Plugin Bridge (WeChat / WeCom / QQ / Feishu-enhanced etc).
  /** Plugin ID (e.g. "qqbot", "openclaw-weixin"). Redundant with `type` but easier to consume. */
  openclawPluginId?: string;
  /** npm spec used to install (e.g. "@sliverp/qqbot"). Stored so UI can offer reinstall. */
  openclawNpmSpec?: string;
  /** Arbitrary config key/values forwarded to the plugin via BRIDGE_PLUGIN_CONFIG env.
   *  Shape depends on plugin.manifest.configSchema (e.g. { botId, secret } for WeCom). */
  openclawPluginConfig?: Record<string, string>;
  /** Cached manifest snapshot at channel creation — avoids refetching on every load. */
  openclawManifest?: Record<string, unknown>;
  /** Tool groups (e.g. ["doc","chat","bitable"]) the user enabled for AI to access via MCP.
   *  Empty = no plugin tools exposed to AI. */
  openclawEnabledToolGroups?: string[];

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
