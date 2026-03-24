import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RefreshCw, FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Eye, EyeOff, AtSign, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { globalApiGetJson, globalApiPostJson } from '../api/apiFetch';
import { isTauri } from '../utils/env';
import DiffViewer from './DiffViewer';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import RenameDialog from './RenameDialog';
import ConfirmDialog from './ConfirmDialog';

interface FileEntry {
  name: string;
  type: 'file' | 'dir';
  path: string;
}

interface ChangedFileEntry {
  path: string;
  status: 'M' | 'A' | 'D' | 'U' | 'R';
}

interface FileDiffResult {
  before: string;
  after: string;
}

interface Props {
  agentDir: string | null;
  onOpenFile?: (path: string) => void;
  onInsertReference?: (paths: string[]) => void;
}

// ── 变动文件辅助组件 ─────────────────────────────────────────────
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  M: { label: '编辑', color: '#d29922', bg: 'rgba(210, 153, 34, 0.15)' },
  A: { label: '新建', color: '#3fb950', bg: 'rgba(63, 185, 80, 0.15)' },
  D: { label: '删除', color: '#f85149', bg: 'rgba(248, 81, 73, 0.15)' },
  U: { label: '新建', color: '#8b949e', bg: 'rgba(139, 148, 158, 0.15)' },
  R: { label: '重命名', color: '#a371f7', bg: 'rgba(163, 113, 247, 0.15)' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.M;
  return (
    <span
      className="inline-flex items-center justify-center px-1.5 h-[18px] rounded text-[11px] font-medium shrink-0"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

// DiffView 已替换为 DiffViewer 组件

// ── 变动文件目录树 ─────────────────────────────────────────────

interface ChangedTreeNode {
  name: string;
  fullPath: string;
  type: 'dir' | 'file';
  status?: string;
  filePath?: string;
  children: ChangedTreeNode[];
  count: number;
}

function buildChangedTree(files: ChangedFileEntry[]): ChangedTreeNode[] {
  const rootChildren: ChangedTreeNode[] = [];

  for (const f of files) {
    const parts = f.path.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    let children = rootChildren;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join('/');

      if (isLast) {
        children.push({ name: part, fullPath, type: 'file', status: f.status, filePath: f.path, children: [], count: 0 });
      } else {
        let dir = children.find((c) => c.type === 'dir' && c.name === part);
        if (!dir) {
          dir = { name: part, fullPath, type: 'dir', children: [], count: 0 };
          children.push(dir);
        }
        children = dir.children;
      }
    }
  }

  function calcCount(node: ChangedTreeNode): number {
    if (node.type === 'file') return 1;
    node.count = node.children.reduce((sum, c) => sum + calcCount(c), 0);
    return node.count;
  }
  rootChildren.forEach((c) => calcCount(c));

  function sortTree(nodes: ChangedTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => { if (n.children.length > 0) sortTree(n.children); });
  }
  sortTree(rootChildren);

  return rootChildren;
}

