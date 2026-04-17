import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Settings2, HeartPulse, ChevronRight } from 'lucide-react';
import { useConfigData } from '../context/ConfigContext';
import type { PermissionMode } from '../../shared/types/permission';
import type { McpServerDefinition } from '../../shared/types/mcp';
import type { AgentConfig } from '../../shared/types/agentConfig';
import type { ImBotStatus } from '../../shared/types/im';
import {
  ensureAgentConfig,
  patchAgentConfig,
  persistAgent,
  getAllChannelsStatus,
  stopAgentChannel,
} from '../config/agentConfigService';
import { fetchMcpServers } from '../services/mcpService';
import { AgentChannelsSection } from './ImAgentSettings/sections/AgentChannelsSection';
import AgentHeartbeatSection from './AgentHeartbeatSection';
import AgentMemoryUpdateSection from './AgentMemoryUpdateSection';

// ── Permission modes ──

const PERMISSION_MODES: {
  value: PermissionMode;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    value: 'plan',
    label: '规划模式',
    icon: '📋',
    desc: 'Agent 仅研究信息并与你确认规划',
  },
  {
    value: 'acceptEdits',
    label: '协同模式',
    icon: '⚡',
    desc: '文件读写自动执行，Shell 命令需确认',
  },
  {
    value: 'bypassPermissions',
    label: '自主模式',
    icon: '🚀',
    desc: 'Agent 拥有自主权限，无需人工确认',
  },
];

// ── Component ──

interface Props {
  agentDir: string;
}

