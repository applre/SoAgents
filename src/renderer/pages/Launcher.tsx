import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '../utils/env';

const RECENT_DIRS_KEY = 'soagents:recent-dirs';
const MAX_RECENT = 8;

function loadRecentDirs(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_DIRS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentDir(dir: string): void {
  const recent = loadRecentDirs().filter((d) => d !== dir);
  localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify([dir, ...recent].slice(0, MAX_RECENT)));
}

interface Props {
  tabId: string;
  onSelectWorkspace: (tabId: string, agentDir: string) => void;
}

export default function Launcher({ tabId, onSelectWorkspace }: Props) {
  const [recentDirs, setRecentDirs] = useState<string[]>(loadRecentDirs);
  const [manualPath, setManualPath] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState('');

  const handleSelect = useCallback(
    (dir: string) => {
      const trimmed = dir.trim();
      if (!trimmed) return;
      saveRecentDir(trimmed);
      setRecentDirs(loadRecentDirs());
      onSelectWorkspace(tabId, trimmed);
    },
    [tabId, onSelectWorkspace]
  );

  const handleOpenDialog = useCallback(async () => {
    if (!isTauri()) {
      setShowManual(true);
      return;
    }
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === 'string' && selected) {
        handleSelect(selected);
      }
    } catch (e) {
      console.error('Dialog error:', e);
      setShowManual(true);
    }
  }, [handleSelect]);

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualPath.trim();
    if (!trimmed) {
      setError('请输入有效路径');
      return;
    }
    setError('');
    handleSelect(trimmed);
  }, [manualPath, handleSelect]);

  const handleRemoveRecent = useCallback((dir: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = loadRecentDirs().filter((d) => d !== dir);
    localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(updated));
    setRecentDirs(updated);
  }, []);

  const dirBasename = (path: string) => path.split('/').filter(Boolean).pop() ?? path;
  const dirParent = (path: string) => {
    const parts = path.split('/').filter(Boolean);
    return parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/';
  };

  return (
    <div className="flex h-full items-center justify-center bg-[var(--paper)]">
      <div className="w-full max-w-md px-6">
        {/* 标题 */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex items-center justify-center">
            <svg className="h-10 w-10 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[var(--ink)]">选择工作区</h1>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">选择项目目录，AI 将在该目录下工作</p>
        </div>

        {/* 主操作按钮 */}
        <button
          onClick={handleOpenDialog}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
            <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
          </svg>
          选择文件夹
        </button>

        {/* 手动输入 */}
        {showManual ? (
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="/Users/yourname/projects/myproject"
                autoFocus
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                onClick={handleManualSubmit}
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white hover:opacity-90"
              >
                确认
              </button>
            </div>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <button
            onClick={() => setShowManual(true)}
            className="mb-6 w-full text-center text-xs text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors"
          >
            手动输入路径
          </button>
        )}

        {/* 最近工作区 */}
        {recentDirs.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">最近工作区</p>
            <div className="space-y-1">
              {recentDirs.map((dir) => (
                <button
                  key={dir}
                  onClick={() => handleSelect(dir)}
                  className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-[var(--hover)] transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <svg className="h-4 w-4 shrink-0 text-[var(--ink-tertiary)]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">{dirBasename(dir)}</p>
                      <p className="truncate text-xs text-[var(--ink-tertiary)]">{dirParent(dir)}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleRemoveRecent(dir, e)}
                    className="ml-2 shrink-0 rounded p-0.5 text-[var(--ink-tertiary)] opacity-0 group-hover:opacity-100 hover:bg-[var(--border)] transition-opacity"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
