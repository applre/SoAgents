import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { ImAgentConfig } from '../../../shared/types/imAgent';
import type { ImBotStatus } from '../../../shared/types/im';
import { getAllChannelsStatus } from '../../config/imAgentConfigService';
import { AgentBasicsSection } from './sections/AgentBasicsSection';
import { AgentChannelsSection } from './sections/AgentChannelsSection';
import { AgentToolsSection } from './sections/AgentToolsSection';

type TabId = 'basics' | 'channels' | 'tools';

const TABS: { id: TabId; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'channels', label: 'Channels' },
  { id: 'tools', label: 'Tools' },
];

interface ImAgentSettingsPanelProps {
  agent: ImAgentConfig;
  onClose: () => void;
  onSave: (updated: ImAgentConfig) => void;
  onDelete: () => void;
}

export function ImAgentSettingsPanel({
  agent,
  onClose,
  onSave,
  onDelete,
}: ImAgentSettingsPanelProps) {
  const [edited, setEdited] = useState<ImAgentConfig>(() => ({ ...agent }));
  const [activeTab, setActiveTab] = useState<TabId>('basics');
  const [statuses, setStatuses] = useState<Record<string, ImBotStatus>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll channel statuses
  const pollStatuses = useCallback(async () => {
    try {
      const result = await getAllChannelsStatus();
      setStatuses(result);
    } catch (err) {
      console.error('Failed to poll channel statuses:', err);
    }
  }, []);

  const channelCount = edited.channels.length;

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (channelCount > 0) {
      intervalRef.current = setInterval(() => {
        void pollStatuses();
      }, 5000);
      // Trigger an initial poll on next tick to avoid set-state-in-effect lint rule
      const initialTimer = setTimeout(() => { void pollStatuses(); }, 0);
      return () => {
        clearTimeout(initialTimer);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [channelCount, pollStatuses]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleSave = useCallback(() => {
    onSave(edited);
  }, [edited, onSave]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    onDelete();
  }, [onDelete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleOverlayClick}
    >
      <div
        className="flex flex-col rounded-2xl shadow-2xl"
        style={{
          background: 'var(--paper)',
          width: 560,
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-[16px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
            {edited.name || 'Agent Settings'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--hover)]"
            style={{ color: 'var(--ink-tertiary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div
          className="flex items-center gap-1 px-6 pt-3 pb-0 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="px-3 py-2 text-[13px] font-medium rounded-t-md transition-colors relative"
              style={{
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--ink-secondary)',
                background: 'transparent',
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'basics' && (
            <AgentBasicsSection agent={edited} onChange={setEdited} />
          )}
          {activeTab === 'channels' && (
            <AgentChannelsSection
              agent={edited}
              onChange={setEdited}
              statuses={statuses}
            />
          )}
          {activeTab === 'tools' && (
            <AgentToolsSection agent={edited} onChange={setEdited} />
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={handleDeleteClick}
            className="px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors hover:bg-[var(--error-bg)]"
            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
          >
            Delete Agent
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors hover:bg-[var(--hover)]"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="w-[400px] rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--paper)' }}
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
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors hover:bg-[var(--hover)]"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
                style={{ background: 'var(--error)' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