export default function WorkspaceGeneralTab({ agentDir }: Props) {
  const { config, allProviders, currentProvider } = useConfigData();

  // ── AgentConfig as single source of truth ──

  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, ImBotStatus>>({});
  const [toggling, setToggling] = useState(false);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Popup state for dropdown rows
  const [openPopup, setOpenPopup] = useState<'model' | 'permission' | 'mcp' | null>(null);

  // Load or create AgentConfig on mount (lazy migration)
  const loadAgent = useCallback(async () => {
    try {
      const loaded = await ensureAgentConfig(agentDir);
      setAgent(loaded);
    } catch (e) {
      console.error('[WorkspaceGeneralTab] Failed to load AgentConfig:', e);
    }
  }, [agentDir]);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  // ── Derive AI config values from AgentConfig ──

  const selectedProviderId = agent?.providerId;
  const selectedModelId = agent?.model;
  const selectedPermissionMode: PermissionMode =
    (agent?.permissionMode as PermissionMode) ?? 'acceptEdits';
  const wsEnabledServers = agent?.mcpEnabledServers;

  // ── Agent name editing ──

  const [editingName, setEditingName] = useState<string | null>(null);

  const handleNameBlur = useCallback(async () => {
    if (editingName === null || !agent) return;
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== agent.name) {
      const updated = await patchAgentConfig(agent.id, { name: trimmed });
      if (updated) setAgent(updated);
    }
    setEditingName(null);
  }, [editingName, agent]);

  // MCP state
  const [globallyEnabledServers, setGloballyEnabledServers] = useState<McpServerDefinition[]>([]);

  useEffect(() => {
    fetchMcpServers()
      .then((data) => {
        const enabledSet = new Set(data.enabledIds);
        setGloballyEnabledServers(data.servers.filter((s) => enabledSet.has(s.id)));
      })
      .catch(() => {});
  }, []);

  // ── Proactive Agent mode ──

  const isProactive = !!(agent?.enabled);

  // Poll channel statuses when agent is active
  const pollStatuses = useCallback(async () => {
    try {
      const result = await getAllChannelsStatus();
      setAgentStatuses(result);
    } catch {
      // ignore
    }
  }, []);

  const channelCount = agent?.channels.length ?? 0;

  useEffect(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    if (isProactive && channelCount > 0) {
      const initialTimer = setTimeout(() => { void pollStatuses(); }, 0);
      statusIntervalRef.current = setInterval(() => {
        void pollStatuses();
      }, 5000);
      return () => {
        clearTimeout(initialTimer);
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
      };
    }
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, [isProactive, channelCount, pollStatuses]);

  // Toggle proactive agent mode
  const handleToggleProactive = useCallback(async () => {
    if (toggling || !agent) return;
    setToggling(true);
    try {
      if (agent.enabled) {
        for (const ch of agent.channels) {
          try {
            await stopAgentChannel(agent.id, ch.id);
          } catch { /* channel may not be running */ }
        }
        const updated = await patchAgentConfig(agent.id, { enabled: false });
        if (updated) setAgent(updated);
      } else {
        const updated = await patchAgentConfig(agent.id, { enabled: true });
        if (updated) setAgent(updated);
      }
    } catch (e) {
      console.error('[WorkspaceGeneralTab] Toggle proactive failed:', e);
    } finally {
      setToggling(false);
    }
  }, [agent, toggling]);

  // Handle agent config changes from AgentChannelsSection
  const handleAgentChange = useCallback(async (updated: AgentConfig) => {
    setAgent(updated);
    await persistAgent(updated);
  }, []);

  // ── Provider availability ──

  const availableProviderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of allProviders) {
      if (p.type === 'subscription' || config.apiKeys[p.id]) ids.add(p.id);
    }
    return ids;
  }, [allProviders, config.apiKeys]);

  // ── Effective provider (for model list) ──

  const effectiveProvider = useMemo(
    () =>
      selectedProviderId
        ? (allProviders.find((p) => p.id === selectedProviderId) ?? currentProvider)
        : currentProvider,
    [selectedProviderId, allProviders, currentProvider],
  );

  // ── Derived display values ──

  const effectiveModelId = selectedModelId ?? effectiveProvider.primaryModel;
  const modelDisplayName = effectiveProvider.models.find(m => m.model === effectiveModelId)?.modelName || effectiveModelId;
  const providerDisplayName = effectiveProvider.name || '默认';
  const modelSummary = selectedProviderId
    ? `${providerDisplayName} / ${modelDisplayName}`
    : `默认 / ${modelDisplayName || '未设置'}`;

  const permissionMode = PERMISSION_MODES.find(m => m.value === selectedPermissionMode) || PERMISSION_MODES[0];

  // MCP summary
  const wsEnabledSet = useMemo(
    () => (wsEnabledServers !== undefined ? new Set(wsEnabledServers) : null),
    [wsEnabledServers],
  );

  const enabledMcpNames = useMemo(
    () => globallyEnabledServers
      .filter((s) => wsEnabledSet === null || wsEnabledSet.has(s.id))
      .map((s) => s.name),
    [globallyEnabledServers, wsEnabledSet],
  );

  const mcpSummary = enabledMcpNames.length === 0
    ? '未启用工具'
    : enabledMcpNames.length <= 2
      ? enabledMcpNames.join(' / ')
      : `${enabledMcpNames.slice(0, 2).join(' / ')} +${enabledMcpNames.length - 2}`;

  // ── Handlers ──

  const handleModelSelect = useCallback(
    async (providerId: string, modelId: string) => {
      if (!agent) return;
      const updated = await patchAgentConfig(agent.id, { providerId, model: modelId });
      if (updated) setAgent(updated);
      setOpenPopup(null);
    },
    [agent],
  );

  const handlePermissionSelect = useCallback(
    async (mode: PermissionMode) => {
      if (!agent) return;
      const updated = await patchAgentConfig(agent.id, { permissionMode: mode });
      if (updated) setAgent(updated);
      setOpenPopup(null);
    },
    [agent],
  );

  const handleMcpToggle = useCallback(
    async (serverId: string) => {
      if (!agent) return;
      const currentList =
        wsEnabledServers !== undefined
          ? wsEnabledServers
          : globallyEnabledServers.map((s) => s.id);

      const next = currentList.includes(serverId)
        ? currentList.filter((id) => id !== serverId)
        : [...currentList, serverId];

      const updated = await patchAgentConfig(agent.id, { mcpEnabledServers: next });
      if (updated) setAgent(updated);
    },
    [agent, wsEnabledServers, globallyEnabledServers],
  );

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-12 text-[13px] text-[var(--ink-tertiary)]">
        加载中...
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-8 py-6">
      <div className="mx-auto max-w-2xl space-y-6 pb-8">

        {/* ── Card 1: 基础设置 ── */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5">
          <h3 className="flex items-center gap-2 text-[16px] font-medium text-[var(--ink)]">
            <Settings2 size={18} className="text-[var(--ink-secondary)]" />
            基础设置
          </h3>

          <div className="mt-4 space-y-3">
            {/* Name row */}
            <div className="flex items-center gap-3">
              <label className="w-14 shrink-0 text-[14px] text-[var(--ink-secondary)]">名称</label>
              <input
                type="text"
                value={editingName ?? agent.name}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => { void handleNameBlur(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-1.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                placeholder="Agent 名称"
              />
            </div>

            {/* Workspace path row */}
            <div className="flex items-center gap-3">
              <label className="w-14 shrink-0 text-[14px] text-[var(--ink-secondary)]">工作区</label>
              <span
                className="flex-1 truncate rounded-lg px-3 py-1.5 text-[14px] text-[var(--ink-tertiary)]"
                title={agentDir}
              >
                {agentDir}
              </span>
            </div>

            {/* Model row — clickable dropdown */}
            <div className="relative flex items-center gap-3">
              <label className="w-14 shrink-0 text-[14px] text-[var(--ink-secondary)]">模型</label>
              <button
                type="button"
                className="flex flex-1 items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5 text-left text-[14px] text-[var(--ink)] transition-colors hover:border-[var(--ink-tertiary)]"
                onClick={() => setOpenPopup(openPopup === 'model' ? null : 'model')}
              >
                <span className="truncate">{modelSummary}</span>
                <ChevronRight size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
              </button>

              {openPopup === 'model' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenPopup(null)} />
                  <div className="absolute left-20 top-0 z-50 max-h-[300px] w-[320px] overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] bg-[var(--paper)] p-2 shadow-lg">
                    {/* Default (global) option */}
                    <button
                      type="button"
                      className={`flex w-full items-center rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors ${
                        !selectedProviderId
                          ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                      }`}
                      onClick={() => {
                        if (!agent) return;
                        void patchAgentConfig(agent.id, { providerId: undefined, model: undefined }).then(u => { if (u) setAgent(u); });
                        setOpenPopup(null);
                      }}
                    >
                      全局默认 ({currentProvider.name})
                    </button>
                    <div className="my-1 border-t border-[var(--border)]" />
                    {allProviders
                      .filter((p) => availableProviderIds.has(p.id))
                      .map((provider) => (
                      <div key={provider.id} className="mb-1">
                        <div className="px-2 py-1 text-[12px] font-medium text-[var(--ink-tertiary)]">
                          {provider.name}
                        </div>
                        {provider.models.map((model) => (
                          <button
                            key={`${provider.id}:${model.model}`}
                            type="button"
                            className={`flex w-full items-center rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors ${
                              selectedProviderId === provider.id && effectiveModelId === model.model
                                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                                : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                            }`}
                            onClick={() => { void handleModelSelect(provider.id, model.model); }}
                          >
                            {model.modelName}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Permission row — clickable dropdown */}
            <div className="relative flex items-center gap-3">
              <label className="w-14 shrink-0 text-[14px] text-[var(--ink-secondary)]">权限</label>
              <button
                type="button"
                className="flex flex-1 items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5 text-left text-[14px] text-[var(--ink)] transition-colors hover:border-[var(--ink-tertiary)]"
                onClick={() => setOpenPopup(openPopup === 'permission' ? null : 'permission')}
              >
                <span>{permissionMode.icon} {permissionMode.label}</span>
                <ChevronRight size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
              </button>

              {openPopup === 'permission' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenPopup(null)} />
                  <div className="absolute left-20 top-0 z-50 w-[280px] rounded-xl border border-[var(--border)] bg-[var(--paper)] p-2 shadow-lg">
                    {PERMISSION_MODES.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                          selectedPermissionMode === mode.value
                            ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                            : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                        }`}
                        onClick={() => { void handlePermissionSelect(mode.value); }}
                      >
                        <span className="shrink-0">{mode.icon}</span>
                        <div>
                          <div className="text-[13px] font-medium">{mode.label}</div>
                          <div className="text-[12px] text-[var(--ink-tertiary)]">{mode.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* MCP Tools row — clickable dropdown */}
            <div className="relative flex items-center gap-3">
              <label className="w-14 shrink-0 text-[14px] text-[var(--ink-secondary)]">工具</label>
              <button
                type="button"
                className="flex flex-1 items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5 text-left text-[14px] text-[var(--ink)] transition-colors hover:border-[var(--ink-tertiary)]"
                onClick={() => setOpenPopup(openPopup === 'mcp' ? null : 'mcp')}
              >
                <span className="truncate">{mcpSummary}</span>
                <ChevronRight size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
              </button>

              {openPopup === 'mcp' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenPopup(null)} />
                  <div className="absolute left-20 top-0 z-50 max-h-[300px] w-[320px] overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] bg-[var(--paper)] p-2 shadow-lg">
                    {globallyEnabledServers.length === 0 ? (
                      <p className="px-3 py-2 text-[12px] text-[var(--ink-tertiary)]">
                        尚未启用全局 MCP 工具。请先在系统设置中启用。
                      </p>
                    ) : (
                      globallyEnabledServers.map((server) => {
                        const checked = wsEnabledSet === null || wsEnabledSet.has(server.id);
                        return (
                          <label
                            key={server.id}
                            className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--hover)]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => { void handleMcpToggle(server.id); }}
                              className="h-4 w-4 rounded border-[var(--border)]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] text-[var(--ink)]">{server.name}</p>
                              {server.description && (
                                <p className="truncate text-[12px] text-[var(--ink-tertiary)]">{server.description}</p>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Card 2: 主动 Agent 模式 ── */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <h3 className="flex items-center gap-2 text-[16px] font-medium text-[var(--ink)]">
                <HeartPulse size={18} className="text-[var(--accent)]" />
                主动 Agent 模式
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--ink-tertiary)]">
                启用后让 AI 具备 24 小时感知与行动能力、可添加聊天机器人（如飞书、钉钉）主动与你互动
              </p>
            </div>
            <button
              type="button"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                toggling ? 'cursor-wait opacity-50' : 'cursor-pointer'
              } ${
                isProactive ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
              }`}
              onClick={() => { void handleToggleProactive(); }}
              disabled={toggling}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  isProactive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sub-sections when proactive is enabled */}
          {isProactive && agent && (
            <>
              <div className="mt-6 border-t border-[var(--border)] pt-5">
                <AgentChannelsSection
                  agent={agent}
                  onChange={(updated) => { void handleAgentChange(updated); }}
                  statuses={agentStatuses}
                />
              </div>

              <div className="mt-6 border-t border-[var(--border)] pt-5">
                <AgentHeartbeatSection agent={agent} onAgentChanged={loadAgent} />
              </div>

              <div className="mt-6 border-t border-[var(--border)] pt-5">
                <AgentMemoryUpdateSection agent={agent} onAgentChanged={loadAgent} />
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
