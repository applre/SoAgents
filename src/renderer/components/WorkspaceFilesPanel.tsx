import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, FileText, Folder } from 'lucide-react';
import { globalApiGetJson } from '../api/apiFetch';
import { isTauri } from '../utils/env';

interface FileEntry {
  name: string;
  type: 'file' | 'dir';
  path: string;
}

interface Props {
  agentDir: string | null;
}

export default function WorkspaceFilesPanel({ agentDir }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (retryMs?: number) => {
    if (!agentDir) return;
    setLoading(true);
    try {
      const data = await globalApiGetJson<FileEntry[]>(
        `/api/dir-files?path=${encodeURIComponent(agentDir)}`
      );
      setFiles(data);
    } catch (e) {
      if (retryMs) {
        // 全局 sidecar 可能还在启动，等待后重试一次
        setTimeout(() => {
          refresh().catch(console.error);
        }, retryMs);
        return; // 保持 loading 状态直到重试
      }
      console.error(e);
    } finally {
      if (!retryMs) setLoading(false);
    }
  }, [agentDir]);

  useEffect(() => {
    // 首次加载：失败后 2s 自动重试（等待全局 sidecar 就绪）
    refresh(2000);
  }, [refresh]);

  const handleOpenExternal = useCallback(async () => {
    if (!agentDir || !isTauri()) return;
    const { open } = await import('@tauri-apps/plugin-shell');
    open(agentDir).catch(console.error);
  }, [agentDir]);

  const dirName = agentDir?.split('/').filter(Boolean).pop() ?? '工作区';

  return (
    <div
      className="flex h-full flex-col border-l border-[var(--border)] bg-[var(--paper)]"
      style={{ width: 280, minWidth: 280 }}
    >
      {/* 顶部标题 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--ink)]">工作区文件</p>
          <p className="text-[12px] text-[var(--ink-tertiary)] truncate">{dirName}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => refresh()}
            title="刷新"
            className="p-1.5 rounded hover:bg-[var(--hover)] transition-colors text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleOpenExternal}
            title="在 Finder 中打开"
            className="p-1.5 rounded hover:bg-[var(--hover)] transition-colors text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Tab 切换（仅展示所有文件） */}
      <div className="flex border-b border-[var(--border)] px-3">
        <button className="px-2 py-2 text-[13px] font-medium text-[var(--accent)] border-b-2 border-[var(--accent)]">
          所有文件
        </button>
      </div>

      {/* 文件列表 */}
      <div className="flex-1 overflow-y-auto py-1">
        {!agentDir ? (
          <p className="px-4 py-3 text-[13px] text-[var(--ink-tertiary)]">未选择工作区</p>
        ) : loading && files.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-[var(--ink-tertiary)]">加载中…</p>
        ) : files.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-[var(--ink-tertiary)]">空目录</p>
        ) : (
          files.map((f) => (
            <div
              key={f.path}
              className="flex items-center gap-2 px-4 py-1.5 hover:bg-[var(--hover)] transition-colors cursor-pointer"
            >
              {f.type === 'dir' ? (
                <Folder size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
              ) : (
                <FileText size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
              )}
              <span className="text-[13px] text-[var(--ink)] truncate">{f.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
