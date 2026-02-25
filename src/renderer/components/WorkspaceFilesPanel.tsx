import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Eye, EyeOff, Settings, Check, Plus } from 'lucide-react';
import { globalApiGetJson, globalApiPostJson } from '../api/apiFetch';
import { isTauri } from '../utils/env';

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
  diff: string | null;
  content: string | null;
  isNew: boolean;
}

interface Props {
  agentDir: string | null;
  onOpenFile?: (path: string) => void;
}

// ── 项目配置文件定义 ─────────────────────────────────────────────
interface ConfigFileItem {
  name: string;
  desc: string;
  template: string;
}

const PROJECT_CONFIG_FILES: ConfigFileItem[] = [
  {
    name: 'CLAUDE.md',
    desc: '项目指令',
    template: `# CLAUDE.md - 项目指令

## 项目概述
<!-- 描述你的项目 -->

## 技术栈
<!-- 列出主要技术栈 -->

## 开发命令
<!-- 常用命令 -->

## 核心原则
<!-- 编码规范、架构约定 -->
`,
  },
  {
    name: 'IDENTITY.md',
    desc: 'AI 身份',
    template: `# IDENTITY — AI 身份

## 名称
Assistant

## 角色
通用 AI 助手

## 个性特征
- 专业严谨
- 主动思考
- 善于总结
`,
  },
  {
    name: 'SOUL.md',
    desc: '行为准则',
    template: `# SOUL — 行为准则

## 交互风格
- 简洁、专业、友好
- 优先给出可执行的方案

## 安全边界
- 不执行破坏性操作（除非明确授权）
- 敏感信息不对外暴露
`,
  },
  {
    name: 'USER.md',
    desc: '用户档案',
    template: `# USER — 用户档案

## 语言偏好
中文

## 技术背景
<!-- 填写你的技术栈、工作领域等 -->

## 沟通偏好
<!-- 例如：喜欢简洁回复、需要详细解释等 -->
`,
  },
  {
    name: 'MEMORY.md',
    desc: '长期记忆',
    template: `# MEMORY — 长期记忆

## 重要决策
<!-- Agent 会在此记录重要的决策和学习 -->

## 用户偏好
<!-- 从交互中学到的用户偏好 -->
`,
  },
  {
    name: 'BOOTSTRAP.md',
    desc: '启动指令',
    template: `# BOOTSTRAP — 启动指令

<!-- 在这里写入每次对话开始时都要执行的特殊指令 -->
`,
  },
  {
    name: 'AGENTS.md',
    desc: '工作区规则',
    template: `# AGENTS — 工作区规则

## 工作目录规则
- 所有文件操作限制在工作区内
- 遵循项目现有的代码风格

## 任务优先级
1. 正确性
2. 简洁性
3. 可维护性
`,
  },
  {
    name: 'TOOLS.md',
    desc: '环境备注',
    template: `# TOOLS — 环境备注

> 此文件不会注入到 Agent 上下文，仅作为开发者参考。

## 开发环境
<!-- 例如：Node.js v20, Python 3.12 -->

## 常用命令
<!-- 例如：npm run dev, pytest -->
`,
  },
];

