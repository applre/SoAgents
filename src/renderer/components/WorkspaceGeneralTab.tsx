import { useEffect, useState, useCallback, useMemo } from 'react';
import { Shield, ShieldCheck, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useConfigData, useConfigActions } from '../context/ConfigContext';
import type { PermissionMode } from '../../shared/types/permission';
import type { McpServerDefinition } from '../../shared/types/mcp';
import { fetchMcpServers } from '../services/mcpService';
import CustomSelect from './CustomSelect';

// ── Permission modes ──

const PERMISSION_MODES: {
  value: PermissionMode;
  label: string;
  desc: string;
  Icon: LucideIcon;
  color: string;
  recommended?: boolean;
}[] = [
  {
    value: 'plan',
    label: '规划模式',
    desc: 'Agent 仅研究信息并与你确认规划',
    Icon: Shield,
    color: '#3b82f6',
  },
  {
    value: 'acceptEdits',
    label: '协同模式',
    desc: '文件读写自动执行，Shell 命令需确认',
    Icon: ShieldCheck,
    color: 'var(--accent)',
    recommended: true,
  },
  {
    value: 'bypassPermissions',
    label: '自主模式',
    desc: 'Agent 拥有自主权限，无需人工确认',
    Icon: Zap,
    color: '#f59e0b',
  },
];

// ── Component ──

interface Props {
  agentDir: string;
}

