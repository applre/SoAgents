import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type DragEvent, type ClipboardEvent } from 'react';
import { Paperclip, Puzzle, Wrench, ChevronDown, Send, FileText, X, Zap, Image as ImageIcon } from 'lucide-react';
import SlashCommandMenu, { type CommandItem } from './SlashCommandMenu';
import { globalApiGetJson } from '../api/apiFetch';
import { useConfig } from '../context/ConfigContext';
import { useTabState } from '../context/TabContext';
import { PROVIDERS } from '../types/config';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { isTauri } from '../utils/env';
import { formatSize } from '../utils/formatSize';

type PermissionMode = 'acceptEdits' | 'default' | 'bypassPermissions' | 'plan';

const PERMISSION_MODES: { value: PermissionMode; label: string; desc: string }[] = [
  { value: 'acceptEdits',       label: '协同模式', desc: '自动接受文件编辑，遇到 Shell 命令时弹窗确认' },
  { value: 'default',           label: '确认模式', desc: '每次工具调用都需要手动确认，适合谨慎操作' },
  { value: 'bypassPermissions', label: '自主模式', desc: '全自动执行，跳过所有确认，适合批量任务' },
  { value: 'plan',              label: '计划模式', desc: '先制定详细计划，经用户批准后再执行，适合复杂任务' },
];

interface Props {
  onSend: (text: string, permissionMode?: string) => void;
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
  const [text, setText] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<{ name: string; content: string } | null>(null);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('acceptEdits');
  const [skillCommands, setSkillCommands] = useState<CommandItem[]>([]);
  const [showSkillPopover, setShowSkillPopover] = useState(false);
  const [showMCPPopover, setShowMCPPopover] = useState(false);
  const [showModelPopover, setShowModelPopover] = useState(false);
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
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const modeContainerRef = useRef<HTMLDivElement>(null);

  const { currentProvider, updateConfig } = useConfig();
  const { apiGet } = useTabState();
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
        !modeContainerRef.current?.contains(target)
      ) {
        setShowSkillPopover(false);
        setShowMCPPopover(false);
        setShowModelPopover(false);
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
    const filePaths = attachedFiles.map((f) => f.path).join(' ');
    const skillContent = selectedSkill?.content ?? '';
    const fullMessage = [filePaths, skillContent, trimmed].filter(Boolean).join('\n');
    if (!fullMessage || isLoading) return;
    onSend(fullMessage, permissionMode);
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

        {/* Model Popover */}
        {showModelPopover && (
          <div className="absolute bottom-full mb-2 right-0 z-50 w-56 rounded-xl border border-[var(--border)] bg-white shadow-lg overflow-hidden">
            <div className="px-3 py-2 text-xs font-medium text-[var(--ink-secondary)] border-b border-[var(--border)]">模型选择</div>
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => { updateConfig({ currentProviderId: p.id }); setShowModelPopover(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  currentProvider.id === p.id
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                }`}
              >
                <span className="truncate">{p.name}</span>
                {currentProvider.id === p.id && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Skill 标签卡片 */}
        {selectedSkill && (
          <div className="flex items-center gap-2 px-4 pt-3">
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5">
              <Zap size={13} className="text-[var(--ink-secondary)] shrink-0" />
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
                <div className="absolute bottom-full mb-2 right-0 z-50 w-64 rounded-xl border border-[var(--border)] bg-white shadow-lg overflow-hidden">
                  <div className="px-3 py-2 text-xs font-medium text-[var(--ink-secondary)] border-b border-[var(--border)]">执行权限模式</div>
                  {PERMISSION_MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => { setPermissionMode(m.value); setShowModePopover(false); }}
                      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)] ${
                        permissionMode === m.value ? 'bg-[var(--accent)]/8' : ''
                      }`}
                    >
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {permissionMode === m.value && (
                          <div className={`h-2 w-2 rounded-full ${
                            m.value === 'bypassPermissions' ? 'bg-amber-500' :
                            m.value === 'default' ? 'bg-blue-500' :
                            m.value === 'plan' ? 'bg-purple-500' : 'bg-[var(--accent)]'
                          }`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium leading-tight ${
                          permissionMode === m.value ? 'text-[var(--ink)]' : 'text-[var(--ink-secondary)]'
                        }`}>{m.label}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--ink-tertiary)] leading-snug">{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button
                ref={modeBtnRef}
                onClick={() => { setShowModePopover((v) => !v); setShowSkillPopover(false); setShowMCPPopover(false); setShowModelPopover(false); }}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  showModePopover
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : permissionMode === 'bypassPermissions'
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : permissionMode === 'default'
                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    : permissionMode === 'plan'
                    ? 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                    : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
                }`}
              >
                {PERMISSION_MODES.find(m => m.value === permissionMode)?.label}
                <ChevronDown size={10} className="shrink-0" />
              </button>
            </div>

            <button
              ref={modelBtnRef}
              onClick={() => { setShowModelPopover((v) => !v); setShowSkillPopover(false); setShowMCPPopover(false); }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
            >
              <span className="text-[var(--ink-tertiary)]">✦</span>
              <span className="max-w-[120px] truncate">{currentProvider.name}</span>
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
