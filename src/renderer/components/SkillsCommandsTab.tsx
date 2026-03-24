import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, ExternalLink } from 'lucide-react';
import { globalApiGetJson, globalApiPostJson, globalApiPutJson } from '../api/apiFetch';
import { useToast } from './Toast';
import type { SkillItem } from '../../shared/types/skill';
import type { CommandItem } from '../../shared/types/command';
import type { AgentItem, AgentWorkspaceConfig } from '../../shared/types/agent';

interface Props {
  agentDir: string;
  onOpenSkill: (name: string, scope: 'user' | 'project') => void;
  onOpenCommand: (fileName: string, scope: 'user' | 'project') => void;
  onOpenAgent: (folderName: string, scope: 'user' | 'project') => void;
  onNewSkill: () => void;
  onNewCommand: () => void;
  onNewAgent: () => void;
}

function ScopeBadge({ source }: { source: 'user' | 'project' }) {
  if (source === 'project') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--accent)] text-white">
        项目
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--hover)] text-[var(--ink-secondary)]">
      全局
    </span>
  );
}

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!enabled);
      }}
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
  );
}

function SectionHeader({
  title,
  onNew,
}: {
  title: string;
  onNew: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[14px] font-semibold text-[var(--ink)]">{title}</h3>
      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-1 text-[13px] text-[var(--ink-secondary)] hover:text-[var(--ink)] border border-[var(--border)] rounded-lg px-2 py-1 hover:bg-[var(--hover)] transition-colors"
      >
        <Plus size={13} />
        <span>New</span>
      </button>
    </div>
  );
}

export default function SkillsCommandsTab({
  agentDir,
  onOpenSkill,
  onOpenCommand,
  onOpenAgent,
  onNewSkill,
  onNewCommand,
  onNewAgent,
}: Props) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const loadAll = useCallback(async (dir: string, signal: AbortSignal) => {
    setLoading(true);
    const encoded = encodeURIComponent(dir);
    try {
      const [s, c, a] = await Promise.all([
        globalApiGetJson<SkillItem[]>(`/api/skills?agentDir=${encoded}`),
        globalApiGetJson<CommandItem[]>(`/api/command-items?scope=all&agentDir=${encoded}`),
        globalApiGetJson<AgentItem[]>(`/api/agents?scope=all&agentDir=${encoded}`),
      ]);
      if (signal.aborted) return;
      setSkills(s);
      setCommands(c);
      setAgents(a);
    } catch {
      if (signal.aborted) return;
      setSkills([]);
      setCommands([]);
      setAgents([]);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAll(agentDir, controller.signal);
    return () => controller.abort();
  }, [agentDir, loadAll]);

  const handleSkillToggle = useCallback(
    async (skill: SkillItem) => {
      const next = !skill.enabled;
      setSkills((prev) =>
        prev.map((s) => (s.name === skill.name ? { ...s, enabled: next } : s))
      );
      try {
        await globalApiPostJson('/api/skills/toggle', { name: skill.name, enabled: next });
      } catch {
        // revert on error
        setSkills((prev) =>
          prev.map((s) => (s.name === skill.name ? { ...s, enabled: skill.enabled } : s))
        );
      }
    },
    []
  );

  const handleAgentToggle = useCallback(
    async (agent: AgentItem) => {
      const next = !agent.enabled;
      // Optimistic update
      setAgents((prev) =>
        prev.map((a) => (a.folderName === agent.folderName ? { ...a, enabled: next } : a))
      );
      try {
        // Build workspace config from current agents + the toggle
        const local: Record<string, { enabled: boolean }> = {};
        const global_refs: Record<string, { enabled: boolean }> = {};
        for (const a of agentsRef.current) {
          const enabled = a.folderName === agent.folderName ? next : a.enabled;
          if (a.source === 'project') {
            local[a.folderName] = { enabled };
          } else {
            global_refs[a.folderName] = { enabled };
          }
        }
        const config: AgentWorkspaceConfig = { local, global_refs };
        await globalApiPutJson('/api/agents/workspace-config', { agentDir, config });
      } catch {
        // Revert on error
        setAgents((prev) =>
          prev.map((a) => (a.folderName === agent.folderName ? { ...a, enabled: agent.enabled } : a))
        );
      }
    },
    [agentDir]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[14px] text-[var(--ink-tertiary)]">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Section 1: Skills */}
      <section>
        <SectionHeader title="Skills 技能" onNew={onNewSkill} />
        {skills.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-tertiary)] py-4">暂无技能</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {skills.map((skill) => (
              <div
                key={skill.name}
                onClick={() => onOpenSkill(skill.name, skill.source)}
                className="flex flex-col gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--ink)] truncate flex-1">
                    {skill.name}
                  </span>
                  <ToggleSwitch enabled={skill.enabled} onChange={() => handleSkillToggle(skill)} />
                </div>
                <p className="text-[12px] text-[var(--ink-secondary)] line-clamp-2 leading-relaxed">
                  {skill.description || '暂无描述'}
                </p>
                <div className="flex items-center gap-1 mt-auto">
                  <ScopeBadge source={skill.source} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Commands */}
      <section>
        <SectionHeader title="Commands 命令" onNew={onNewCommand} />
        {commands.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-tertiary)] py-4">暂无命令</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {commands.map((cmd) => (
              <div
                key={`${cmd.source}-${cmd.fileName}`}
                onClick={() => onOpenCommand(cmd.fileName, cmd.source)}
                className="flex flex-col gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] cursor-pointer transition-colors"
              >
                <span className="text-[13px] font-medium text-[var(--ink)] truncate">
                  /{cmd.name}
                </span>
                <p className="text-[12px] text-[var(--ink-secondary)] line-clamp-2 leading-relaxed">
                  {cmd.description || '暂无描述'}
                </p>
                <div className="flex items-center gap-1 mt-auto">
                  <ScopeBadge source={cmd.source} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Sub-Agents */}
      <section>
        <SectionHeader title="Sub-Agents 子智能体" onNew={onNewAgent} />
        {agents.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-tertiary)] py-4">暂无子智能体</p>
        ) : (
          <div className="flex flex-col gap-2">
            {agents.map((agent) => (
              <div
                key={`${agent.source}-${agent.folderName}`}
                onClick={() => onOpenAgent(agent.folderName, agent.source)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[var(--ink)] truncate">
                      {agent.name}
                    </span>
                    <ScopeBadge source={agent.source} />
                  </div>
                  {agent.description && (
                    <p className="text-[12px] text-[var(--ink-secondary)] truncate mt-0.5">
                      {agent.description}
                    </p>
                  )}
                </div>
                <ToggleSwitch enabled={agent.enabled} onChange={() => handleAgentToggle(agent)} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bottom link */}
      <div className="pt-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => toast.info('功能开发中')}
          className="flex items-center gap-1 text-[13px] text-[var(--accent)] hover:opacity-80 transition-opacity"
        >
          <span>查看全局技能库</span>
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}
