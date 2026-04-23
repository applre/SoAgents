// Agent channels section: list channels with clickable rows, open unified overlay panel.
// Overlay state machine: null | { view: 'add' } | { view: 'add'; step: 2 } | { view: 'detail'; channelId }
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Loader2, MessageSquare, Send, X } from 'lucide-react';
import type { AgentConfig, ChannelConfig } from '../../../../shared/types/agentConfig';
import type { ImBotStatus } from '../../../../shared/types/im';
import { startAgentChannel, stopAgentChannel } from '../../../config/agentConfigService';
import ChannelWizard from '../channels/ChannelWizard';
import ChannelDetailView from '../channels/ChannelDetailView';

interface AgentChannelsSectionProps {
  agent: AgentConfig;
  onChange: (updated: AgentConfig) => void;
  statuses: Record<string, ImBotStatus>;
}

type OverlayState =
  | null
  | { view: 'add' }
  | { view: 'detail'; channelId: string };

function getPlatformLabel(type: string): string {
  const map: Record<string, string> = {
    telegram: 'Telegram',
    feishu: '飞书',
    dingtalk: '钉钉',
  };
  return map[type] || type;
}

export function AgentChannelsSection({ agent, onChange, statuses }: AgentChannelsSectionProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>(null);

  const closeOverlay = useCallback(() => {
    setOverlay(null);
  }, []);

  const handleStartChannel = useCallback(
    async (channel: ChannelConfig) => {
      setLoading(channel.id);
      try {
        await startAgentChannel(agent, channel);
      } catch (err) {
        console.error('Failed to start channel:', err);
      } finally {
        setLoading(null);
      }
    },
    [agent],
  );

  const handleStopChannel = useCallback(
    async (channelId: string) => {
      setLoading(channelId);
      try {
        await stopAgentChannel(agent.id, channelId);
      } catch (err) {
        console.error('Failed to stop channel:', err);
      } finally {
        setLoading(null);
      }
    },
    [agent.id],
  );

  const handleWizardComplete = useCallback(
    (channel: ChannelConfig) => {
      onChange({ ...agent, channels: [...agent.channels, channel] });
      closeOverlay();
    },
    [agent, onChange, closeOverlay],
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
    async (channelId: string) => {
      const key = `${agent.id}:${channelId}`;
      const status = statuses[key];
      if (status?.status === 'online' || status?.status === 'connecting') {
        try {
          await stopAgentChannel(agent.id, channelId);
        } catch {
          // ignore stop errors
        }
      }
      onChange({
        ...agent,
        channels: agent.channels.filter((ch) => ch.id !== channelId),
      });
      closeOverlay();
    },
    [agent, onChange, statuses, closeOverlay],
  );

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-medium text-[var(--ink)]">聊天机器人 Channels</h3>
          <button
            className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:opacity-90"
            onClick={() => setOverlay({ view: 'add' })}
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </button>
        </div>

        {/* Empty state */}
        {agent.channels.length === 0 && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/30 py-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)]">
              <MessageSquare size={18} className="text-[var(--ink-tertiary)]" />
            </div>
            <p className="text-[12px] text-[var(--ink-tertiary)]">
              尚未添加任何 Channel。点击上方「添加」来添加 IM 渠道。
            </p>
          </div>
        )}

        {/* Channel rows */}
        <div className="space-y-2">
          {agent.channels.map((channel) => {
            const statusKey = `${agent.id}:${channel.id}`;
            const chStatus = statuses[statusKey];
            const isRunning = chStatus?.status === 'online' || chStatus?.status === 'connecting';
            const isLoading = loading === channel.id;

            const displayName = chStatus?.botUsername
              ? (channel.type === 'telegram' ? `@${chStatus.botUsername}` : chStatus.botUsername)
              : (channel.name ? (channel.type === 'telegram' ? `@${channel.name}` : channel.name) : getPlatformLabel(channel.type));

            return (
              <div
                key={channel.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3 transition-all hover:border-[var(--ink-tertiary)]/40 hover:shadow-sm"
                onClick={() => setOverlay({ view: 'detail', channelId: channel.id })}
              >
                {/* Platform icon */}
                <span className="flex-shrink-0">
                  {channel.type === 'telegram' ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-[#0088cc]">
                      <Send className="h-3 w-3 text-white" />
                    </div>
                  ) : (
                    <span className="text-base">💬</span>
                  )}
                </span>

                {/* Name + status */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-[14px] font-medium text-[var(--ink)]">
                    {displayName}
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: isRunning ? 'var(--success)' : 'var(--ink-tertiary)',
                      }}
                    />
                    <span
                      className="text-[12px]"
                      style={{
                        color: isRunning ? 'var(--success)' : 'var(--ink-tertiary)',
                      }}
                    >
                      {isRunning ? '运行中' : '已停止'}
                    </span>
                  </div>
                </div>

                {/* Start / Stop pill */}
                <button
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors disabled:opacity-50 ${
                    isRunning
                      ? 'border border-[var(--error)]/40 text-[var(--error)] hover:bg-[var(--error)]/10'
                      : 'bg-[var(--accent)] text-white hover:opacity-90'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isRunning) {
                      void handleStopChannel(channel.id);
                    } else {
                      void handleStartChannel(channel);
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isRunning ? (
                    '停止'
                  ) : (
                    '启动'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Unified Overlay Panel (Portal) ═══ */}
      {overlay &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={closeOverlay}
          >
            <div
              className="relative flex h-[90vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-[var(--paper)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={closeOverlay}
                className="absolute right-4 top-4 z-10 rounded-lg p-2 text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="mx-auto max-w-2xl">
                  {overlay.view === 'add' && (
                    <ChannelWizard
                      onComplete={handleWizardComplete}
                      onCancel={closeOverlay}
                    />
                  )}
                  {overlay.view === 'detail' && (() => {
                    const ch = agent.channels.find((c) => c.id === overlay.channelId);
                    if (!ch) return <p className="text-center text-[14px] text-[var(--ink-tertiary)]">Channel 未找到</p>;
                    const statusKey = `${agent.id}:${ch.id}`;
                    return (
                      <ChannelDetailView
                        channel={ch}
                        agentId={agent.id}
                        status={statuses[statusKey]}
                        onChange={handleUpdateChannel}
                        onDelete={() => { void handleDeleteChannel(ch.id); }}
                        onStart={() => { void handleStartChannel(ch); }}
                        onStop={() => { void handleStopChannel(ch.id); }}
                        onBack={closeOverlay}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
