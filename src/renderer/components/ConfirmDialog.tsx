import { useEffect, useCallback } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  }, [onConfirm, onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--paper)] shadow-2xl">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="text-[14px] font-semibold text-[var(--ink)]">{title}</div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] leading-relaxed text-[var(--ink-secondary)]">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-1.5 text-[12px] font-medium text-white transition-colors ${
              danger
                ? 'bg-[var(--error)] hover:brightness-110'
                : 'bg-[var(--accent)] hover:opacity-90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
