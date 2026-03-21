import { Clock, Play, X } from 'lucide-react';
import type { QueuedMessageInfo } from '../../shared/types/queue';

interface Props {
  queuedMessages: QueuedMessageInfo[];
  onCancel: (queueId: string) => void;
  onForceExecute: (queueId: string) => void;
}

export default function QueuedMessagesPanel({ queuedMessages, onCancel, onForceExecute }: Props) {
  if (queuedMessages.length === 0) return null;

  return (
    <div className="mb-2 flex justify-end">
      <div
        className="min-w-[120px] max-w-[33%] rounded-xl border border-[var(--border)] px-3 py-2 shadow-sm backdrop-blur-sm"
        style={{ backgroundColor: 'color-mix(in srgb, var(--paper) 88%, transparent)' }}
      >
        {/* Header */}
        <div className="mb-1.5 flex items-center gap-1 text-[12px] text-[var(--ink-tertiary)]">
          <Clock size={11} />
          <span>排队中 ({queuedMessages.length})</span>
        </div>

        {/* Message list */}
        <div className="space-y-1">
          {queuedMessages.map((msg) => (
            <div key={msg.queueId} className="group flex items-center gap-1.5">
              {/* Message text */}
              <div className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink)]">
                {msg.text.length > 60 ? msg.text.slice(0, 60) + '...' : msg.text}
              </div>

              {/* Images indicator */}
              {msg.images && msg.images.length > 0 && (
                <div className="flex shrink-0 gap-0.5">
                  {msg.images.slice(0, 2).map((img) => (
                    <div key={img.id} className="h-5 w-5 overflow-hidden rounded border border-[var(--ink-tertiary)]/20">
                      <img src={img.preview} alt={img.name} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons — visible on hover */}
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onForceExecute(msg.queueId)}
                  title="立即发送"
                  className="rounded p-0.5 text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
                >
                  <Play size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onCancel(msg.queueId)}
                  title="取消排队"
                  className="rounded p-0.5 text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
