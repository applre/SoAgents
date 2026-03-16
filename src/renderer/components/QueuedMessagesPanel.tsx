import { Play, X } from 'lucide-react';
import type { QueuedMessageInfo } from '../../shared/types/queue';

interface Props {
  queuedMessages: QueuedMessageInfo[];
  onCancel: (queueId: string) => void;
  onForceExecute: (queueId: string) => void;
}

export default function QueuedMessagesPanel({ queuedMessages, onCancel, onForceExecute }: Props) {
  if (queuedMessages.length === 0) return null;

  return (
    <div className="border-t border-[var(--border)] bg-[var(--paper)] px-6 py-2 mx-auto w-full" style={{ maxWidth: 860 }}>
      <div className="mb-1 text-[12px] font-medium text-[var(--ink-tertiary)]">
        排队中 ({queuedMessages.length})
      </div>
      <div className="flex flex-col gap-1">
        {queuedMessages.map((msg) => (
          <div
            key={msg.queueId}
            className="group flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] text-[var(--ink)] bg-[var(--surface)] hover:bg-[var(--hover)] transition-colors"
          >
            <span className="flex-1 truncate">
              {msg.text.length > 60 ? msg.text.slice(0, 60) + '…' : msg.text}
            </span>
            <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onForceExecute(msg.queueId)}
                className="rounded p-1 text-[var(--ink-tertiary)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition-colors"
                title="立即发送"
              >
                <Play size={14} />
              </button>
              <button
                type="button"
                onClick={() => onCancel(msg.queueId)}
                className="rounded p-1 text-[var(--ink-tertiary)] hover:bg-[var(--error)]/10 hover:text-[var(--error)] transition-colors"
                title="取消"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
