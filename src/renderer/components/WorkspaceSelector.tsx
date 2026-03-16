import { useCallback, useEffect, useRef } from 'react';
import { Folder, Check, Plus } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '../utils/env';
import type { WorkspaceEntry } from '../../shared/types/workspace';

interface Props {
  workspaces: WorkspaceEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export default function WorkspaceSelector({ workspaces, selectedPath, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const handleAddWorkspace = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === 'string' && selected) {
        onSelect(selected);
        onClose();
      }
    } catch (e) {
      console.error('Dialog error:', e);
    }
  }, [onSelect, onClose]);

  const dirName = (p: string) => p.split('/').filter(Boolean).pop() ?? p;

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--paper)] py-2"
      style={{ maxWidth: 360, minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
    >
      <p className="px-4 pb-2 text-[12px] font-medium text-[var(--ink-tertiary)]">选择你的工作区</p>
      {workspaces.map((ws) => (
        <button
          key={ws.path}
          onClick={() => { onSelect(ws.path); onClose(); }}
          className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[var(--hover)] transition-colors"
        >
          <Folder size={16} className="shrink-0 text-[var(--ink-tertiary)]" />
          <div className="flex-1 min-w-0">
            <span className="block truncate text-[14px] text-[var(--ink)]">{dirName(ws.path)}</span>
            <span className="block truncate text-[11px] text-[var(--ink-tertiary)]">{ws.path}</span>
          </div>
          {ws.path === selectedPath && <Check size={16} className="shrink-0 text-[var(--accent)]" />}
        </button>
      ))}
      <div className="mt-1 border-t border-[var(--border)] pt-1">
        <button
          onClick={handleAddWorkspace}
          className="flex w-full items-center gap-3 px-4 py-2 text-left text-[var(--accent)] hover:bg-[var(--hover)] transition-colors"
        >
          <Plus size={16} className="shrink-0" />
          <span className="text-[14px] font-medium">添加新工作区</span>
        </button>
      </div>
    </div>
  );
}