// ── 变动文件辅助组件 ─────────────────────────────────────────────
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  M: { label: 'M', color: '#d29922', bg: 'rgba(210, 153, 34, 0.15)' },
  A: { label: 'A', color: '#3fb950', bg: 'rgba(63, 185, 80, 0.15)' },
  D: { label: 'D', color: '#f85149', bg: 'rgba(248, 81, 73, 0.15)' },
  U: { label: 'U', color: '#8b949e', bg: 'rgba(139, 148, 158, 0.15)' },
  R: { label: 'R', color: '#a371f7', bg: 'rgba(163, 113, 247, 0.15)' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.M;
  return (
    <span
      className="inline-flex items-center justify-center w-[18px] h-[18px] rounded text-[10px] font-bold shrink-0"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

function DiffView({ result }: { result: FileDiffResult }) {
  const lines: string[] = [];
  if (result.isNew && result.content) {
    lines.push(...result.content.split('\n').map((l) => `+${l}`));
  } else if (result.diff) {
    let inHunk = false;
    for (const line of result.diff.split('\n')) {
      if (line.startsWith('@@')) inHunk = true;
      if (inHunk) lines.push(line);
    }
  }

  if (lines.length === 0) {
    return <div className="px-3 py-2 text-[12px] text-[var(--ink-tertiary)] italic">无差异内容</div>;
  }

  return (
    <div className="max-h-[300px] overflow-auto border-t border-[var(--border)] bg-[var(--paper)]">
      {lines.map((line, i) => {
        let bg = 'transparent';
        let color = 'var(--ink-tertiary)';
        if (line.startsWith('+') && !line.startsWith('+++')) {
          bg = 'rgba(46, 160, 67, 0.15)';
          color = '#3fb950';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          bg = 'rgba(248, 81, 73, 0.15)';
          color = '#f85149';
        } else if (line.startsWith('@@')) {
          bg = 'rgba(56, 139, 253, 0.1)';
          color = '#58a6ff';
        }
        return (
          <div
            key={i}
            className="text-[11px] font-mono leading-[18px] px-2 whitespace-pre"
            style={{ background: bg, color }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
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
  const [showHidden, setShowHidden] = useState(false);
  const showHiddenRef = useRef(showHidden);
  showHiddenRef.current = showHidden;

  // ── 项目设置 tab 状态 ──
  const [activeTab, setActiveTab] = useState<'files' | 'changed' | 'config'>('files');
  const [showConfigTab, setShowConfigTab] = useState(false);
  const [configFileStatus, setConfigFileStatus] = useState<Record<string, boolean>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [creatingFile, setCreatingFile] = useState<string | null>(null);

  // ── 变动文件 tab 状态 ──
  const [changedFiles, setChangedFiles] = useState<ChangedFileEntry[]>([]);
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null);
  const [changedLoading, setChangedLoading] = useState(false);
  const [expandedDiffPath, setExpandedDiffPath] = useState<string | null>(null);
  const [diffCache, setDiffCache] = useState<Record<string, FileDiffResult>>({});
  const [diffLoading, setDiffLoading] = useState(false);

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
    setIsGitRepo(null);
    setChangedFiles([]);
    gitInitTriedRef.current = false;
    failCountRef.current = 0;
  }, [agentDir]);

  // ── 检测配置文件存在状态 ──
  const checkConfigFiles = useCallback(async () => {
    if (!agentDir) return;
    setConfigLoading(true);
    const status: Record<string, boolean> = {};
    await Promise.all(
      PROJECT_CONFIG_FILES.map(async (f) => {
        const filePath = `${agentDir}/${f.name}`;
        try {
          await globalApiGetJson(`/api/file-stat?path=${encodeURIComponent(filePath)}`);
          status[f.name] = true;
        } catch {
          status[f.name] = false;
        }
      })
    );
    setConfigFileStatus(status);
    setConfigLoading(false);
  }, [agentDir]);

  // 切换到 config tab 时检测文件状态
  useEffect(() => {
    if (activeTab === 'config') {
      checkConfigFiles();
    }
  }, [activeTab, checkConfigFiles]);

  // ── 创建配置文件 ──
  const handleCreateConfigFile = useCallback(async (item: ConfigFileItem) => {
    if (!agentDir || creatingFile) return;
    const filePath = `${agentDir}/${item.name}`;
    setCreatingFile(item.name);
    try {
      await globalApiPostJson('/api/file-write', { path: filePath, content: item.template });
      setConfigFileStatus((prev) => ({ ...prev, [item.name]: true }));
      onOpenFile?.(filePath);
    } catch (e) {
      console.error('创建配置文件失败:', e);
    } finally {
      setCreatingFile(null);
    }
  }, [agentDir, creatingFile, onOpenFile]);

  // ── 点击配置文件行 ──
  const handleConfigFileClick = useCallback((item: ConfigFileItem) => {
    if (!agentDir) return;
    const filePath = `${agentDir}/${item.name}`;
    if (configFileStatus[item.name]) {
      // 已存在 → 直接打开
      onOpenFile?.(filePath);
    } else {
      // 未创建 → 创建后打开
      handleCreateConfigFile(item);
    }
  }, [agentDir, configFileStatus, onOpenFile, handleCreateConfigFile]);

  // ── Settings 按钮 toggle ──
  const handleToggleSettings = useCallback(() => {
    if (showConfigTab) {
      // 已显示 → 切回所有文件，隐藏 tab
      setActiveTab('files');
      setShowConfigTab(false);
    } else {
      // 未显示 → 出现 tab 并激活
      setShowConfigTab(true);
      setActiveTab('config');
    }
  }, [showConfigTab]);

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
          {agentDir && (
            <button
              onClick={handleToggleSettings}
              title="项目设置"
              className={`p-1.5 rounded hover:bg-[var(--hover)] transition-colors ${
                showConfigTab ? 'text-[var(--accent)]' : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
              }`}
            >
              <Settings size={16} />
            </button>
          )}
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
        {showConfigTab && (
          <button
            onClick={() => setActiveTab('config')}
            className={`px-2 text-[13px] font-medium transition-colors ${
              activeTab === 'config'
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)] border-b-2 border-transparent'
            }`}
            style={{ height: 34 }}
          >
            项目设置
          </button>
        )}
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
            changedFiles.map((f) => (
              <div key={f.path}>
                <div
                  onClick={() => handleToggleFileDiff(f.path)}
                  className="flex items-center gap-1.5 py-1.5 px-4 hover:bg-[var(--hover)] transition-colors cursor-pointer select-none"
                >
                  <span className="shrink-0 text-[var(--ink-tertiary)]">
                    {expandedDiffPath === f.path ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <StatusBadge status={f.status} />
                  <span className="text-[13px] text-[var(--ink)] truncate flex-1" title={f.path}>
                    {f.path.includes('/') ? f.path.split('/').pop() : f.path}
                  </span>
                  <span className="text-[11px] text-[var(--ink-tertiary)] truncate max-w-[80px]" title={f.path}>
                    {f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : ''}
                  </span>
                </div>
                {expandedDiffPath === f.path && (
                  diffLoading && !diffCache[f.path] ? (
                    <div className="px-4 py-2 text-[12px] text-[var(--ink-tertiary)]">
                      <RefreshCw size={12} className="inline animate-spin mr-1" />
                      加载 diff…
                    </div>
                  ) : diffCache[f.path] ? (
                    <DiffView result={diffCache[f.path]} />
                  ) : null
                )}
              </div>
            ))
          )
        ) : activeTab === 'files' ? (
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
                children={dirChildren[f.path]}
                onToggleDir={handleToggleDir}
                onOpenFile={onOpenFile}
                expandedDirs={expandedDirs}
                dirChildren={dirChildren}
              />
            ))
          )
        ) : (
          /* ── 项目设置 tab ── */
          configLoading ? (
            <p className="px-4 py-3 text-[13px] text-[var(--ink-tertiary)]">检测文件状态…</p>
          ) : (
            PROJECT_CONFIG_FILES.map((item) => {
              const exists = configFileStatus[item.name];
              const isCreating = creatingFile === item.name;
              return (
                <div
                  key={item.name}
                  onClick={() => handleConfigFileClick(item)}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--hover)] transition-colors cursor-pointer select-none"
                >
                  <FileText size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] text-[var(--ink)]">{item.name}</span>
                    <span className="ml-1.5 text-[11px] text-[var(--ink-tertiary)]">{item.desc}</span>
                  </div>
                  <span className="shrink-0">
                    {isCreating ? (
                      <RefreshCw size={12} className="animate-spin text-[var(--ink-tertiary)]" />
                    ) : exists ? (
                      <span className="flex items-center gap-0.5 text-[11px] text-[var(--accent)]">
                        <Check size={12} />
                        已创建
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[11px] text-[var(--ink-tertiary)]">
                        <Plus size={12} />
                        创建
                      </span>
                    )}
                  </span>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
