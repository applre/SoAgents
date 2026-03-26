import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import type { ImAgentConfig } from '../../../shared/types/imAgent';
import type { ImBotStatus, ImStatus } from '../../../shared/types/im';
import { DEFAULT_IM_AGENT_CONFIG } from '../../../shared/types/imAgent';
import {
  getAgents,
  persistAgent,
  removeAgent,
  getAllChannelsStatus,
  stopAgentChannel,
} from '../../config/imAgentConfigService';
import { ImAgentSettingsPanel } from './ImAgentSettingsPanel';

interface ImAgentCardListProps {
  onSelectAgent?: (agent: ImAgentConfig) => void;
}

function StatusDot({ status }: { status: ImStatus }) {
  const colorMap: Record<ImStatus, string> = {
    online: 'var(--success)',
    connecting: '#eab308',
    error: 'var(--error)',
    stopped: 'var(--ink-tertiary)',
  };
  return (
    <span
      className="w-2 h-2 rounded-full inline-block shrink-0"
      style={{ background: colorMap[status] }}
    />
  );
}

function channelStatusKey(agentId: string, channelId: string) {
  return `${agentId}:${channelId}`;
}

export function ImAgentCardList({ onSelectAgent: _onSelectAgent }: ImAgentCardListProps) {
  const [agents, setAgents] = useState<ImAgentConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ImBotStatus>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentWorkspace, setNewAgentWorkspace] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<ImAgentConfig | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const list = await getAgents();
      setAgents(list);
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  }, []);

  const pollStatuses = useCallback(async () => {
    try {
      const result = await getAllChannelsStatus();
      setStatuses(result);
    } catch (err) {
      console.error('Failed to poll channel statuses:', err);
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  // Count total channels across all agents for polling decision
  const totalChannelCount = agents.reduce((sum, a) => sum + a.channels.length, 0);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (totalChannelCount > 0) {
      void pollStatuses();
      intervalRef.current = setInterval(() => {
        void pollStatuses();
      }, 5000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [totalChannelCount, pollStatuses]);

  const handleSelectWorkspace = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      setNewAgentWorkspace(selected);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newAgentName.trim() || !newAgentWorkspace.trim()) return;
    setCreating(true);
    try {
      const newAgent: ImAgentConfig = {
        ...DEFAULT_IM_AGENT_CONFIG,
        id: crypto.randomUUID(),
        name: newAgentName.trim(),
        workspacePath: newAgentWorkspace.trim(),
        enabled: true,
        permissionMode: 'bypassPermissions',
        channels: [],
      };
      await persistAgent(newAgent);
      await loadAgents();
      setShowCreateDialog(false);
      setNewAgentName('');
      setNewAgentWorkspace('');
    } catch (err) {
      console.error('Failed to create agent:', err);
    } finally {
      setCreating(false);
    }
  }, [newAgentName, newAgentWorkspace, loadAgents]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingAgentId) return;
    const agent = agents.find((a) => a.id === deletingAgentId);
    if (agent) {
      for (const ch of agent.channels) {
        try {
          await stopAgentChannel(agent.id, ch.id);
        } catch {
          // ignore stop errors
        }
      }
    }
    try {
      await removeAgent(deletingAgentId);
      await loadAgents();
    } catch (err) {
      console.error('Failed to remove agent:', err);
    }
    setDeletingAgentId(null);
  }, [deletingAgentId, agents, loadAgents]);

  const handleCancelCreate = useCallback(() => {
    setShowCreateDialog(false);
    setNewAgentName('');
    setNewAgentWorkspace('');
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <h2 className="text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>
          Messaging
        </h2>
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={14} />
          Create Agent
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--surface)' }}
            >
              <MessageSquare size={22} style={{ color: 'var(--ink-tertiary)' }} />
            </div>
            <p className="text-[14px]" style={{ color: 'var(--ink-tertiary)' }}>
              No agents yet. Create one to get started.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={14} />
              Create Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {agents.map((agent) => {
              const channelStatuses = agent.channels.map((ch) => {
                const key = channelStatusKey(agent.id, ch.id);
                return statuses[key]?.status ?? 'stopped';
              });

              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="relative group p-4 rounded-lg border border-[var(--border)] bg-[var(--paper)] cursor-pointer transition-colors hover:bg-[var(--hover)]"
                >
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingAgentId(agent.id);
                    }}
                    className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--hover)]"
                    style={{ color: 'var(--ink-tertiary)' }}
                  >
                    <Trash2 size={13} />
                  </button>

                  {/* Agent name */}
                  <p className="text-[14px] font-medium pr-7 truncate" style={{ color: 'var(--ink)' }}>
                    {agent.name}
                  </p>

                  {/* Workspace path */}
                  <p
                    className="text-[12px] mt-1 truncate"
                    style={{ color: 'var(--ink-tertiary)' }}
                    title={agent.workspacePath}
                  >
                    {agent.workspacePath}
                  </p>

                  {/* Channel count + statuses */}
                  <div className="flex items-center gap-2 mt-3">
                    <span
                      className="text-[12px] px-2 py-0.5 rounded-full"
                      style={{
                        color: 'var(--ink-secondary)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {agent.channels.length === 1
                        ? '1 channel'
                        : `${agent.channels.length} channels`}
                    </span>
                    {channelStatuses.length > 0 && (
                      <div className="flex items-center gap-1">
                        {channelStatuses.map((status, i) => (
                          <StatusDot key={i} status={status} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Agent Modal */}
      {showCreateDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={handleCancelCreate}
        >
          <div
            className="w-[400px] rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--paper)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>
              Create Agent
            </h3>

            {/* Agent Name */}
            <div className="mb-4">
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-secondary)' }}>
                Agent Name
              </label>
              <input
                type="text"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="My Telegram Agent"
                className="w-full rounded-lg px-3 py-2 text-[14px] border outline-none transition-colors"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--ink)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                autoFocus
              />
            </div>

            {/* Workspace Path */}
            <div className="mb-6">
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-secondary)' }}>
                Workspace Folder
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAgentWorkspace}
                  readOnly
                  placeholder="Select a folder..."
                  className="flex-1 rounded-lg px-3 py-2 text-[14px] border outline-none truncate"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: newAgentWorkspace ? 'var(--ink)' : 'var(--ink-tertiary)',
                    cursor: 'default',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSelectWorkspace}
                  className="px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors hover:bg-[var(--hover)] shrink-0"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelCreate}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors hover:bg-[var(--hover)]"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleCreate(); }}
                disabled={!newAgentName.trim() || !newAgentWorkspace.trim() || creating}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent)' }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingAgentId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setDeletingAgentId(null)}
        >
          <div
            className="w-[400px] rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--paper)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              Delete Agent
            </h3>
            <p className="text-[14px] mb-6" style={{ color: 'var(--ink-secondary)' }}>
              This will stop all running channels and permanently delete the agent. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingAgentId(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors hover:bg-[var(--hover)]"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleDeleteConfirm(); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
                style={{ background: 'var(--error)' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Settings Panel */}
      {selectedAgent && (
        <ImAgentSettingsPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onSave={(updated) => {
            void (async () => {
              try {
                await persistAgent(updated);
                await loadAgents();
              } catch (err) {
                console.error('Failed to save agent:', err);
              }
              setSelectedAgent(null);
            })();
          }}
          onDelete={() => {
            const agent = selectedAgent;
            void (async () => {
              for (const ch of agent.channels) {
                try {
                  await stopAgentChannel(agent.id, ch.id);
                } catch {
                  // ignore stop errors
                }
              }
              try {
                await removeAgent(agent.id);
                await loadAgents();
              } catch (err) {
                console.error('Failed to remove agent:', err);
              }
              setSelectedAgent(null);
            })();
          }}
        />
      )}
    </div>
  );
}