export default function WorkspaceGeneralTab({ agentDir }: Props) {
  const { config, allProviders, currentProvider, workspaces } = useConfigData();
  const { updateWorkspaceConfig } = useConfigActions();

  const wsEntry = useMemo(
    () => workspaces.find((w) => w.path === agentDir),
    [workspaces, agentDir],
  );

  // Derive effective values from workspace entry (undefined = global default)
  const selectedProviderId = wsEntry?.providerId; // undefined means "全局默认"
  const selectedModelId = wsEntry?.modelId;
  const selectedPermissionMode: PermissionMode = wsEntry?.permissionMode ?? 'acceptEdits';
  const wsEnabledServers = wsEntry?.mcpEnabledServers; // undefined = use global

  // MCP state
  const [globallyEnabledServers, setGloballyEnabledServers] = useState<McpServerDefinition[]>([]);

  useEffect(() => {
    fetchMcpServers()
      .then((data) => {
        const enabledSet = new Set(data.enabledIds);
        setGloballyEnabledServers(data.servers.filter((s) => enabledSet.has(s.id)));
      })
      .catch(() => {
        // silently ignore — MCP not critical for this view
      });
  }, []);

  // ── Provider availability (stable Set derived from apiKeys) ──

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

  // ── Model options ──

  const modelOptions = effectiveProvider.models.map((m) => ({
    value: m.model,
    label: m.modelName,
  }));

  // Effective selected model — fallback to provider's primary model
  const effectiveModelId = selectedModelId ?? effectiveProvider.primaryModel;

  // ── Handlers ──

  const handleProviderSelect = useCallback(
    (providerId: string | undefined) => {
      // When switching provider, clear model override so it defaults to new provider's primary
      updateWorkspaceConfig(agentDir, { providerId, modelId: undefined });
    },
    [agentDir, updateWorkspaceConfig],
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      updateWorkspaceConfig(agentDir, { modelId });
    },
    [agentDir, updateWorkspaceConfig],
  );

  const handlePermissionModeChange = useCallback(
    (mode: PermissionMode) => {
      updateWorkspaceConfig(agentDir, { permissionMode: mode });
    },
    [agentDir, updateWorkspaceConfig],
  );

  const handleMcpToggle = useCallback(
    (serverId: string, enabled: boolean) => {
      // Compute new list from current state
      const currentList =
        wsEnabledServers !== undefined
          ? wsEnabledServers
          : globallyEnabledServers.map((s) => s.id);

      const next = enabled
        ? Array.from(new Set([...currentList, serverId]))
        : currentList.filter((id) => id !== serverId);

      updateWorkspaceConfig(agentDir, { mcpEnabledServers: next });
    },
    [agentDir, wsEnabledServers, globallyEnabledServers, updateWorkspaceConfig],
  );

  // Derived MCP enabled set for O(1) lookup
  const wsEnabledSet = useMemo(
    () => (wsEnabledServers !== undefined ? new Set(wsEnabledServers) : null),
    [wsEnabledServers],
  );

  const isMcpServerEnabled = useCallback(
    (serverId: string): boolean => {
      if (wsEnabledSet === null) return true;
      return wsEnabledSet.has(serverId);
    },
    [wsEnabledSet],
  );

  const allMcpOff = useMemo(
    () =>
      wsEnabledSet !== null &&
      globallyEnabledServers.every((s) => !wsEnabledSet.has(s.id)),
    [wsEnabledSet, globallyEnabledServers],
  );

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* ── Section 1: Provider ── */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--ink-secondary)] uppercase tracking-wide">
          AI 服务商
        </h3>

        {/* Provider card row */}
        <div className="flex flex-wrap gap-2">
          {/* Global default card */}
          <button
            type="button"
            onClick={() => handleProviderSelect(undefined)}
            className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
              selectedProviderId === undefined
                ? 'border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--ink)]'
                : 'border-dashed border-[var(--border)] text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
            }`}
            style={{ minWidth: '120px' }}
          >
            <span className="text-[13px] font-medium">全局默认</span>
            <span className="text-[11px] text-[var(--ink-tertiary)]">{currentProvider.name}</span>
          </button>

          {/* Provider cards */}
          {allProviders.map((p) => {
            const available = availableProviderIds.has(p.id);
            const isSelected = selectedProviderId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!available}
                onClick={() => available && handleProviderSelect(p.id)}
                className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--ink)]'
                    : available
                      ? 'border-[var(--border)] text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
                      : 'border-[var(--border)] text-[var(--ink-tertiary)] opacity-40 cursor-not-allowed'
                }`}
                style={{ minWidth: '120px' }}
              >
                <span className="text-[13px] font-medium">{p.name}</span>
                <span className="text-[11px] text-[var(--ink-tertiary)]">
                  {available ? p.vendor : '未配置'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Section 2: Model ── */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--ink-secondary)] uppercase tracking-wide">
          模型
        </h3>
        <div className="flex items-center gap-3">
          <CustomSelect
            value={effectiveModelId}
            options={modelOptions}
            onChange={handleModelChange}
            placeholder="选择模型"
            className="w-64"
          />
          {!selectedProviderId && (
            <span className="text-[12px] text-[var(--ink-tertiary)]">跟随全局默认</span>
          )}
        </div>
      </section>

      {/* ── Section 3: Permission Mode ── */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--ink-secondary)] uppercase tracking-wide">
          执行权限
        </h3>
        <div className="flex flex-col gap-2">
          {PERMISSION_MODES.map((m) => {
            const isActive = selectedPermissionMode === m.value;
            const MIcon = m.Icon;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => handlePermissionModeChange(m.value)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border)] hover:bg-[var(--hover)]'
                }`}
              >
                <MIcon size={16} style={{ color: m.color, flexShrink: 0 }} />
                <div className="flex flex-col gap-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[13px] font-medium ${isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-secondary)]'}`}
                    >
                      {m.label}
                    </span>
                    {m.recommended && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
                        推荐
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] text-[var(--ink-tertiary)]">{m.desc}</span>
                </div>
                {/* Selection indicator */}
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                    isActive
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-[var(--border)]'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Section 4: MCP Servers ── */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--ink-secondary)] uppercase tracking-wide">
          MCP 服务器
        </h3>

        {globallyEnabledServers.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-tertiary)]">暂无全局启用的 MCP 服务器</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              {globallyEnabledServers.map((server) => {
                const enabled = isMcpServerEnabled(server.id);
                return (
                  <div
                    key={server.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-2.5 bg-[var(--paper)]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-[var(--ink)]">
                        {server.name}
                      </span>
                      {server.description && (
                        <span className="text-[12px] text-[var(--ink-tertiary)]">
                          {server.description}
                        </span>
                      )}
                    </div>
                    {/* Toggle switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => handleMcpToggle(server.id, !enabled)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none ${
                        enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
                          enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            {allMcpOff && (
              <p className="text-[12px] text-[var(--ink-tertiary)] mt-1">
                全部取消 = 使用全局启用列表
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
