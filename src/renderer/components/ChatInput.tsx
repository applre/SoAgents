import { useState, useRef, useCallback, useEffect, useMemo, type KeyboardEvent, type DragEvent, type ClipboardEvent } from 'react';
import { Paperclip, Puzzle, Wrench, ChevronDown, ChevronLeft, Send, FileText, X, Image as ImageIcon, Lock, Check, Sparkles, ShieldCheck, Shield, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import SlashCommandMenu, { type CommandItem } from './SlashCommandMenu';
import { globalApiGetJson } from '../api/apiFetch';
import { useConfig } from '../context/ConfigContext';
import { useTabState } from '../context/TabContext';
// allProviders 从 ConfigContext 获取，不再使用静态 PROVIDERS
import type { PermissionMode } from '../../shared/types/permission';
import type { ModelEntity } from '../../shared/types/config';
import type { ChatImage } from '../types/chat';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { isTauri } from '../utils/env';
import { formatSize } from '../utils/formatSize';

const PERMISSION_MODES: { value: PermissionMode; label: string; desc: string; Icon: LucideIcon; color: string; recommended?: boolean }[] = [
  { value: 'plan',              label: '规划模式', desc: 'Agent 仅研究信息并与你确认规划',       Icon: Shield,      color: '#3b82f6' },
  { value: 'acceptEdits',       label: '协同模式', desc: '文件读写自动执行，Shell 命令需确认', Icon: ShieldCheck, color: 'var(--accent)', recommended: true },
  { value: 'bypassPermissions', label: '自主模式', desc: 'Agent 拥有自主权限，无需人工确认',   Icon: Zap,         color: '#f59e0b' },
];

interface SkillPayload {
  name: string;
  content: string;
}

interface Props {
  onSend: (text: string, permissionMode?: string, skill?: SkillPayload, images?: ChatImage[]) => void;
  onStop: () => void;
  isLoading: boolean;
  agentDir?: string;
  injectText?: string | null;
  onInjectConsumed?: () => void;
}

interface MCPServer {
  type: string;
  command?: string;
  url?: string;
}

interface AttachedFile {
  path: string;
  name: string;
  size: number; // bytes
  isImage?: boolean; // 是否为图片
  base64?: string; // 图片的 base64 数据
}

export default function ChatInput({ onSend, onStop, isLoading, agentDir, injectText, onInjectConsumed }: Props) {
  const { allProviders, currentProvider, currentModel, updateConfig, isLoading: configLoading, workspaces, updateWorkspaceConfig } = useConfig();
  const { apiGet, messages } = useTabState();
  const isProviderLocked = messages.length > 0;

  // Per-workspace entry (must be before permissionMode state init)
  const wsEntry = agentDir ? workspaces.find((w) => w.path === agentDir) : undefined;

  const [text, setText] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<{ name: string; content: string } | null>(null);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(wsEntry?.permissionMode ?? 'acceptEdits');
  // Sync permissionMode when workspace entry changes (e.g. workspace switch)
  useEffect(() => {
    setPermissionMode(wsEntry?.permissionMode ?? 'acceptEdits');
  }, [wsEntry?.permissionMode]);
  const [skillCommands, setSkillCommands] = useState<CommandItem[]>([]);
  const [showSkillPopover, setShowSkillPopover] = useState(false);
  const [showMCPPopover, setShowMCPPopover] = useState(false);
  const [showModelPopover, setShowModelPopover] = useState(false);
  const [showProviderSubmenu, setShowProviderSubmenu] = useState(false);
  const [showModePopover, setShowModePopover] = useState(false);
  const [mcpServers, setMcpServers] = useState<Record<string, MCPServer>>({});
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);
  const skillBtnRef = useRef<HTMLButtonElement>(null);
  const skillPopoverRef = useRef<HTMLDivElement>(null);
  const mcpBtnRef = useRef<HTMLButtonElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const modelPopoverRef = useRef<HTMLDivElement>(null);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const modeContainerRef = useRef<HTMLDivElement>(null);
  const effectiveProvider = useMemo(() => {
    if (!wsEntry?.providerId || allProviders.length === 0) return currentProvider;
    return allProviders.find((p) => p.id === wsEntry.providerId) ?? currentProvider;
  }, [wsEntry?.providerId, allProviders, currentProvider]);
  const effectiveModel = useMemo<ModelEntity | null>(() => {
    if (!effectiveProvider.models?.length) return null;
    if (wsEntry?.modelId) {
      const found = effectiveProvider.models.find(m => m.model === wsEntry.modelId);
      if (found) return found;
    }
    if (effectiveProvider.primaryModel) {
      const found = effectiveProvider.models.find(m => m.model === effectiveProvider.primaryModel);
      if (found) return found;
    }
    return effectiveProvider.models[0];
  }, [effectiveProvider, wsEntry?.modelId]);
  const slashQuery = showSlash && text.startsWith('/') ? text.slice(1) : '';

  // 文件注入：从编辑器「去对话」时以附件卡片形式带入文件，同步获取真实文件大小
  useEffect(() => {
    if (!injectText) return;
    const filePath = injectText;
    const name = filePath.split('/').pop() || filePath;
    onInjectConsumed?.();
    let cancelled = false;
    apiGet<{ size: number }>(`/api/file-stat?path=${encodeURIComponent(filePath)}`)
      .then((info) => {
        if (cancelled) return;
        setAttachedFiles((prev) => {
          if (prev.some((f) => f.path === filePath)) return prev;
          return [...prev, { path: filePath, name, size: info.size }];
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAttachedFiles((prev) => {
          if (prev.some((f) => f.path === filePath)) return prev;
          return [...prev, { path: filePath, name, size: 0 }];
        });
      });
    setTimeout(() => textareaRef.current?.focus(), 50);
    return () => { cancelled = true; };
  }, [injectText, onInjectConsumed, apiGet]);

  // 加载 skills
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const path = agentDir
          ? `/api/skills?agentDir=${encodeURIComponent(agentDir)}`
          : '/api/skills';
        const skills = await globalApiGetJson<Array<{ name: string; description: string; source: string }>>(path);
        setSkillCommands(skills.map((s) => ({
          name: s.name,
          description: s.description || '',
          source: s.source as 'global' | 'project',
        })));
      } catch { /* 静默失败 */ }
    };
    loadSkills();
  }, [agentDir]);

  // 加载 MCP servers
  useEffect(() => {
    globalApiGetJson<Record<string, MCPServer>>('/api/mcp')
      .then(setMcpServers)
      .catch(() => {});
  }, []);

  // 点外部关闭 popover
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !skillBtnRef.current?.contains(target) &&
        !skillPopoverRef.current?.contains(target) &&
        !mcpBtnRef.current?.contains(target) &&
        !modelBtnRef.current?.contains(target) &&
        !modelPopoverRef.current?.contains(target) &&
        !modeContainerRef.current?.contains(target)
      ) {
        setShowSkillPopover(false);
        setShowMCPPopover(false);
        setShowModelPopover(false);
        setShowProviderSubmenu(false);
        setShowModePopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setShowSlash(val.startsWith('/'));
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    // 分离图片和普通文件
    const imageFiles = attachedFiles.filter((f) => f.isImage && f.base64);
    const regularFiles = attachedFiles.filter((f) => !f.isImage || !f.base64);
    const filePaths = regularFiles.map((f) => f.path).join(' ');
    // 用户可见文本（用户 Prompt 在前，文件路径在后）
    const userText = [trimmed, filePaths].filter(Boolean).join('\n');
    // skill 信息单独传递
    const skill = selectedSkill ? { name: selectedSkill.name, content: selectedSkill.content } : undefined;
    if (!userText && !skill && imageFiles.length === 0) return;
    if (isLoading) return;
    // 提取图片的 mimeType 和纯 base64 数据
    const images: ChatImage[] = imageFiles.map((f) => {
      const parts = f.base64!.split(',');
      const mimeMatch = parts[0].match(/data:(.*?);/);
      return {
        name: f.name,
        mimeType: mimeMatch?.[1] ?? 'image/png',
        data: parts[1] ?? '',
      };
    });
    onSend(userText, permissionMode, skill, images.length > 0 ? images : undefined);
    setText('');
    setAttachedFiles([]);
    setSelectedSkill(null);
    setShowSlash(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, attachedFiles, selectedSkill, isLoading, onSend, permissionMode]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (showSlash) return;
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, showSlash]
  );

  const handleSlashSelect = useCallback(async (cmd: string) => {
    if (cmd === 'clear' || cmd === 'reset') {
      setText(`/${cmd}`);
      setShowSlash(false);
      textareaRef.current?.focus();
      return;
    }
    try {
      const path = agentDir
        ? `/api/skills/${cmd}?agentDir=${encodeURIComponent(agentDir)}`
        : `/api/skills/${cmd}`;
      const skill = await globalApiGetJson<{ content: string }>(path);
      setSelectedSkill({ name: cmd, content: skill.content || `/${cmd}` });
    } catch {
      setSelectedSkill({ name: cmd, content: `/${cmd}` });
    }
    setText('');
    setShowSlash(false);
    textareaRef.current?.focus();
  }, [agentDir]);

  const handleSkillSelect = useCallback(async (name: string) => {
    setShowSkillPopover(false);
    try {
      const path = agentDir
        ? `/api/skills/${name}?agentDir=${encodeURIComponent(agentDir)}`
        : `/api/skills/${name}`;
      const skill = await globalApiGetJson<{ content: string }>(path);
      setSelectedSkill({ name, content: skill.content || '' });
    } catch {
      setSelectedSkill({ name, content: '' });
    }
    textareaRef.current?.focus();
  }, [agentDir]);

  const handleAttach = useCallback(async () => {
    if (!isTauri()) return;
    const selected = await openDialog({ multiple: true });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const newFiles = await Promise.all(
      paths.map(async (p): Promise<AttachedFile> => {
        const name = p.split('/').pop() || p;
        try {
          const info = await apiGet<{ size: number }>(`/api/file-stat?path=${encodeURIComponent(p)}`);
          return { path: p, name, size: info.size };
        } catch {
          return { path: p, name, size: 0 };
        }
      })
    );
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    textareaRef.current?.focus();
  }, []);

  const removeFile = useCallback((path: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  // 检查文件是否为图片
  const isImageFile = useCallback((file: File): boolean => {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(ext) || file.type.startsWith('image/');
  }, []);

  // 处理文件（拖拽或粘贴）
  const processFiles = useCallback(async (files: File[]) => {
    const newFiles: AttachedFile[] = [];

    for (const file of files) {
      if (isImageFile(file)) {
        // 图片：读取 base64
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          newFiles.push({
            path: file.name, // 浏览器环境下用文件名作为标识
            name: file.name,
            size: file.size,
            isImage: true,
            base64,
          });
        } catch (error) {
          console.error('Failed to read image file:', error);
        }
      } else {
        // 普通文件：记录路径
        newFiles.push({
          path: file.name,
          name: file.name,
          size: file.size,
          isImage: false,
        });
      }
    }

    setAttachedFiles((prev) => [...prev, ...newFiles]);
  }, [isImageFile]);

  // 拖拽处理
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFiles(files);
    }
    textareaRef.current?.focus();
  }, [processFiles]);

  // 粘贴处理
  const handlePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      await processFiles(files);
      textareaRef.current?.focus();
    }
  }, [processFiles]);

  const canSend = text.trim().length > 0 || attachedFiles.length > 0 || selectedSkill !== null;
  const mcpList = Object.entries(mcpServers);

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        className="relative rounded-2xl border border-[var(--border)] bg-white"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽遮罩 */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-blue-500/10 border-2 border-blue-500 border-dashed">
            <div className="text-center">
              <div className="text-blue-600 text-lg font-medium">拖拽文件到这里</div>
              <div className="text-blue-500 text-sm mt-1">支持图片和普通文件</div>
            </div>
          </div>
        )}
        {/* Slash 命令菜单 */}
        {showSlash && (
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlash(false)}
            skillCommands={skillCommands}
          />
        )}

        {/* Skill Popover */}
        {showSkillPopover && (
          <div ref={skillPopoverRef} className="absolute bottom-full mb-2 left-0 z-50 w-72 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-white shadow-lg">
            <div className="px-3 py-2 text-xs font-medium text-[var(--ink-secondary)] border-b border-[var(--border)]">技能列表</div>
            {skillCommands.length === 0 ? (
              <div className="px-3 py-3 text-sm text-[var(--ink-tertiary)]">暂无技能</div>
            ) : (
              skillCommands.map((s) => (
                <button
                  key={s.name}
                  onClick={() => handleSkillSelect(s.name)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--hover)] transition-colors"
                >
                  <span className="font-medium text-[var(--ink)] truncate">{s.name}</span>
                  {s.source && (
                    <span className={`ml-auto shrink-0 text-xs px-1.5 py-0.5 rounded ${
                      s.source === 'project' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {s.source === 'project' ? '项目' : '全局'}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* MCP Popover */}
        {showMCPPopover && (
          <div className="absolute bottom-full mb-2 left-12 z-50 w-72 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-white shadow-lg">
            <div className="px-3 py-2 text-xs font-medium text-[var(--ink-secondary)] border-b border-[var(--border)]">MCP Servers</div>
            {mcpList.length === 0 ? (
              <div className="px-3 py-3 text-sm text-[var(--ink-tertiary)]">暂无 MCP Server，前往设置添加</div>
            ) : (
              mcpList.map(([id, cfg]) => (
                <div key={id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="font-medium text-[var(--ink)] truncate">{id}</span>
                  <span className="ml-auto shrink-0 text-xs text-[var(--ink-tertiary)]">{cfg.type}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Model Popover — 同窗切换视图 */}
        {showModelPopover && (
          <div ref={modelPopoverRef} className="absolute bottom-full mb-2 right-0 z-50 w-64 max-h-[400px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--paper)] shadow-lg py-1">
            {showProviderSubmenu ? (
              <>
                {/* Provider 列表视图 */}
                <div className="px-3 py-2 border-b border-[var(--border)]">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowProviderSubmenu(false); }}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors"
                  >
                    <ChevronLeft size={12} />
                    <span>选择供应商</span>
                  </button>
                </div>
                {allProviders.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (agentDir) {
                        updateWorkspaceConfig(agentDir, { providerId: p.id });
                      } else {
                        updateConfig({ currentProviderId: p.id });
                      }
                      setShowProviderSubmenu(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      effectiveProvider.id === p.id
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-[9px] text-[var(--ink-tertiary)] bg-[var(--hover)] px-1 py-0.5 rounded">
                      {p.cloudProvider}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <>
                {/* Model 列表视图 */}
                <div className="px-3 py-2 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--ink-secondary)]">选择模型</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isProviderLocked) setShowProviderSubmenu(true);
                      }}
                      disabled={isProviderLocked}
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                        isProviderLocked
                          ? 'text-[var(--ink-tertiary)] cursor-not-allowed'
                          : 'text-[var(--ink-secondary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {isProviderLocked && <Lock size={9} className="shrink-0" />}
                      <span>{effectiveProvider.name}</span>
                      {!isProviderLocked && <ChevronDown size={10} />}
                    </button>
                  </div>
                </div>
                {isProviderLocked && (
                  <div className="px-3 py-1.5 text-[11px] text-[var(--ink-tertiary)] bg-amber-50 border-b border-[var(--border)]">
                    供应商已锁定，新建对话可切换
                  </div>
                )}
                {effectiveProvider.models?.length ? (
                  effectiveProvider.models.map((m) => (
                    <button
                      key={m.model}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (agentDir) {
                          updateWorkspaceConfig(agentDir, { modelId: m.model });
                        } else {
                          updateConfig({ currentModelId: m.model });
                        }
                        setShowModelPopover(false);
                      }}
                      className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                        effectiveModel?.model === m.model
                          ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                      }`}
                    >
                      <span className={`font-medium ${effectiveModel?.model === m.model ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>
                        {m.modelName}
                      </span>
                      {effectiveModel?.model === m.model && <Check size={14} className="ml-auto shrink-0" />}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-[var(--ink-tertiary)]">{configLoading ? '加载模型中...' : '暂无可选模型'}</div>
                )}
              </>
            )}
          </div>
        )}

        {/* Skill 标签卡片 */}
        {selectedSkill && (
          <div className="flex items-center gap-2 px-4 pt-3">
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5">
              <Puzzle size={13} className="text-[var(--ink-secondary)] shrink-0" />
              <span className="text-sm font-medium text-[var(--ink)]">{selectedSkill.name}</span>
              <button
                onClick={() => setSelectedSkill(null)}
                className="ml-0.5 text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* 附件卡片区 */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachedFiles.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 w-44"
              >
                {/* 文件图标或图片预览 */}
                {file.isImage && file.base64 ? (
                  <div className="h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    <img src={file.base64} alt={file.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                    {file.isImage ? (
                      <ImageIcon size={18} className="text-orange-500" />
                    ) : (
                      <FileText size={18} className="text-orange-500" />
                    )}
                  </div>
                )}
                {/* 文件信息 */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--ink)]">{file.name}</div>
                  <div className="text-xs text-[var(--ink-tertiary)]">{formatSize(file.size)}</div>
                </div>
                {/* 删除 */}
                <button
                  onClick={() => removeFile(file.path)}
                  className="shrink-0 text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 文本输入区 */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={selectedSkill ? "输入消息... (输入 / 召唤牛马)" : "帮我写一份项目计划书  tab"}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] outline-none"
          style={{ minHeight: 44, maxHeight: 160 }}
        />

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-3 pb-3">
          {/* 左侧：附件、技能、MCP */}
          <div className="flex items-center gap-1">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
              title="上传附件"
              onClick={handleAttach}
            >
              <Paperclip size={16} />
            </button>

            <button
              ref={skillBtnRef}
              onClick={() => { setShowSkillPopover((v) => !v); setShowMCPPopover(false); setShowModelPopover(false); }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                showSkillPopover ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
              }`}
              title="选择技能"
            >
              <Puzzle size={16} />
            </button>

            <button
              ref={mcpBtnRef}
              onClick={() => { setShowMCPPopover((v) => !v); setShowSkillPopover(false); setShowModelPopover(false); }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                showMCPPopover ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
              }`}
              title="选择 MCP Server"
            >
              <Wrench size={16} />
            </button>
          </div>

          {/* 右侧：权限模式 + 模型选择 + 发送 */}
          <div className="flex items-center gap-2">
            {/* 权限模式下拉 */}
            <div className="relative" ref={modeContainerRef}>
              {showModePopover && (
                <div className="absolute bottom-full mb-2 right-0 z-50 w-72 rounded-xl border border-[var(--border)] bg-white shadow-lg overflow-hidden">
                  <div className="px-3 py-2.5 text-[12px] font-medium text-[var(--ink-secondary)] border-b border-[var(--border)]">
                    执行权限
                  </div>
                  <div className="p-1.5">
                    {PERMISSION_MODES.map((m) => {
                      const isActive = permissionMode === m.value;
                      const MIcon = m.Icon;
                      return (
                        <button
                          key={m.value}
                          onClick={() => {
                            setPermissionMode(m.value);
                            setShowModePopover(false);
                            if (agentDir) {
                              updateWorkspaceConfig(agentDir, { permissionMode: m.value });
                            }
                          }}
                          className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                            isActive ? 'bg-[var(--surface)]' : 'hover:bg-[var(--hover)]'
                          }`}
                        >
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: isActive ? `color-mix(in srgb, ${m.color} 12%, transparent)` : 'var(--surface)' }}
                          >
                            <MIcon size={16} style={{ color: isActive ? m.color : 'var(--ink-tertiary)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[13px] font-medium ${isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-secondary)]'}`}>
                                {m.label}
                              </span>
                              {m.recommended && (
                                <span className="text-[10px] px-1.5 py-px rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium leading-tight">
                                  推荐
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-[var(--ink-tertiary)] leading-snug">{m.desc}</p>
                          </div>
                          {isActive && <Check size={14} className="shrink-0" style={{ color: m.color }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(() => {
                const currentMode = PERMISSION_MODES.find(m => m.value === permissionMode);
                const MIcon = currentMode?.Icon ?? ShieldCheck;
                return (
                  <button
                    ref={modeBtnRef}
                    onClick={() => { setShowModePopover((v) => !v); setShowSkillPopover(false); setShowMCPPopover(false); setShowModelPopover(false); }}
                    className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      showModePopover
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                        : permissionMode === 'bypassPermissions'
                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        : permissionMode === 'plan'
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <MIcon size={12} className="shrink-0" />
                    {currentMode?.label}
                    <ChevronDown size={10} className="shrink-0" />
                  </button>
                );
              })()}
            </div>

            <button
              ref={modelBtnRef}
              onClick={() => {
                setShowModelPopover((v) => {
                  if (!v) setShowProviderSubmenu(false);
                  return !v;
                });
                setShowSkillPopover(false);
                setShowMCPPopover(false);
              }}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                isProviderLocked
                  ? 'text-[var(--ink-tertiary)]'
                  : 'text-[var(--ink-secondary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
              }`}
            >
              {isProviderLocked
                ? <Lock size={11} className="text-[var(--ink-tertiary)]" />
                : <Sparkles size={11} className="text-[var(--ink-tertiary)]" />
              }
              <span className="max-w-[120px] truncate">{configLoading ? '加载中...' : (effectiveModel?.modelName ?? effectiveProvider.name)}</span>
              <ChevronDown size={12} className="shrink-0" />
            </button>

            <button
              onClick={isLoading ? onStop : handleSend}
              disabled={!isLoading && !canSend}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{
                background: isLoading || canSend ? 'var(--accent-warm, #3d3d3d)' : 'var(--border)',
                cursor: isLoading || canSend ? 'pointer' : 'default',
              }}
              title={isLoading ? '停止' : '发送 (Enter)'}
            >
              <Send size={14} color="white" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
