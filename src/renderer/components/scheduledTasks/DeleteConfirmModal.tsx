import { AlertTriangle } from 'lucide-react';

interface Props {
  taskName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ taskName, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="rounded-lg p-6 w-[400px]"
        style={{ background: 'var(--paper)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={24} style={{ color: 'var(--error)' }} />
          <h3 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>
            确认删除
          </h3>
        </div>
        <p className="text-[14px] mb-6" style={{ color: 'var(--ink-secondary)' }}>
          确定删除任务 &ldquo;{taskName}&rdquo; 吗？此操作不可撤销。
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-[14px] font-medium transition-colors hover:bg-[var(--hover)]"
            style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-[14px] font-medium text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--error)' }}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
