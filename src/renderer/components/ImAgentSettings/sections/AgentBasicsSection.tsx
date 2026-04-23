/**
 * @deprecated Use WorkspaceGeneralTab Card 1 instead.
 */
import { useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import type { AgentConfig } from '../../../../shared/types/agentConfig';
import type { Provider } from '../../../../shared/types/config';
import { loadAppConfig } from '../../../config/configService';
import CustomSelect from '../../CustomSelect';

interface AgentBasicsSectionProps {
  agent: AgentConfig;
  onChange: (updated: AgentConfig) => void;
}

type PermissionMode = 'plan' | 'acceptEdits' | 'bypassPermissions';

const PERMISSION_OPTIONS: { value: PermissionMode; label: string; description: string }[] = [
  { value: 'plan', label: 'Plan', description: 'AI asks before acting' },
  { value: 'acceptEdits', label: 'Accept Edits', description: 'AI acts, you review' },
  { value: 'bypassPermissions', label: 'Full Agency', description: 'AI acts autonomously' },
];

export function AgentBasicsSection({ agent, onChange }: AgentBasicsSectionProps) {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadAppConfig().then((config) => {
      if (cancelled) return;
      import('../../../../shared/providers').then(({ PROVIDERS }) => {
        if (cancelled) return;
        const custom = config.customProviders ?? [];
        setProviders([...PROVIDERS, ...custom]);
      }).catch(() => {
        if (cancelled) return;
        setProviders([]);
      });
    });
    return () => { cancelled = true; };
  }, []);

  const providerOptions = providers.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const currentPermissionMode = (agent.permissionMode as PermissionMode) ?? 'bypassPermissions';

  return (
    <div className="space-y-5">
      {/* Agent Name */}
      <div>
        <label
          className="block text-[13px] font-medium mb-1.5"
          style={{ color: 'var(--ink-secondary)' }}
        >
          Agent Name
        </label>
        <input
          type="text"
          value={agent.name}
          onChange={(e) => onChange({ ...agent, name: e.target.value })}
          className="w-full rounded-lg px-3 py-2 text-[14px] border outline-none transition-colors"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {/* Workspace Path */}
      <div>
        <label
          className="block text-[13px] font-medium mb-1.5"
          style={{ color: 'var(--ink-secondary)' }}
        >
          Workspace Path
        </label>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 border"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <Folder size={14} style={{ color: 'var(--ink-tertiary)', flexShrink: 0 }} />
          <span
            className="text-[14px] truncate flex-1"
            style={{ color: 'var(--ink-secondary)' }}
            title={agent.workspacePath}
          >
            {agent.workspacePath || 'Not set'}
          </span>
        </div>
      </div>

      {/* Default Provider */}
      <div>
        <label
          className="block text-[13px] font-medium mb-1.5"
          style={{ color: 'var(--ink-secondary)' }}
        >
          Default Provider
        </label>
        <CustomSelect
          value={agent.providerId ?? ''}
          options={providerOptions}
          onChange={(value) => onChange({ ...agent, providerId: value })}
          placeholder="Select provider..."
          className="w-full"
        />
      </div>

      {/* Default Model */}
      <div>
        <label
          className="block text-[13px] font-medium mb-1.5"
          style={{ color: 'var(--ink-secondary)' }}
        >
          Default Model
        </label>
        <input
          type="text"
          value={agent.model ?? ''}
          onChange={(e) => onChange({ ...agent, model: e.target.value })}
          placeholder="e.g. claude-sonnet-4-6"
          className="w-full rounded-lg px-3 py-2 text-[14px] border outline-none transition-colors"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {/* Permission Mode */}
      <div>
        <label
          className="block text-[13px] font-medium mb-2"
          style={{ color: 'var(--ink-secondary)' }}
        >
          Permission Mode
        </label>
        <div className="space-y-2">
          {PERMISSION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer border transition-colors"
              style={{
                borderColor: currentPermissionMode === opt.value ? 'var(--accent)' : 'var(--border)',
                background: currentPermissionMode === opt.value ? 'rgba(194, 109, 58, 0.05)' : 'var(--surface)',
              }}
            >
              <input
                type="radio"
                name={`permission-mode-${agent.id}`}
                value={opt.value}
                checked={currentPermissionMode === opt.value}
                onChange={() => onChange({ ...agent, permissionMode: opt.value })}
                className="shrink-0 accent-[var(--accent)]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                  {opt.label}
                </p>
                <p className="text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
