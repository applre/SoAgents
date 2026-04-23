import { invoke } from '@tauri-apps/api/core';
import type { AgentConfig, ChannelConfig } from '../../shared/types/agentConfig';
import type { AppConfig } from '../../shared/types/config';
import type { WorkspaceEntry } from '../../shared/types/workspace';
import type { ImBotStatus } from '../../shared/types/im';
import type { PermissionMode } from '../../shared/types/permission';
import { resolveEffectiveConfig } from '../../shared/types/agentConfig';
import { atomicModifyConfig, loadAppConfig } from './configService';
import { atomicModifyWorkspaces, loadWorkspaces } from './workspaceService';
import { fetchMcpServers } from '../services/mcpService';
import { isTauri } from '../utils/env';

// ============= Query Helpers =============

export async function getAgents(): Promise<AgentConfig[]> {
  const config = await loadAppConfig();
  return config.agents ?? [];
}

export async function getAgentById(agentId: string): Promise<AgentConfig | undefined> {
  const agents = await getAgents();
  return agents.find((a) => a.id === agentId);
}

export async function getAgentByWorkspacePath(workspacePath: string): Promise<AgentConfig | undefined> {
  const agents = await getAgents();
  const normalized = workspacePath.replace(/\\/g, '/');
  return agents.find((a) => a.workspacePath.replace(/\\/g, '/') === normalized);
}

// ============= Persistence =============

