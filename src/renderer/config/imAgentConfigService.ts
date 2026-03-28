import { invoke } from '@tauri-apps/api/core';
import type { ImAgentConfig, ChannelConfig } from '../../shared/types/imAgent';
import type { ImBotStatus } from '../../shared/types/im';
import { resolveEffectiveConfig } from '../../shared/types/imAgent';
import { atomicModifyConfig, loadAppConfig } from './configService';

// --- CRUD ---

export async function getAgents(): Promise<ImAgentConfig[]> {
  const config = await loadAppConfig();
  return config.agents ?? [];
}

export async function getAgentById(agentId: string): Promise<ImAgentConfig | undefined> {
  const agents = await getAgents();
  return agents.find((a) => a.id === agentId);
}

export async function persistAgent(agent: ImAgentConfig): Promise<void> {
  await atomicModifyConfig((config) => {
    const agents = [...(config.agents ?? [])];
    const idx = agents.findIndex((a) => a.id === agent.id);
    if (idx >= 0) {
      agents[idx] = agent;
    } else {
      agents.push(agent);
    }
    return { ...config, agents };
  });
}

export async function removeAgent(agentId: string): Promise<void> {
  await atomicModifyConfig((config) => ({
    ...config,
    agents: (config.agents ?? []).filter((a) => a.id !== agentId),
  }));
}

export async function patchAgent(
  agentId: string,
  patch: Partial<ImAgentConfig>,
): Promise<void> {
  await atomicModifyConfig((config) => {
    const agents = [...(config.agents ?? [])];
    const idx = agents.findIndex((a) => a.id === agentId);
    if (idx >= 0) {
      agents[idx] = { ...agents[idx], ...patch };
    }
    return { ...config, agents };
  });
}

// --- Channel helpers ---

export function getChannelById(
  agent: ImAgentConfig,
  channelId: string,
): ChannelConfig | undefined {
  return agent.channels.find((c) => c.id === channelId);
}

// --- Tauri command wrappers ---

export function buildImConfig(
  agent: ImAgentConfig,
  channel: ChannelConfig,
): Record<string, unknown> {
  const effective = resolveEffectiveConfig(agent, channel);
  return {
    agentId: agent.id,
    channelId: channel.id,
    platform: channel.type,
    workspacePath: agent.workspacePath,
    botToken: channel.botToken,
    telegramUseDraft: channel.telegramUseDraft ?? true,
    allowedUsers: channel.allowedUsers ?? [],
    proxyUrl: channel.proxyUrl,
    providerId: effective.providerId,
    model: effective.model,
    providerEnvJson: effective.providerEnvJson,
    permissionMode: effective.permissionMode,
    mcpEnabledServers: effective.mcpEnabledServers,
    mcpServersJson: effective.mcpServersJson,
  };
}

export async function startAgentChannel(
  agent: ImAgentConfig,
  channel: ChannelConfig,
): Promise<void> {
  const config = buildImConfig(agent, channel);
  await invoke('cmd_start_agent_channel', {
    configJson: JSON.stringify(config),
  });
}

export async function stopAgentChannel(
  agentId: string,
  channelId: string,
): Promise<void> {
  await invoke('cmd_stop_agent_channel', { agentId, channelId });
}

export async function getChannelStatus(
  agentId: string,
  channelId: string,
): Promise<ImBotStatus> {
  return invoke('cmd_agent_channel_status', { agentId, channelId });
}

export async function getAllChannelsStatus(): Promise<Record<string, ImBotStatus>> {
  return invoke('cmd_all_agent_channels_status');
}

export async function verifyToken(
  platform: string,
  token: string,
  proxyUrl?: string,
): Promise<string> {
  return invoke('cmd_im_verify_token', { platform, token, proxyUrl });
}
