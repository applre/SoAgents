// Agent settings panel — flat layout with section dividers
// Used by Settings page when a card is clicked in AgentCardList
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Bot, ArrowLeft } from 'lucide-react';
import type { AgentConfig } from '../../../shared/types/agentConfig';
import type { ImBotStatus } from '../../../shared/types/im';
import { getAgentById, patchAgentConfig, getAllChannelsStatus, ensureAgentConfig } from '../../config/agentConfigService';
import { loadWorkspaces } from '../../config/workspaceService';
import { PROVIDERS } from '../../../shared/providers';
import { AgentChannelsSection } from './sections/AgentChannelsSection';
import AgentHeartbeatSection from '../AgentHeartbeatSection';
import AgentMemoryUpdateSection from '../AgentMemoryUpdateSection';

interface AgentSettingsPanelProps {
  agentId: string;
  onBack: () => void;
}

export default function AgentSettingsPanel({ agentId, onBack }: AgentSettingsPanelProps) {
  const [agent, setAgent] = useState<AgentConfig | undefined>(undefined);
  const [statuses, setStatuses] = useState<Record<string, ImBotStatus>>({});
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // Load agent. If not present in config.agents, try to recover it by finding
  // a workspace whose agentId matches — this handles legacy data where
  // workspaces.json has an orphan agentId but config.json never stored the
  // matching AgentConfig.
  const loadAgent = useCallback(async () => {
    let a = await getAgentById(agentId);
    if (!a) {
      try {
        const workspaces = await loadWorkspaces();
        const ws = workspaces.find((w) => w.agentId === agentId);
        if (ws) {
          a = await ensureAgentConfig(ws.path);
        }
      } catch (err) {
        console.error('[AgentSettingsPanel] Failed to recover agent:', err);
      }
    }
    if (a) {
      setAgent(a);
      setName(a.name);
    }
  }, [agentId]);

  // Load channel statuses
  const loadStatuses = useCallback(async () => {
    try {
      const result = await getAllChannelsStatus();
      setStatuses(result);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadAgent();
    void loadStatuses();
    const id = setInterval(loadStatuses, 5000);
    return () => clearInterval(id);
  }, [loadAgent, loadStatuses]);

  const handleAgentChanged = useCallback(async () => {
    await loadAgent();
    await loadStatuses();
  }, [loadAgent, loadStatuses]);

  // For AgentChannelsSection: onChange persists the full agent
  const handleAgentUpdate = useCallback(async (updated: AgentConfig) => {
    await patchAgentConfig(updated.id, { channels: updated.channels });
    await handleAgentChanged();
  }, [handleAgentChanged]);

  const handleNameBlur = useCallback(async () => {
    if (!agent || name === agent.name || !name.trim()) return;
    setSaving(true);
    try {
      await patchAgentConfig(agent.id, { name: name.trim() });
      await handleAgentChanged();
    } finally {
      setSaving(false);
    }
  }, [agent, name, handleAgentChanged]);

  const handleToggleEnabled = useCallback(async () => {
    if (!agent) return;
    setSaving(true);
    try {
      await patchAgentConfig(agent.id, { enabled: !agent.enabled });
      await handleAgentChanged();
    } finally {
      setSaving(false);
    }
  }, [agent, handleAgentChanged]);

  const providerName = useMemo(() => {
    if (!agent?.providerId) return undefined;
    return PROVIDERS.find((p) => p.id === agent.providerId)?.name;
  }, [agent?.providerId]);

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-[var(--ink-tertiary)]">
          Agent 未找到 (ID: {agentId})
        </span>
      </div>
    );
  }

  const modelDisplay = agent.model || '默认模型';

  return (
    <div className="space-y-0 pb-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-[13px] text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink)]"
      >
        <ArrowLeft size={14} />
        返回 Agent 列表
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 pb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hover)]">
          <Bot size={20} className="text-[var(--ink-secondary)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-[var(--ink)]">
            {agent.name}
          </h2>
          <span className="text-xs text-[var(--ink-tertiary)]">
            {agent.workspacePath}
          </span>
        </div>
      </div>

      {/* Basics */}
      <div className="border-b border-[var(--border)] pb-6">
        <h3 className="mb-4 text-sm font-semibold text-[var(--ink)]">基础信息</h3>

        {/* Name */}
        <div className="flex items-center gap-3 mb-3">
          <label className="w-20 shrink-0 text-xs text-[var(--ink-tertiary)]">名称</label>
          <input
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void handleNameBlur()}
            disabled={saving}
          />
        </div>

        {/* Provider + Model */}
        <div className="flex items-center gap-3 mb-3">
          <label className="w-20 shrink-0 text-xs text-[var(--ink-tertiary)]">模型</label>
          <span className="text-sm text-[var(--ink)]">
            {providerName ?? '默认'} / {modelDisplay}
          </span>
        </div>

        {/* Permission Mode */}
        <div className="flex items-center gap-3 mb-3">
          <label className="w-20 shrink-0 text-xs text-[var(--ink-tertiary)]">权限</label>
          <span className="text-sm text-[var(--ink)]">
            {agent.permissionMode === 'bypassPermissions' ? '自主行动' :
             agent.permissionMode === 'acceptEdits' ? '接受编辑' : agent.permissionMode}
          </span>
        </div>

        {/* Enable/Disable */}
        <div className="flex items-center gap-3">
          <label className="w-20 shrink-0 text-xs text-[var(--ink-tertiary)]">状态</label>
          <button
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              agent.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
            }`}
            onClick={() => void handleToggleEnabled()}
            disabled={saving}
          >
            <span
              className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                agent.enabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className="text-xs text-[var(--ink-tertiary)]">
            {agent.enabled ? '已启用' : '已禁用'}
          </span>
        </div>
      </div>

      {/* Channels */}
      <div className="border-b border-[var(--border)] pb-6 pt-6">
        <AgentChannelsSection
          agent={agent}
          onChange={handleAgentUpdate}
          statuses={statuses}
        />
      </div>

      {/* Heartbeat */}
      <div className="border-b border-[var(--border)] pb-6 pt-6">
        <AgentHeartbeatSection agent={agent} onAgentChanged={handleAgentChanged} />
      </div>

      {/* Memory Auto-Update */}
      <div className="pt-6">
        <AgentMemoryUpdateSection agent={agent} onAgentChanged={handleAgentChanged} />
      </div>
    </div>
  );
}
