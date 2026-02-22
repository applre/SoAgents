import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '../utils/env';
import { FolderOpen } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 10) return '早上好';
  if (hour < 13) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

interface Props {
  tabId: string;
  onSelectWorkspace: (tabId: string, agentDir: string) => void;
}

export default function Launcher({ tabId, onSelectWorkspace }: Props) {
  const { workspaces, touchWorkspace, removeWorkspace } = useConfig();

  // Sort by lastOpenedAt descending
  const recentWorkspaces = [...workspaces].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

  const handleSelect = useCallback(
    (dir: string) => {
      touchWorkspace(dir);
      onSelectWorkspace(tabId, dir);
    },
    [tabId, onSelectWorkspace, touchWorkspace]
  );

  const handleOpenDialog = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === 'string' && selected) {
        handleSelect(selected);
      }
    } catch (e) {
      console.error('Dialog error:', e);
    }
  }, [handleSelect]);

  const handleRemoveRecent = useCallback((dir: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeWorkspace(dir);
  }, [removeWorkspace]);

  const dirBasename = (path: string) => path.split('/').filter(Boolean).pop() ?? path;
  const dirParent = (path: string) => {
    const parts = path.split('/').filter(Boolean);
    return parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/';
  };

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--paper)] px-8">
      <div className="w-full" style={{ maxWidth: 560 }}>
        {/* 问候语 */}
        <div className="mb-8 text-center">
          <h1 className="text-[26px] font-semibold text-[var(--ink)]">
            👋 {getGreeting()}，选择一个工作区
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-tertiary)]">
            AI 将在该目录下工作
          </p>
        </div>

        {/* 浏览文件夹 */}
        <button
          onClick={handleOpenDialog}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3.5 hover:bg-[var(--hover)] transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)] shrink-0">
            <FolderOpen size={16} className="text-[var(--ink-secondary)]" />
          </div>
          <span className="text-[15px] font-medium text-[var(--ink)]">浏览文件夹</span>
        </button>

        {/* 最近工作区 */}
        {recentWorkspaces.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">最近工作区</p>
            <div className="space-y-1">
              {recentWorkspaces.map((ws) => (
                <div
                  key={ws.path}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(ws.path)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelect(ws.path)}
                  className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 hover:bg-[var(--hover)] transition-colors cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FolderOpen size={15} className="shrink-0 text-[var(--ink-tertiary)]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">{dirBasename(ws.path)}</p>
                      <p className="truncate text-xs text-[var(--ink-tertiary)]">{dirParent(ws.path)}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleRemoveRecent(ws.path, e)}
                    className="ml-2 shrink-0 rounded p-0.5 text-[var(--ink-tertiary)] opacity-0 group-hover:opacity-100 hover:bg-[var(--border)] transition-opacity"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
