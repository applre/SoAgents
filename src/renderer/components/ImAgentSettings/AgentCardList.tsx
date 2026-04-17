// Agent card list for Settings page — shows all agents with status indicators
import { useMemo } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useAgentStatuses } from '../../hooks/useAgentStatuses';
import type { AgentConfig } from '../../../shared/types/agentConfig';
import type { WorkspaceEntry } from '../../../shared/types/workspace';
import { Bot } from 'lucide-react';

interface AgentCardListProps {
  onSelectAgent: (agentId: string, workspacePath: string) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  telegram: 'TG',
  feishu: '飞书',
  dingtalk: '钉钉',
};

function getStatusColor(onlineCount: number, totalCount: number, enabled: boolean): string {
  if (!enabled) return 'var(--ink-tertiary)';
  if (totalCount === 0) return 'var(--ink-tertiary)';
  if (onlineCount === totalCount) return 'var(--success)';
  if (onlineCount > 0) return '#d4a017'; // warning
  return 'var(--ink-tertiary)';
}

function shortenPath(path: string): string {
  const home = path.replace(/^\/Users\/[^/]+/, '~');
  return home;
}

export default function AgentCardList({ onSelectAgent }: AgentCardListProps) {
  const { config, workspaces, allProviders } = useConfig();
  const { statuses } = useAgentStatuses();

  const agents: AgentConfig[] = useMemo(() => config.agents ?? [], [config.agents]);

  const wsByAgentId = useMemo(() => {
    const map = new Map<string, WorkspaceEntry>();
    for (const w of workspaces) {
      if (w.agentId) map.set(w.agentId, w);
    }
    return map;
  }, [workspaces]);

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border)] px-8 py-16">
        <Bot className="h-8 w-8 text-[var(--ink-tertiary)]" />
        <p className="mt-3 text-sm text-[var(--ink-tertiary)]">
          尚未创建 Agent。在工作区设置中可以将工作区升级为 Agent。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {agents.map((agent) => {
        const agentStatus = statuses[agent.id];
        const onlineChannels = agentStatus?.channels.filter((ch) => ch.status === 'online').length ?? 0;
        const totalChannels = agent.channels?.length ?? 0;
        const statusColor = getStatusColor(onlineChannels, totalChannels, agent.enabled);
        const ws = wsByAgentId.get(agent.id);
        const displayName = agent.name || ws?.path.split('/').pop() || 'Agent';
        const providerName = allProviders.find((p) => p.id === agent.providerId)?.name;
        const modelDisplay = agent.model || '默认模型';

        return (
          <button
            key={agent.id}
            className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-all hover:border-[var(--accent)]/40 hover:shadow-sm"
            onClick={() => onSelectAgent(agent.id, agent.workspacePath)}
          >
            {/* Icon + status dot */}
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--hover)]">
              <Bot size={16} className="text-[var(--ink-secondary)]" />
              <div
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)]"
                style={{ background: statusColor }}
              />
            </div>

            <div className="min-w-0 flex-1">
              {/* Name + badges */}
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-[var(--ink)]">
                  {displayName}
                </span>
                {!agent.enabled && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[var(--hover)] text-[var(--ink-tertiary)]">
                    已禁用
                  </span>
                )}
              </div>

              {/* Workspace path */}
              <div className="mt-0.5 truncate text-[11px] text-[var(--ink-tertiary)]">
                {shortenPath(agent.workspacePath)}
              </div>

              {/* Channel badges */}
              {totalChannels > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(agent.channels ?? []).map((ch) => (
                    <span key={ch.id} className="rounded px-1.5 py-0.5 text-[10px] bg-[var(--hover)] text-[var(--ink-tertiary)]">
                      {PLATFORM_LABELS[ch.type] || ch.type}
                    </span>
                  ))}
                </div>
              )}

              {/* Status + model */}
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--ink-tertiary)]">
                <span style={{ color: statusColor }}>
                  {onlineChannels > 0 ? `${onlineChannels}/${totalChannels} 在线` : `${totalChannels} 渠道`}
                </span>
                {providerName && (
                  <>
                    <span>·</span>
                    <span className="truncate">{providerName} / {modelDisplay}</span>
                  </>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