function ChangedFileTreeNode({
  node, depth, expandedDirs, onToggleDir, expandedDiffPath, onToggleDiff, diffLoading, diffCache, agentDir, onOpenFile,
}: {
  node: ChangedTreeNode;
  depth: number;
  expandedDirs: Set<string>;
  onToggleDir: (fullPath: string) => void;
  expandedDiffPath: string | null;
  onToggleDiff: (filePath: string) => void;
  diffLoading: boolean;
  diffCache: Record<string, FileDiffResult>;
  agentDir?: string | null;
  onOpenFile?: (path: string) => void;
}) {
  const indent = depth * 14 + 16;

  if (node.type === 'dir') {
    const isExpanded = expandedDirs.has(node.fullPath);
    return (
      <>
        <div
          onClick={() => onToggleDir(node.fullPath)}
          className="flex items-center gap-1.5 py-1.5 hover:bg-[var(--hover)] transition-colors cursor-pointer select-none pr-3"
          style={{ paddingLeft: indent }}
        >
          <span className="shrink-0 text-[var(--ink-tertiary)]">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          {isExpanded
            ? <FolderOpen size={14} className="shrink-0 text-[var(--accent-light)]" />
            : <Folder size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
          }
          <span className="text-[13px] text-[var(--ink)] truncate">{node.name}</span>
          <span className="text-[11px] text-[var(--ink-tertiary)] ml-auto shrink-0">{node.count}</span>
        </div>
        {isExpanded && node.children.map((child) => (
          <ChangedFileTreeNode
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            expandedDirs={expandedDirs}
            onToggleDir={onToggleDir}
            expandedDiffPath={expandedDiffPath}
            onToggleDiff={onToggleDiff}
            diffLoading={diffLoading}
            diffCache={diffCache}
            agentDir={agentDir}
            onOpenFile={onOpenFile}
          />
        ))}
      </>
    );
  }

  // File node
  const filePath = node.filePath!;
  const isDiffExpanded = expandedDiffPath === filePath;

  return (
    <>
      <div
        onClick={() => {
          onToggleDiff(filePath);
          if (agentDir && onOpenFile) {
            onOpenFile(`${agentDir}/${filePath}`);
          }
        }}
        className="flex items-center gap-1.5 py-1.5 hover:bg-[var(--hover)] transition-colors cursor-pointer select-none pr-3"
        style={{ paddingLeft: indent + 14 }}
      >
        <FileText size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
        <span className="text-[13px] text-[var(--ink)] truncate flex-1">{node.name}</span>
        <StatusBadge status={node.status!} />
      </div>
      {isDiffExpanded && (
        diffLoading && !diffCache[filePath] ? (
          <div className="px-4 py-2 text-[12px] text-[var(--ink-tertiary)]">
            <RefreshCw size={12} className="inline animate-spin mr-1" />
            加载 diff…
          </div>
        ) : diffCache[filePath] ? (
          <DiffViewer before={diffCache[filePath].before} after={diffCache[filePath].after} filePath={filePath} />
        ) : null
      )}
    </>
  );
}

// ── 单个树节点 ──────────────────────────────────────────────────
interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  expanded: boolean;
  childEntries: FileEntry[] | undefined;
  onToggleDir: (path: string) => void;
  onOpenFile?: (path: string) => void;
  expandedDirs: Set<string>;
  dirChildren: Record<string, FileEntry[]>;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
}

