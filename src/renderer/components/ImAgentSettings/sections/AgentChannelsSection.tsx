import { useCallback, useState } from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import type { ImAgentConfig, ChannelConfig } from '../../../../shared/types/imAgent';
import type { ImBotStatus } from '../../../../shared/types/im';
import { startAgentChannel, stopAgentChannel } from '../../../config/imAgentConfigService';
import ChannelWizard from '../channels/ChannelWizard';
import ChannelConfigPanel from '../channels/ChannelConfigPanel';

interface AgentChannelsSectionProps {
  agent: ImAgentConfig;
  onChange: (updated: ImAgentConfig) => void;
  statuses: Record<string, ImBotStatus>;
}

export function AgentChannelsSection({ agent, onChange, statuses }: AgentChannelsSectionProps) {
  const [showWizard, setShowWizard] = useState(false);

  const handleWizardComplete = useCallback(
    (channel: ChannelConfig) => {
      onChange({ ...agent, channels: [...agent.channels, channel] });
      setShowWizard(false);
    },
    [agent, onChange],
  );

  const handleUpdateChannel = useCallback(
    (updated: ChannelConfig) => {
      onChange({
        ...agent,
        channels: agent.channels.map((ch) => (ch.id === updated.id ? updated : ch)),
      });
    },
    [agent, onChange],
  );

  const handleDeleteChannel = useCallback(
    async (channel: ChannelConfig) => {
      const key = `${agent.id}:${channel.id}`;
      const status = statuses[key];
      if (status?.status === 'online' || status?.status === 'connecting') {
        try {
          await stopAgentChannel(agent.id, channel.id);
        } catch {
          // ignore stop errors
        }
      }
      onChange({
        ...agent,
        channels: agent.channels.filter((ch) => ch.id !== channel.id),
      });
    },
    [agent, onChange, statuses],
  );

  const handleStartChannel = useCallback(
    async (channel: ChannelConfig) => {
      try {
        await startAgentChannel(agent, channel);
      } catch (err) {
        console.error('Failed to start channel:', err);
      }
    },
    [agent],
  );

  const handleStopChannel = useCallback(
    async (channel: ChannelConfig) => {
      try {
        await stopAgentChannel(agent.id, channel.id);
      } catch (err) {
        console.error('Failed to stop channel:', err);
      }
    },
    [agent],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
          {agent.channels.length === 0
            ? 'No channels configured'
            : `${agent.channels.length} channel${agent.channels.length === 1 ? '' : 's'}`}
        </p>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors hover:bg-[var(--hover)]"
          style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
        >
          <Plus size={13} />
          Add Channel
        </button>
      </div>

      {/* Channel list */}
      {agent.channels.length > 0 ? (
        <div className="space-y-3">
          {agent.channels.map((channel) => {
            const statusKey = `${agent.id}:${channel.id}`;
            const channelStatus = statuses[statusKey];
            return (
              <ChannelConfigPanel
                key={channel.id}
                channel={channel}
                agentId={agent.id}
                status={channelStatus}
                onChange={handleUpdateChannel}
                onDelete={() => { void handleDeleteChannel(channel); }}
                onStart={() => { void handleStartChannel(channel); }}
                onStop={() => { void handleStopChannel(channel); }}
              />
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
            <MessageSquare size={18} style={{ color: 'var(--ink-tertiary)' }} />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              No channels yet
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-tertiary)' }}>
              Add a channel to connect this agent to a messaging platform
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={13} />
            Add Channel
          </button>
        </div>
      )}

      {/* Channel Wizard */}
      {showWizard && (
        <ChannelWizard
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
