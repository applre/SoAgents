import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, FileText, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { globalApiGetJson } from '../api/apiFetch';
import { isTauri } from '../utils/env';

interface FileEntry {
  name: string;
  type: 'file' | 'dir';
  path: string;
}

interface Props {
  agentDir: string | null;
  onOpenFile?: (path: string) => void;
}

// ── 单个树节点 ──────────────────────────────────────────────────
interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  expanded: boolean;
  children: FileEntry[] | undefined;
  onToggleDir: (path: string) => void;
  onOpenFile?: (path: string) => void;
  expandedDirs: Set<string>;
  dirChildren: Record<string, FileEntry[]>;
}

function TreeNode({ entry, depth, expanded, children, onToggleDir, onOpenFile, expandedDirs, dirChildren }: TreeNodeProps) {
  const indent = depth * 12 + 16; // px-4 (16) + 每层 12px

  if (entry.type === 'dir') {
    return (
      <>
        <div
          onClick={() => onToggleDir(entry.path)}
          className="flex items-center gap-1.5 py-1.5 hover:bg-[var(--hover)] transition-colors cursor-pointer select-none"
          style={{ paddingLeft: indent }}
        >
          <span className="shrink-0 text-[var(--ink-tertiary)]">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          {expanded
            ? <FolderOpen size={14} className="shrink-0 text-[var(--accent-light)]" />
            : <Folder size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
          }
          <span className="text-[13px] text-[var(--ink)] truncate">{entry.name}</span>
        </div>
        {expanded && children && children.map((child) => (
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            expanded={expandedDirs.has(child.path)}
            children={dirChildren[child.path]}
            onToggleDir={onToggleDir}
            onOpenFile={onOpenFile}
            expandedDirs={expandedDirs}
            dirChildren={dirChildren}
          />
        ))}
        {expanded && children && children.length === 0 && (
          <div className="py-1 text-[12px] text-[var(--ink-tertiary)] italic" style={{ paddingLeft: indent + 28 }}>
            空目录
          </div>
        )}
      </>
    );
  }

  return (
    <div
      onClick={() => onOpenFile?.(entry.path)}
      className="flex items-center gap-1.5 py-1.5 hover:bg-[var(--hover)] transition-colors cursor-pointer"
      style={{ paddingLeft: indent + 14 }} // 对齐：无 chevron，补偏移
    >
      <FileText size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
      <span className="text-[13px] text-[var(--ink)] truncate">{entry.name}</span>
    </div>
  );
}

// ── 主组件 ─────────────────────────────────────────────────────
export default function WorkspaceFilesPanel({ agentDir, onOpenFile }: Props) {
  const [rootFiles, setRootFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirChildren, setDirChildren] = useState<Record<string, FileEntry[]>>({});

  const fetchDir = useCallback(async (path: string): Promise<FileEntry[]> => {
    return globalApiGetJson<FileEntry[]>(`/api/dir-files?path=${encodeURIComponent(path)}`);
  }, []);

  const refresh = useCallback(async (retryMs?: number) => {
    if (!agentDir) return;
    setLoading(true);
    setExpandedDirs(new Set());
    setDirChildren({});
    try {
      const data = await fetchDir(agentDir);
      setRootFiles(data);
      setLoading(false);
    } catch (e) {
      if (retryMs) {
        setTimeout(() => { refresh().catch(console.error); }, retryMs);
        return;
      }
      setLoading(false);
      console.error(e);
    }
  }, [agentDir, fetchDir]);

  useEffect(() => {
    refresh(2000);
  }, [refresh]);

  const handleToggleDir = useCallback(async (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
    // 若尚未加载子目录，则请求
    setDirChildren((prev) => {
      if (path in prev) return prev; // 已缓存
      // 触发异步加载
      fetchDir(path).then((children) => {
        setDirChildren((p) => ({ ...p, [path]: children }));
      }).catch(console.error);
      return { ...prev, [path]: [] }; // 占位，避免重复请求
    });
  }, [fetchDir]);

  const handleOpenExternal = useCallback(async () => {
    if (!agentDir || !isTauri()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    invoke('cmd_open_in_finder', { path: agentDir }).catch(console.error);
  }, [agentDir]);

  const dirName = agentDir?.split('/').filter(Boolean).pop() ?? '工作区';

  return (
    <div
      className="flex h-full flex-col border-l border-[var(--border)] bg-[var(--paper)]"
      style={{ width: 280, minWidth: 280 }}
    >
      {/* 顶部标题：高度 48px，与 TopTabBar 对齐 */}
      <div
        className="flex items-center justify-between shrink-0 border-b border-[var(--border)] px-4"
        style={{ height: 48 }}
      >
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
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleOpenExternal}
            title="在 Finder 中打开"
            className="p-1.5 rounded hover:bg-[var(--hover)] transition-colors text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      {/* Tab 切换：高度 44px，与 SecondTabBar 对齐 */}
      <div
        className="flex items-center shrink-0 border-b border-[var(--border)] px-3"
        style={{ height: 44 }}
      >
        <button className="px-2 text-[13px] font-medium text-[var(--accent)] border-b-2 border-[var(--accent)]" style={{ height: 34 }}>
          所有文件
        </button>
      </div>

      {/* 文件树 */}
      <div className="flex-1 overflow-y-auto py-1">
        {!agentDir ? (
          <p className="px-4 py-3 text-[13px] text-[var(--ink-tertiary)]">未选择工作区</p>
        ) : loading && rootFiles.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-[var(--ink-tertiary)]">加载中…</p>
        ) : rootFiles.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-[var(--ink-tertiary)]">空目录</p>
        ) : (
          rootFiles.map((f) => (
            <TreeNode
              key={f.path}
              entry={f}
              depth={0}
              expanded={expandedDirs.has(f.path)}
              children={dirChildren[f.path]}
              onToggleDir={handleToggleDir}
              onOpenFile={onOpenFile}
              expandedDirs={expandedDirs}
              dirChildren={dirChildren}
            />
          ))
        )}
      </div>
    </div>
  );
}