function TreeNode({ entry, depth, expanded, childEntries, onToggleDir, onOpenFile, expandedDirs, dirChildren, onContextMenu }: TreeNodeProps) {
  const indent = depth * 12 + 16; // px-4 (16) + 每层 12px

  if (entry.type === 'dir') {
    return (
      <>
        <div
          onClick={() => onToggleDir(entry.path)}
          onContextMenu={(e) => onContextMenu?.(e, entry)}
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
        {expanded && childEntries && childEntries.map((child) => (
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            expanded={expandedDirs.has(child.path)}
            childEntries={dirChildren[child.path]}
            onToggleDir={onToggleDir}
            onOpenFile={onOpenFile}
            expandedDirs={expandedDirs}
            dirChildren={dirChildren}
            onContextMenu={onContextMenu}
          />
        ))}
        {expanded && childEntries && childEntries.length === 0 && (
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
      onContextMenu={(e) => onContextMenu?.(e, entry)}
      className="flex items-center gap-1.5 py-1.5 hover:bg-[var(--hover)] transition-colors cursor-pointer"
      style={{ paddingLeft: indent + 14 }} // 对齐：无 chevron，补偏移
    >
      <FileText size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
      <span className="text-[13px] text-[var(--ink)] truncate">{entry.name}</span>
    </div>
  );
}

// ── 主组件 ─────────────────────────────────────────────────────
export default function WorkspaceFilesPanel({ agentDir, onOpenFile, onInsertReference }: Props) {
  const [rootFiles, setRootFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirChildren, setDirChildren] = useState<Record<string, FileEntry[]>>({});
  const [showHidden, setShowHidden] = useState(false);
  const showHiddenRef = useRef(showHidden);
  showHiddenRef.current = showHidden;

  const [activeTab, setActiveTab] = useState<'files' | 'changed'>('files');

  // ── 变动文件 tab 状态 ──
  const [changedFiles, setChangedFiles] = useState<ChangedFileEntry[]>([]);
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null);
  const [changedLoading, setChangedLoading] = useState(false);
  const [expandedDiffPath, setExpandedDiffPath] = useState<string | null>(null);
  const [diffCache, setDiffCache] = useState<Record<string, FileDiffResult>>({});
  const [diffLoading, setDiffLoading] = useState(false);
  const [expandedChangedDirs, setExpandedChangedDirs] = useState<Set<string>>(new Set());

  const changedTree = useMemo(() => buildChangedTree(changedFiles), [changedFiles]);

  // Auto-expand all directories when changed files update
  useEffect(() => {
    function collectDirPaths(nodes: ChangedTreeNode[]): string[] {
      const paths: string[] = [];
      for (const n of nodes) {
        if (n.type === 'dir') {
          paths.push(n.fullPath);
          paths.push(...collectDirPaths(n.children));
        }
      }
      return paths;
    }
    setExpandedChangedDirs(new Set(collectDirPaths(changedTree)));
  }, [changedTree]);

  const handleToggleChangedDir = useCallback((fullPath: string) => {
    setExpandedChangedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) next.delete(fullPath);
      else next.add(fullPath);
      return next;
    });
  }, []);

  const fetchDir = useCallback(async (path: string): Promise<FileEntry[]> => {
    const hidden = showHiddenRef.current ? '&hidden=1' : '';
    return globalApiGetJson<FileEntry[]>(`/api/dir-files?path=${encodeURIComponent(path)}${hidden}`);
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

  // showHidden 切换时自动刷新
  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  // ── 变动文件 ──
  const gitInitTriedRef = useRef(false);
  const failCountRef = useRef(0);

  const fetchChangedFiles = useCallback(async () => {
    if (!agentDir) return;
    // 连续失败超过 3 次则静默跳过，避免轮询刷屏
    if (failCountRef.current >= 3) return;

    setChangedLoading(true);
    try {
      const data = await globalApiGetJson<{ isGitRepo: boolean; files: ChangedFileEntry[] }>(
        `/api/changed-files?agentDir=${encodeURIComponent(agentDir)}`
      );
      failCountRef.current = 0; // 成功则重置

      if (!data.isGitRepo && !gitInitTriedRef.current) {
        gitInitTriedRef.current = true;
        try {
          await globalApiPostJson('/api/git-init', { agentDir });
          const retry = await globalApiGetJson<{ isGitRepo: boolean; files: ChangedFileEntry[] }>(
            `/api/changed-files?agentDir=${encodeURIComponent(agentDir)}`
          );
          setIsGitRepo(retry.isGitRepo);
          setChangedFiles(retry.files);
          setChangedLoading(false);
          return;
        } catch {
          // git init 失败不影响主流程
        }
      }

      setIsGitRepo(data.isGitRepo);
      setChangedFiles(data.files);
    } catch {
      failCountRef.current += 1;
    } finally {
      setChangedLoading(false);
    }
  }, [agentDir]);

  const fetchFileDiff = useCallback(async (filePath: string) => {
    if (!agentDir) return;
    setDiffLoading(true);
    try {
      const data = await globalApiGetJson<FileDiffResult>(
        `/api/file-diff?agentDir=${encodeURIComponent(agentDir)}&path=${encodeURIComponent(filePath)}`
      );
      setDiffCache((prev) => ({ ...prev, [filePath]: data }));
    } catch (e) {
      console.error('获取 diff 失败:', e);
    } finally {
      setDiffLoading(false);
    }
  }, [agentDir]);

  const handleToggleFileDiff = useCallback((filePath: string) => {
    if (expandedDiffPath === filePath) {
      setExpandedDiffPath(null);
    } else {
      setExpandedDiffPath(filePath);
      if (!diffCache[filePath]) {
        fetchFileDiff(filePath);
      }
    }
  }, [expandedDiffPath, diffCache, fetchFileDiff]);

  // 切换到变动文件 tab 时获取数据，并每 5 秒自动刷新
  useEffect(() => {
    if (activeTab !== 'changed') return;
    failCountRef.current = 0; // 切换 Tab 时重置失败计数
    fetchChangedFiles();
    const timer = setInterval(() => {
      fetchChangedFiles();
      setDiffCache({});
    }, 5000);
    return () => clearInterval(timer);
  }, [activeTab, fetchChangedFiles]);

  // 切换工作区时清除变动文件状态
  useEffect(() => {
    setDiffCache({});
    setExpandedDiffPath(null);
    setExpandedChangedDirs(new Set());
    setIsGitRepo(null);
    setChangedFiles([]);
    gitInitTriedRef.current = false;
    failCountRef.current = 0;
  }, [agentDir]);

  // ── 右键菜单 + 对话框 ──
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
  const [dialog, setDialog] = useState<{ type: 'rename' | 'delete'; entry: FileEntry } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const handleOpenInFinder = useCallback(async (path: string) => {
    if (!isTauri()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // 文件 → 打开所在文件夹；文件夹 → 直接打开
      await invoke('cmd_open_in_finder', { path });
    } catch (err) {
      console.error('打开文件夹失败:', err);
    }
  }, []);

  const handleOpenWithDefault = useCallback(async (path: string) => {
    if (!isTauri()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(path);
    } catch (err) {
      console.error('打开文件失败:', err);
    }
  }, []);

  const handleRename = useCallback(async (oldPath: string, newName: string) => {
    try {
      await globalApiPostJson('/api/file-rename', { oldPath, newName });
      refresh();
    } catch (err) {
      console.error('重命名失败:', err);
    }
  }, [refresh]);

  const handleDelete = useCallback(async (path: string) => {
    try {
      await globalApiPostJson('/api/file-delete', { path });
      refresh();
    } catch (err) {
      console.error('删除失败:', err);
    }
  }, [refresh]);

  const getContextMenuItems = useCallback((entry: FileEntry): ContextMenuItem[] => {
    if (entry.type === 'file') {
      return [
        { label: '预览', icon: <Eye size={14} />, onClick: () => onOpenFile?.(entry.path) },
        { label: '引用', icon: <AtSign size={14} />, onClick: () => onInsertReference?.([entry.path]) },
        { label: '打开', icon: <ExternalLink size={14} />, onClick: () => handleOpenWithDefault(entry.path) },
        { label: '打开所在文件夹', icon: <FolderOpen size={14} />, onClick: () => handleOpenInFinder(entry.path) },
        { label: '重命名', icon: <Pencil size={14} />, onClick: () => setDialog({ type: 'rename', entry }) },
        { label: '删除', icon: <Trash2 size={14} />, danger: true, onClick: () => setDialog({ type: 'delete', entry }) },
      ];
    }
    // 文件夹
    return [
      { label: '打开所在文件夹', icon: <FolderOpen size={14} />, onClick: () => handleOpenInFinder(entry.path) },
      { label: '引用', icon: <AtSign size={14} />, onClick: () => onInsertReference?.([entry.path]) },
      { label: '重命名', icon: <Pencil size={14} />, onClick: () => setDialog({ type: 'rename', entry }) },
      { label: '删除', icon: <Trash2 size={14} />, danger: true, onClick: () => setDialog({ type: 'delete', entry }) },
    ];
  }, [onOpenFile, onInsertReference, handleOpenInFinder, handleOpenWithDefault]);

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

  // ── 拖拽文件到工作区（冲突自动重命名） ──
  const [isDroppingFiles, setIsDroppingFiles] = useState(false);
  const dropCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dropCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDroppingFiles(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dropCounterRef.current--;
    if (dropCounterRef.current <= 0) {
      setIsDroppingFiles(false);
      dropCounterRef.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDroppingFiles(false);
    dropCounterRef.current = 0;
    if (!agentDir) return;

    // Tauri 环境中通过 dataTransfer.files 获取拖入的文件路径
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const sourcePaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // @ts-expect-error Tauri webview exposes path on File objects
      const path = file.path as string | undefined;
      if (path) sourcePaths.push(path);
    }
    if (sourcePaths.length === 0) return;

    try {
      await globalApiPostJson('/api/file-copy', { sourcePaths, targetDir: agentDir });
      refresh();
    } catch (err) {
      console.error('拖拽文件复制失败:', err);
    }
  }, [agentDir, refresh]);

  const dirName = agentDir?.split('/').filter(Boolean).pop() ?? '工作区';

  return (
    <div
      className={`flex h-full flex-col border-l border-[var(--border)] bg-[var(--paper)] ${isDroppingFiles ? 'ring-2 ring-inset ring-[var(--accent)]/30' : ''}`}
      style={{ width: 280, minWidth: 280 }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
            onClick={() => { setShowHidden((v) => !v); }}
            title={showHidden ? '隐藏隐藏文件' : '显示隐藏文件'}
            className={`p-1.5 rounded hover:bg-[var(--hover)] transition-colors ${
              showHidden ? 'text-[var(--accent)]' : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
            }`}
          >
            {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
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
            <FolderOpen size={16} />
          </button>
        </div>
      </div>

      {/* Tab 切换：高度 44px，与 SecondTabBar 对齐 */}
      <div
        className="flex items-center shrink-0 border-b border-[var(--border)] px-3"
        style={{ height: 44 }}
      >
        <button
          onClick={() => setActiveTab('files')}
          className={`px-2 text-[13px] font-medium transition-colors ${
            activeTab === 'files'
              ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
              : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)] border-b-2 border-transparent'
          }`}
          style={{ height: 34 }}
        >
          所有文件
        </button>
        <button
          onClick={() => setActiveTab('changed')}
          className={`px-2 text-[13px] font-medium transition-colors ${
            activeTab === 'changed'
              ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
              : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)] border-b-2 border-transparent'
          }`}
          style={{ height: 34 }}
        >
          变动文件
          {changedFiles.length > 0 && (
            <span className="ml-1 text-[11px] px-1 rounded-full bg-[var(--accent)] text-white leading-[16px]">
              {changedFiles.length}
            </span>
          )}
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto py-1">
        {activeTab === 'changed' ? (
          /* ── 变动文件 tab ── */
          !agentDir ? (
            <p className="px-4 py-3 text-[13px] text-[var(--ink-tertiary)]">未选择工作区</p>
          ) : isGitRepo === false ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[13px] text-[var(--ink-tertiary)]">非 Git 仓库，无法追踪变更</p>
              <p className="text-[11px] text-[var(--ink-tertiary)] mt-1">请在工作区中初始化 Git 仓库</p>
            </div>
          ) : changedLoading && changedFiles.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-[var(--ink-tertiary)]">检测变动中…</p>
          ) : changedFiles.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[13px] text-[var(--ink-tertiary)]">没有变动文件</p>
              <p className="text-[11px] text-[var(--ink-tertiary)] mt-1">工作区内容与最近提交一致</p>
            </div>
          ) : (
            changedTree.map((node) => (
              <ChangedFileTreeNode
                key={node.fullPath}
                node={node}
                depth={0}
                expandedDirs={expandedChangedDirs}
                onToggleDir={handleToggleChangedDir}
                expandedDiffPath={expandedDiffPath}
                onToggleDiff={handleToggleFileDiff}
                diffLoading={diffLoading}
                diffCache={diffCache}
                agentDir={agentDir}
                onOpenFile={onOpenFile}
              />
            ))
          )
        ) : (
          /* ── 所有文件 tab ── */
          !agentDir ? (
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
                childEntries={dirChildren[f.path]}
                onToggleDir={handleToggleDir}
                onOpenFile={onOpenFile}
                expandedDirs={expandedDirs}
                dirChildren={dirChildren}
                onContextMenu={handleContextMenu}
              />
            ))
          )
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.entry)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 重命名对话框 */}
      {dialog?.type === 'rename' && (
        <RenameDialog
          currentName={dialog.entry.name}
          itemType={dialog.entry.type === 'dir' ? 'folder' : 'file'}
          onRename={(newName) => {
            handleRename(dialog.entry.path, newName);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {/* 删除确认对话框 */}
      {dialog?.type === 'delete' && (
        <ConfirmDialog
          title={`删除${dialog.entry.type === 'dir' ? '文件夹' : '文件'}`}
          message={`确定要删除「${dialog.entry.name}」吗？此操作无法撤销。`}
          confirmText="删除"
          danger
          onConfirm={() => {
            handleDelete(dialog.entry.path);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