export async function persistAgent(agent: AgentConfig): Promise<void> {
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

/**
 * Atomically patch an AgentConfig with auto-resolve for MCP and Provider.
 * After disk write, hot-reloads runtime state of running agent instances via Tauri command.
 */
export async function patchAgentConfig(
  agentId: string,
  patch: Partial<Omit<AgentConfig, 'id'>>,
): Promise<AgentConfig | undefined> {
  let updated: AgentConfig | undefined;

  // If mcpEnabledServers changed, resolve mcpServersJson before disk write
  let resolvedMcpJson: string | undefined;
  if ('mcpEnabledServers' in patch) {
    try {
      const { servers, enabledIds } = await fetchMcpServers();
      const agentMcpIds = patch.mcpEnabledServers ?? [];
      const enabledMcpDefs = servers.filter(
        (s) => enabledIds.includes(s.id) && agentMcpIds.includes(s.id),
      );
      resolvedMcpJson = enabledMcpDefs.length > 0 ? JSON.stringify(enabledMcpDefs) : undefined;
    } catch (e) {
      console.warn('[agentConfigService] Failed to resolve MCP servers:', e);
    }
  }

  // If providerId changed but providerEnvJson was NOT explicitly provided,
  // auto-resolve from provider registry + stored API keys.
  let resolvedProviderEnvJson: string | undefined;
  let shouldUpdateProviderEnv = false;
  if ('providerId' in patch && !('providerEnvJson' in patch)) {
    shouldUpdateProviderEnv = true;
    try {
      const { PROVIDERS } = await import('../../shared/providers');
      const latestConfig = await loadAppConfig();
      // Merge preset providers with user custom providers
      const allProviders = [...PROVIDERS, ...(latestConfig.customProviders ?? [])];
      const provider = allProviders.find((p) => p.id === patch.providerId);
      if (provider && provider.type !== 'subscription') {
        const apiKeys = latestConfig.apiKeys ?? {};
        resolvedProviderEnvJson = JSON.stringify({
          baseUrl: provider.config?.baseUrl,
          apiKey: apiKeys[provider.id],
          authType: provider.authType,
          apiProtocol: provider.apiProtocol,
          maxOutputTokens: provider.maxOutputTokens,
        });
      } else {
        resolvedProviderEnvJson = undefined;
      }
    } catch (e) {
      console.warn('[agentConfigService] Failed to resolve provider env:', e);
      shouldUpdateProviderEnv = false;
    }
  }

  await atomicModifyConfig((config) => {
    const agents = [...(config.agents ?? [])];
    const idx = agents.findIndex((a) => a.id === agentId);
    if (idx < 0) return config;
    agents[idx] = {
      ...agents[idx],
      ...patch,
      id: agentId,
      ...(resolvedMcpJson !== undefined || 'mcpEnabledServers' in patch
        ? { mcpServersJson: resolvedMcpJson }
        : {}),
      ...(shouldUpdateProviderEnv
        ? { providerEnvJson: resolvedProviderEnvJson }
        : {}),
    };
    updated = agents[idx];
    return { ...config, agents };
  });

  // Sync AI fields to WorkspaceEntry for backward compatibility
  if (updated && (
    patch.providerId !== undefined || patch.model !== undefined ||
    patch.permissionMode !== undefined || patch.mcpEnabledServers !== undefined
  )) {
    await syncAgentToWorkspace(updated);
  }

  // Hot-reload runtime state if agent is running
  if (updated) {
    const effectivePatch = shouldUpdateProviderEnv
      ? { ...patch, providerEnvJson: resolvedProviderEnvJson }
      : patch;
    await syncAgentRuntime(agentId, effectivePatch, resolvedMcpJson);
  }

  return updated;
}

/**
 * Ensure the workspace has an associated AgentConfig.
 * If not, create one by migrating from WorkspaceEntry fields (lazy upgrade).
 */
export async function ensureAgentConfig(agentDir: string): Promise<AgentConfig> {
  const workspaces = await loadWorkspaces();
  const wsEntry = workspaces.find((w) => w.path === agentDir);

  if (wsEntry?.agentId) {
    const existing = await getAgentById(wsEntry.agentId);
    if (existing) return existing;
  }

  // Create new AgentConfig, migrating from WorkspaceEntry.
  // Reuse existing wsEntry.agentId if present — otherwise heartbeat runners /
  // Rust-side state that already reference it would become orphaned.
  const dirName = agentDir.split('/').pop() || 'Agent';
  const newAgent: AgentConfig = {
    id: wsEntry?.agentId ?? crypto.randomUUID(),
    name: dirName,
    enabled: false,
    workspacePath: agentDir,
    providerId: wsEntry?.providerId,
    model: wsEntry?.modelId,
    permissionMode: wsEntry?.permissionMode ?? 'acceptEdits',
    mcpEnabledServers: wsEntry?.mcpEnabledServers,
    channels: [],
  };

  await persistAgent(newAgent);

  // Update WorkspaceEntry.agentId
  await atomicModifyWorkspaces((wsList) =>
    wsList.map((w) =>
      w.path === agentDir ? { ...w, agentId: newAgent.id } : w,
    ),
  );

  return newAgent;
}

// ============= Startup Reconcile =============

/**
 * Ensure every WorkspaceEntry has a linked AgentConfig in config.agents.
 * Runs once at startup from ConfigProvider — makes `config.agents` the
 * single source of truth so UI consumers (AgentCardList, AgentSettingsPanel)
 * don't have to do per-call fallbacks.
 *
 * Three cases per workspace:
 *  1. workspace.agentId points to a valid agent → skip
 *  2. agentId orphan but an agent with matching workspacePath exists → repair reference
 *  3. neither → create a basicAgent (inherit provider/model/permission from workspace)
 *
 * Mutates `config.agents` and `workspaces` in place. Returns true if anything changed,
 * so the caller knows whether to persist.
 */
export function ensureAllWorkspacesHaveAgent(
  config: AppConfig,
  workspaces: WorkspaceEntry[],
): { changed: boolean; createdCount: number } {
  const agents = config.agents ?? [];
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  let changed = false;
  let createdCount = 0;

  for (const ws of workspaces) {
    // Case 1: already linked to a valid agent
    if (ws.agentId && agentMap.has(ws.agentId)) {
      continue;
    }

    // Case 2: agent exists by workspacePath — repair stale/missing agentId
    const normalized = ws.path.replace(/\\/g, '/');
    const existingByPath = agents.find(
      (a) => a.workspacePath.replace(/\\/g, '/') === normalized,
    );
    if (existingByPath) {
      ws.agentId = existingByPath.id;
      changed = true;
      continue;
    }

    // Case 3: create basicAgent from workspace fields.
    // Reuse workspace.agentId if present — preserves references in heartbeat
    // runners and any persisted Rust-side state.
    const dirName = ws.path.split('/').pop() || 'Agent';
    const agentId = ws.agentId ?? crypto.randomUUID();
    const basicAgent: AgentConfig = {
      id: agentId,
      name: dirName,
      enabled: false,
      workspacePath: ws.path,
      providerId: ws.providerId,
      model: ws.modelId,
      permissionMode: ws.permissionMode ?? 'acceptEdits',
      mcpEnabledServers: ws.mcpEnabledServers,
      channels: [],
    };
    agents.push(basicAgent);
    agentMap.set(agentId, basicAgent);
    ws.agentId = agentId;
    changed = true;
    createdCount++;
  }

  if (changed) {
    config.agents = agents;
    console.log(
      `[agentConfigService] ensureAllWorkspacesHaveAgent: created ${createdCount} agent(s), total ${agents.length}`,
    );
  }

  return { changed, createdCount };
}

/**
 * Persist the agents array to disk (atomic).
 * Prefer this over persistAgent() when saving a whole reconciled list.
 */
export async function persistAgents(agents: AgentConfig[]): Promise<void> {
  await atomicModifyConfig((config) => ({ ...config, agents }));
}

// ============= Internal helpers =============

async function syncAgentToWorkspace(agent: AgentConfig): Promise<void> {
  await atomicModifyWorkspaces((wsList) =>
    wsList.map((w) => {
      if (w.path !== agent.workspacePath) return w;
      return {
        ...w,
        providerId: agent.providerId,
        modelId: agent.model,
        permissionMode: agent.permissionMode as PermissionMode | undefined,
        mcpEnabledServers: agent.mcpEnabledServers,
      };
    }),
  );
}

/**
 * Sync runtime-sensitive fields to running agent instance via Tauri command.
 * Only sends fields that are present in the patch (i.e. actually changed).
 */
async function syncAgentRuntime(
  agentId: string,
  patch: Partial<Omit<AgentConfig, 'id'>>,
  preResolvedMcpJson?: string,
): Promise<void> {
  if (!isTauri()) return;

  const runtimePatch: Record<string, unknown> = {};
  let hasRuntimeChanges = false;

  if ('model' in patch) {
    runtimePatch.model = patch.model ?? null;
    hasRuntimeChanges = true;
  }
  if ('providerEnvJson' in patch) {
    runtimePatch.providerEnvJson = patch.providerEnvJson ?? null;
    hasRuntimeChanges = true;
  }
  if ('permissionMode' in patch) {
    runtimePatch.permissionMode = patch.permissionMode ?? null;
    hasRuntimeChanges = true;
  }
  if ('heartbeat' in patch) {
    runtimePatch.heartbeatConfigJson = patch.heartbeat ? JSON.stringify(patch.heartbeat) : null;
    hasRuntimeChanges = true;
  }
  if ('memoryAutoUpdate' in patch) {
    runtimePatch.memoryAutoUpdateConfigJson = patch.memoryAutoUpdate ? JSON.stringify(patch.memoryAutoUpdate) : null;
    hasRuntimeChanges = true;
  }
  if ('mcpEnabledServers' in patch) {
    runtimePatch.mcpServersJson = preResolvedMcpJson ?? null;
    hasRuntimeChanges = true;
  }
  if ('channels' in patch && patch.channels) {
    runtimePatch.channels = patch.channels;
    hasRuntimeChanges = true;
  }

  if (!hasRuntimeChanges) return;

  try {
    await invoke('cmd_update_agent_config', { agentId, patch: runtimePatch });
  } catch (e) {
    // Agent may not be running — that's fine, config is already persisted to disk
    console.debug('[agentConfigService] Runtime sync skipped (agent not running?):', e);
  }
}

// --- Channel helpers ---

export function getChannelById(
  agent: AgentConfig,
  channelId: string,
): ChannelConfig | undefined {
  return agent.channels.find((c) => c.id === channelId);
}

// --- Tauri command wrappers ---

/**
 * Start an agent channel via Tauri command.
 * Resolves MCP server definitions and effective config (agent + channel overrides).
 */
export async function startAgentChannel(
  agent: AgentConfig,
  channel: ChannelConfig,
): Promise<void> {
  // Resolve MCP server definitions
  let mcpServersJson: string | null = agent.mcpServersJson ?? null;
  if (!mcpServersJson && agent.mcpEnabledServers?.length) {
    try {
      const { servers, enabledIds } = await fetchMcpServers();
      const agentMcpIds = agent.mcpEnabledServers ?? [];
      const enabledMcpDefs = servers.filter(
        (s) => enabledIds.includes(s.id) && agentMcpIds.includes(s.id),
      );
      mcpServersJson = enabledMcpDefs.length > 0 ? JSON.stringify(enabledMcpDefs) : null;
    } catch {
      // Use persisted mcpServersJson as fallback
    }
  }

  const effective = resolveEffectiveConfig(agent, channel);

  await invoke('cmd_start_agent_channel', {
    agentId: agent.id,
    channelId: channel.id,
    agentConfig: {
      id: agent.id,
      name: agent.name,
      enabled: agent.enabled,
      workspacePath: agent.workspacePath,
      providerId: effective.providerId,
      model: effective.model,
      providerEnvJson: effective.providerEnvJson,
      permissionMode: effective.permissionMode,
      mcpEnabledServers: agent.mcpEnabledServers,
      mcpServersJson,
      heartbeat: agent.heartbeat,
      memoryAutoUpdate: agent.memoryAutoUpdate,
      channels: [],
      lastActiveChannel: agent.lastActiveChannel,
    },
    channelConfig: {
      id: channel.id,
      type: channel.type,
      name: channel.name,
      enabled: channel.enabled,
      botToken: channel.botToken,
      telegramUseDraft: channel.telegramUseDraft,
      feishuAppId: channel.feishuAppId,
      feishuAppSecret: channel.feishuAppSecret,
      dingtalkClientId: channel.dingtalkClientId,
      dingtalkClientSecret: channel.dingtalkClientSecret,
      dingtalkUseAiCard: channel.dingtalkUseAiCard,
      dingtalkCardTemplateId: channel.dingtalkCardTemplateId,
      allowedUsers: channel.allowedUsers || [],
      groupPermissions: channel.groupPermissions || [],
      groupActivation: channel.groupActivation,
      proxyUrl: channel.proxyUrl,
      overrides: channel.overrides,
      setupCompleted: channel.setupCompleted,
    },
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

export async function verifyFeishuCredentials(
  appId: string,
  appSecret: string,
): Promise<string> {
  return invoke('cmd_im_verify_feishu_credentials', { appId, appSecret });
}

export async function verifyDingtalkCredentials(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  return invoke('cmd_im_verify_dingtalk_credentials', { clientId, clientSecret });
}

export async function approveGroupPermission(
  agentId: string,
  channelId: string,
  groupId: string,
): Promise<void> {
  return invoke('cmd_im_approve_group', { agentId, channelId, groupId });
}

export async function rejectGroupPermission(
  agentId: string,
  channelId: string,
  groupId: string,
): Promise<void> {
  return invoke('cmd_im_reject_group', { agentId, channelId, groupId });
}

export async function removeGroupPermission(
  agentId: string,
  channelId: string,
  groupId: string,
): Promise<void> {
  return invoke('cmd_im_remove_group', { agentId, channelId, groupId });
}
