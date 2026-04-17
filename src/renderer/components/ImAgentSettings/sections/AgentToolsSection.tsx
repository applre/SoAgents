/**
 * @deprecated Use WorkspaceGeneralTab Card 1 MCP section instead.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import type { AgentConfig } from '../../../../shared/types/agentConfig';
import type { McpServerDefinition } from '../../../../shared/types/mcp';
import { loadAppConfig } from '../../../config/configService';

interface AgentToolsSectionProps {
  agent: AgentConfig;
  onChange: (updated: AgentConfig) => void;
}

export function AgentToolsSection({ agent, onChange }: AgentToolsSectionProps) {
  const [allServers, setAllServers] = useState<McpServerDefinition[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      import('../../../../shared/mcp-presets').then(({ PRESET_MCP_SERVERS }) => PRESET_MCP_SERVERS),
      loadAppConfig(),
    ]).then(([presets, config]) => {
      if (cancelled) return;
      // Build list: presets + custom servers from config
      const customEntries = Object.entries(config.mcpServers ?? {}).map(([id, def]) => ({
        id,
        name: def.name ?? id,
        description: undefined as string | undefined,
        type: def.type,
        command: def.command,
        args: def.args,
        env: def.env,
        url: def.url,
        headers: def.headers,
        isBuiltin: false,
      })) satisfies McpServerDefinition[];
      setAllServers([...presets, ...customEntries]);
    });
    return () => { cancelled = true; };
  }, []);

  const enabledSet = useMemo(
    () => new Set(agent.mcpEnabledServers ?? []),
    [agent.mcpEnabledServers],
  );

  const handleToggle = useCallback(
    (serverId: string, checked: boolean) => {
      const next = new Set(enabledSet);
      if (checked) {
        next.add(serverId);
      } else {
        next.delete(serverId);
      }
      onChange({ ...agent, mcpEnabledServers: Array.from(next) });
    },
    [agent, onChange, enabledSet],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
          MCP Servers
        </p>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-tertiary)' }}>
          Select which MCP servers are available to this agent
        </p>
      </div>

      {/* Server list */}
      {allServers.length > 0 ? (
        <div className="space-y-1">
          {allServers.map((server) => {
            const checked = enabledSet.has(server.id);
            return (
              <label
                key={server.id}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors hover:bg-[var(--hover)]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => handleToggle(server.id, e.target.checked)}
                  className="mt-0.5 shrink-0 accent-[var(--accent)] cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
                    {server.name}
                  </p>
                  {server.description && (
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-tertiary)' }}>
                      {server.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl py-10 border border-dashed"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--surface)' }}
          >
            <Wrench size={18} style={{ color: 'var(--ink-tertiary)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>
            No MCP servers configured
          </p>
        </div>
      )}
    </div>
  );
}
