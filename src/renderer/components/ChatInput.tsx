import { useState, useRef, useCallback, useEffect, useMemo, type KeyboardEvent, type DragEvent, type ClipboardEvent } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Paperclip, Puzzle, Wrench, ChevronDown, ChevronLeft, Send, Square, FileText, X, Image as ImageIcon, Lock, Check, Sparkles, ShieldCheck, Shield, Zap, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import SlashCommandMenu, { filterSlashCommands, type CommandItem } from './SlashCommandMenu';
import FileSearchMenu, { type FileSearchResult } from './FileSearchMenu';
import { globalApiGetJson } from '../api/apiFetch';
import { fetchMcpServers, pushEffectiveMcpServers } from '../services/mcpService';
import { useConfig } from '../context/ConfigContext';
import { useTabApi, useTabActive } from '../context/TabContext';
// allProviders 从 ConfigContext 获取，不再使用静态 PROVIDERS
import type { PermissionMode } from '../../shared/types/permission';
import type { ModelEntity, Provider, ProviderEnv } from '../../shared/types/config';
import { getEffectiveModelAliases } from '../../shared/providers';
import type { ChatImage } from '../types/chat';
import type { SkillItem } from '../../shared/types/skill';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { isTauri } from '../utils/env';
import { formatSize } from '../utils/formatSize';
import { Tag } from './Tag';

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
  onSend: (text: string, permissionMode?: string, skills?: SkillPayload[], images?: ChatImage[], model?: string, providerEnv?: import('../../shared/types/config').ProviderEnv, mcpEnabledServerIds?: string[]) => Promise<boolean> | boolean | void;
  onStop: () => void;
  isLoading: boolean;
  agentDir?: string;
  injectText?: string | null;
  onInjectConsumed?: () => void;
  injectRefText?: string | null;
  onRefTextConsumed?: () => void;
}

interface MCPServerItem {
  id: string;
  name: string;
  description?: string;
  type: string;
  isBuiltin: boolean;
}

interface AttachedFile {
  path: string;
  name: string;
  size: number; // bytes
  isImage?: boolean; // 是否为图片
  base64?: string; // 图片的 base64 数据
}

export default function ChatInput({ onSend, onStop, isLoading, agentDir, injectText, onInjectConsumed, injectRefText, onRefTextConsumed }: Props) {
  const { config, allProviders, currentProvider, updateConfig, isLoading: configLoading, workspaces, updateWorkspaceConfig } = useConfig();
  const { apiGet, hasMessages } = useTabApi();
  const isActive = useTabActive();
  const isProviderLocked = hasMessages;

  // Provider 可用性检查：subscription 类型暂时放行，api 类型需要有 key
  const isProviderAvailable = useCallback((p: Provider): boolean => {
    if (p.type === 'subscription') return true;
    return !!config.apiKeys[p.id];
  }, [config.apiKeys]);

  // Per-workspace entry (must be before permissionMode state init)
  const wsEntry = agentDir ? workspaces.find((w) => w.path === agentDir) : undefined;
  const wsEntryRef = useRef(wsEntry);
  wsEntryRef.current = wsEntry;

  const [text, setText] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [slashPosition, setSlashPosition] = useState<number | null>(null);
  const [slashSearchQuery, setSlashSearchQuery] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  // @ 文件搜索
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [atPosition, setAtPosition] = useState<number | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<{ name: string; content: string }[]>([]);
  const [skillPanelTab, setSkillPanelTab] = useState<'all' | 'selected'>('all');
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(wsEntry?.permissionMode ?? 'acceptEdits');
  // Sync permissionMode when workspace entry changes (e.g. workspace switch)
  const [prevWsPermMode, setPrevWsPermMode] = useState(wsEntry?.permissionMode);
  if (prevWsPermMode !== wsEntry?.permissionMode) {
    setPrevWsPermMode(wsEntry?.permissionMode);
    setPermissionMode(wsEntry?.permissionMode ?? 'acceptEdits');
  }
  const [skillCommands, setSkillCommands] = useState<CommandItem[]>([]);
  const [allSkills, setAllSkills] = useState<SkillItem[]>([]);
  const [showSkillPopover, setShowSkillPopover] = useState(false);
  const [showMCPPopover, setShowMCPPopover] = useState(false);
  const [showModelPopover, setShowModelPopover] = useState(false);
  const [showProviderSubmenu, setShowProviderSubmenu] = useState(false);
  const [showModePopover, setShowModePopover] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServerItem[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);
  const skillBtnRef = useRef<HTMLButtonElement>(null);
  const skillPopoverRef = useRef<HTMLDivElement>(null);
  const mcpBtnRef = useRef<HTMLButtonElement>(null);
  const mcpPopoverRef = useRef<HTMLDivElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const modelPopoverRef = useRef<HTMLDivElement>(null);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const modeContainerRef = useRef<HTMLDivElement>(null);
  const effectiveProvider = useMemo(() => {
    if (!wsEntry?.providerId || allProviders.length === 0) return currentProvider;
    return allProviders.find((p) => p.id === wsEntry.providerId) ?? currentProvider;
  }, [wsEntry, allProviders, currentProvider]);
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
  }, [effectiveProvider, wsEntry]);
  const isCurrentProviderAvailable = useMemo(() => isProviderAvailable(effectiveProvider), [isProviderAvailable, effectiveProvider]);

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

  // @引用注入：将 @path 文本插入到输入框
  useEffect(() => {
    if (!injectRefText) return;
    onRefTextConsumed?.();
    setText((prev) => {
      const separator = prev && !prev.endsWith('\n') ? '\n' : '';
      return prev + separator + injectRefText + ' ';
    });
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [injectRefText, onRefTextConsumed]);

  // 加载 slash commands（内置 + 自定义 + 技能）
  useEffect(() => {
    const loadCommands = async () => {
      try {
        const path = agentDir
          ? `/api/commands?agentDir=${encodeURIComponent(agentDir)}`
          : '/api/commands';
        const commands = await globalApiGetJson<CommandItem[]>(path);
        setSkillCommands(commands);
      } catch { /* 静默失败 */ }
    };
    loadCommands();
  }, [agentDir]);

  // 加载所有 skills（全局 + 项目级）用于技能选择器
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const path = agentDir
          ? `/api/skills?agentDir=${encodeURIComponent(agentDir)}`
          : '/api/skills';
        const skills = await globalApiGetJson<SkillItem[]>(path);
        setAllSkills(skills);
      } catch { /* 静默失败 */ }
    };
    loadSkills();
  }, [agentDir]);

  // @ 文件搜索 API — 搜索逻辑已下沉到 FileSearchMenu 内部

  // 加载全局已启用的 MCP servers（含错误处理、重试、初始同步）
  useEffect(() => {
    let cancelled = false;
    const syncToBackend = (globalEnabled: MCPServerItem[]) => {
      const wsIds = wsEntryRef.current?.mcpEnabledServers;
      const effective = wsIds !== undefined
        ? globalEnabled.filter((s) => new Set(wsIds).has(s.id))
        : globalEnabled;
      pushEffectiveMcpServers(effective).catch(() => {});
    };
    const load = () => {
      fetchMcpServers()
        .then((data) => {
          if (cancelled) return;
          const enabledSet = new Set(data.enabledIds);
          const globalEnabled = data.servers.filter((s) => enabledSet.has(s.id));
          setMcpServers(globalEnabled);
          syncToBackend(globalEnabled);
        })
        .catch(() => {
          if (cancelled) return;
          // Sidecar 可能还没准备好，3 秒后重试一次
          setTimeout(() => {
            if (cancelled) return;
            fetchMcpServers()
              .then((data) => {
                if (cancelled) return;
                const enabledSet = new Set(data.enabledIds);
                const globalEnabled = data.servers.filter((s) => enabledSet.has(s.id));
                setMcpServers(globalEnabled);
                syncToBackend(globalEnabled);
              })
              .catch(() => { /* 静默：Settings 页面仍可管理 MCP */ });
          }, 3000);
        });
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Tab 激活时重新同步 MCP 到后端（用户可能在 Settings 中修改过）
  const prevActiveRef = useRef(false);
  useEffect(() => {
    const wasInactive = !prevActiveRef.current;
    prevActiveRef.current = isActive;
    if (!isActive || !wasInactive) return;

    fetchMcpServers()
      .then((data) => {
        const enabledSet = new Set(data.enabledIds);
        const globalEnabled = data.servers.filter((s) => enabledSet.has(s.id));
        setMcpServers(globalEnabled);
        const wsIds = wsEntryRef.current?.mcpEnabledServers;
        const wsSet = wsIds !== undefined ? new Set(wsIds) : null;
        const effective = wsSet ? globalEnabled.filter((s) => wsSet.has(s.id)) : globalEnabled;
        pushEffectiveMcpServers(effective).catch(() => {});
      })
      .catch(() => {});
  }, [isActive]);

  // 点外部关闭 popover
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !skillBtnRef.current?.contains(target) &&
        !skillPopoverRef.current?.contains(target) &&
        !mcpBtnRef.current?.contains(target) &&
        !mcpPopoverRef.current?.contains(target) &&
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
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;
    setText(newValue);

    // 检测新输入的字符（简单比较：长度+1 且光标在末尾附近）
    const addedChar = newValue.length === text.length + 1 ? newValue[cursorPos - 1] : null;

    let nextShowSlash = showSlash;
    let nextSlashPosition = slashPosition;

    // 检测 @ 触发
    if (addedChar === '@') {
      setShowFileSearch(true);
      setAtPosition(cursorPos - 1);
      // 关闭 / 菜单
      nextShowSlash = false;
      nextSlashPosition = null;
      setShowSlash(false);
      setSlashPosition(null);
    }

    // 检测 / 触发
    if (addedChar === '/') {
      nextShowSlash = true;
      nextSlashPosition = cursorPos - 1;
      setShowSlash(true);
      setSlashPosition(cursorPos - 1);
      setSlashSearchQuery('');
      setSelectedSlashIndex(0);
      // 关闭 @ 浮层
      setShowFileSearch(false);
      setAtPosition(null);
    }

    // @ 文件搜索弹窗：不再在 textarea 中追踪查询字符，搜索由 FileSearchMenu 内部管理

    // 更新 / 技能查询
    if (nextShowSlash && nextSlashPosition !== null) {
      if (nextSlashPosition >= newValue.length || newValue[nextSlashPosition] !== '/') {
        setShowSlash(false);
        setSlashPosition(null);
      } else {
        const textAfterSlash = newValue.slice(nextSlashPosition + 1, cursorPos);
        if (textAfterSlash.includes(' ') || textAfterSlash.includes('\n')) {
          setShowSlash(false);
          setSlashPosition(null);
        } else {
          setSlashSearchQuery(textAfterSlash);
          setSelectedSlashIndex(0);
        }
      }
    }

    // 自适应高度
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [text, showSlash, slashPosition]);

  // Guard against double-fire of handleSend (e.g. rapid Enter + click)
  const sendingRef = useRef(false);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    // 分离图片和普通文件
    const imageFiles = attachedFiles.filter((f) => f.isImage && f.base64);
    const regularFiles = attachedFiles.filter((f) => !f.isImage || !f.base64);
    const filePaths = regularFiles.map((f) => f.path).join(' ');
    // 用户可见文本（用户 Prompt 在前，文件路径在后）
    const userText = [trimmed, filePaths].filter(Boolean).join('\n');
    // skills 信息单独传递
    const skills = selectedSkills.length > 0 ? selectedSkills : undefined;
    if (!userText && !skills && imageFiles.length === 0) return;
    // Prevent double-fire — skip guard when already loading (queued send is intentional)
    if (!isLoading && sendingRef.current) return;
    if (!isLoading) sendingRef.current = true;

    try {
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
      // Build providerEnv from effective provider (assembled here, not in TabProvider)
      const selectedModel = effectiveModel?.model ?? effectiveProvider.primaryModel;
      const providerEnv: ProviderEnv | undefined = effectiveProvider && effectiveProvider.type === 'api'
        ? {
            baseUrl: effectiveProvider.config?.baseUrl,
            apiKey: config.apiKeys[effectiveProvider.id] ?? '',
            authType: effectiveProvider.authType,
            apiProtocol: effectiveProvider.apiProtocol,
            timeout: effectiveProvider.config?.timeout,
            disableNonessential: effectiveProvider.config?.disableNonessential,
            maxOutputTokens: effectiveProvider.maxOutputTokens,
            upstreamFormat: effectiveProvider.upstreamFormat,
            modelAliases: getEffectiveModelAliases(effectiveProvider, config.providerModelAliases),
          }
        : undefined;
      const mcpEnabledServerIds = wsEntry?.mcpEnabledServers;
      const result = onSend(userText, permissionMode, skills, images.length > 0 ? images : undefined, selectedModel, providerEnv, mcpEnabledServerIds);
      const accepted = result instanceof Promise ? await result : result;
      // Only clear input if not explicitly rejected
      if (accepted !== false) {
        setText('');
        setAttachedFiles([]);
        setSelectedSkills([]);
        setShowSlash(false);
        setSlashPosition(null);
        setShowFileSearch(false);
        setAtPosition(null);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    } finally {
      sendingRef.current = false;
    }
  }, [text, attachedFiles, selectedSkills, onSend, permissionMode, effectiveModel, effectiveProvider, config.apiKeys, config.providerModelAliases, wsEntry?.mcpEnabledServers, isLoading]);

  const handleFileSelect = useCallback((file: FileSearchResult) => {
    if (atPosition === null) return;
    const before = text.slice(0, atPosition);
    // 移除 @ 字符本身，替换为 @filepath
    const after = text.slice(atPosition + 1);
    setText(`${before}@${file.path} ${after}`);
    setShowFileSearch(false);
    setAtPosition(null);
    textareaRef.current?.focus();
  }, [atPosition, text]);

  // 追加 skill 到 selectedSkills（不重复）— 先乐观更新 UI，再异步拉内容
  const addSkill = useCallback((name: string) => {
    setSelectedSkills((prev) => {
      if (prev.some((s) => s.name === name)) return prev;
      return [...prev, { name, content: `/${name}` }];
    });
    // 异步拉取完整 content，不阻塞 UI
    const path = agentDir
      ? `/api/skills/${name}?agentDir=${encodeURIComponent(agentDir)}`
      : `/api/skills/${name}`;
    globalApiGetJson<{ content: string }>(path)
      .then((skill) => {
        if (skill.content) {
          setSelectedSkills((prev) =>
            prev.map((s) => s.name === name ? { ...s, content: skill.content } : s)
          );
        }
      })
      .catch(() => { /* 保留占位 content */ });
  }, [agentDir]);

  const removeSkill = useCallback((name: string) => {
    setSelectedSkills((prev) => prev.filter((s) => s.name !== name));
  }, []);

  const handleSlashSelect = useCallback(async (cmd: string) => {
    const removeTriggerText = () => {
      if (slashPosition !== null) {
        const before = text.slice(0, slashPosition);
        const cursorEnd = textareaRef.current?.selectionStart ?? (slashPosition + slashSearchQuery.length + 1);
        const after = text.slice(cursorEnd);
        return `${before}${after}`.trim();
      }
      return '';
    };

    // SDK 内置命令 — 填入输入框作为消息发送
    const SDK_BUILTINS = ['compact', 'context', 'cost', 'init', 'pr-comments', 'release-notes', 'review', 'security-review'];
    if (SDK_BUILTINS.includes(cmd)) {
      const before = slashPosition !== null ? text.slice(0, slashPosition) : '';
      const cursorEnd = textareaRef.current?.selectionStart ?? (slashPosition !== null ? slashPosition + slashSearchQuery.length + 1 : 0);
      const after = text.slice(cursorEnd);
      setText(`${before}/${cmd} ${after}`.trim());
      setShowSlash(false);
      setSlashPosition(null);
      textareaRef.current?.focus();
      return;
    }

    // Skill — 作为 skill 附加到对话
    addSkill(cmd);
    setText(removeTriggerText());
    setShowSlash(false);
    setSlashPosition(null);
    textareaRef.current?.focus();
  }, [slashPosition, text, slashSearchQuery, addSkill]);

  // Compute filtered slash commands for keyboard nav
  const filteredSlashCommands = useMemo(
    () => filterSlashCommands(skillCommands, slashSearchQuery),
    [skillCommands, slashSearchQuery],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // @ 文件搜索键盘导航 — 由 FileSearchMenu 内部处理
      if (showFileSearch) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowFileSearch(false);
          setAtPosition(null);
          return;
        }
        return;
      }
      // / 技能键盘导航 — 在父组件中处理
      if (showSlash && filteredSlashCommands.length > 0) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowSlash(false);
          setSlashPosition(null);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedSlashIndex((i) => Math.min(i + 1, filteredSlashCommands.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedSlashIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const cmd = filteredSlashCommands[selectedSlashIndex];
          if (cmd) handleSlashSelect(cmd.name);
          return;
        }
      }
      // IME composition guard — 防止中文输入法 Enter 触发发送
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, handleSlashSelect, showSlash, showFileSearch, filteredSlashCommands, selectedSlashIndex]
  );

  const handleSkillToggle = useCallback((name: string) => {
    if (selectedSkills.some((s) => s.name === name)) {
      removeSkill(name);
    } else {
      addSkill(name);
    }
  }, [selectedSkills, addSkill, removeSkill]);

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
  }, [apiGet]);

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

  // Tauri 原生文件拖拽监听（浏览器 dataTransfer.files 在 Tauri 中拿不到系统文件）
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    listen<{ paths: string[]; position: { x: number; y: number } }>('tauri://drag-drop', async (event) => {
      const paths = event.payload.paths;
      if (!paths || paths.length === 0) return;
      setIsDragging(false);
      dragCounterRef.current = 0;
      const newFiles: AttachedFile[] = await Promise.all(
        paths.map(async (p): Promise<AttachedFile> => {
          const name = p.split('/').pop() || p;
          const ext = name.split('.').pop()?.toLowerCase() || '';
          const isImg = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
          try {
            const info = await apiGet<{ size: number }>(`/api/file-stat?path=${encodeURIComponent(p)}`);
            return { path: p, name, size: info.size, isImage: isImg };
          } catch {
            return { path: p, name, size: 0, isImage: isImg };
          }
        })
      );
      setAttachedFiles((prev) => {
        const filtered = newFiles.filter((f) => !prev.some((pf) => pf.path === f.path));
        return [...prev, ...filtered];
      });
      textareaRef.current?.focus();
    }).then((fn) => { unlisten = fn; });

    listen('tauri://drag-enter', () => setIsDragging(true)).then((fn) => {
      const prev = unlisten;
      unlisten = () => { prev?.(); fn(); };
    });

    listen('tauri://drag-leave', () => {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }).then((fn) => {
      const prev = unlisten;
      unlisten = () => { prev?.(); fn(); };
    });

    return () => { unlisten?.(); };
  }, [apiGet]);

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

  const canSend = text.trim().length > 0 || attachedFiles.length > 0 || selectedSkills.length > 0;
  // Workspace-level MCP enable state
  const workspaceMcpEnabled = useMemo(() => new Set(wsEntry?.mcpEnabledServers ?? []), [wsEntry?.mcpEnabledServers]);
  const handleWorkspaceMcpToggle = useCallback((serverId: string, enabled: boolean) => {
    if (!agentDir) return;
    const current = wsEntry?.mcpEnabledServers ?? [];
    const next = enabled ? [...current, serverId] : current.filter((id) => id !== serverId);
    updateWorkspaceConfig(agentDir, { mcpEnabledServers: next });
    // 立即同步到后端
    const wsSet = new Set(next);
    const effectiveServers = mcpServers.filter((s) => wsSet.has(s.id));
    pushEffectiveMcpServers(effectiveServers).catch((err) => {
      console.error('[ChatInput] Failed to sync MCP to backend:', err);
    });
  }, [agentDir, wsEntry?.mcpEnabledServers, updateWorkspaceConfig, mcpServers]);
  const workspaceMcpCount = mcpServers.filter((s) => workspaceMcpEnabled.has(s.id)).length;

  return (
    <div className="px-6 pb-4 pt-2 mx-auto w-full" style={{ maxWidth: 860 }}>
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
        {/* @ 文件搜索浮层 */}
        {showFileSearch && agentDir && (
          <FileSearchMenu
            agentDir={agentDir}
            onSelect={handleFileSelect}
            onClose={() => { setShowFileSearch(false); setAtPosition(null); }}
          />
        )}
        {/* Slash 命令菜单 */}
        {showSlash && (
          <SlashCommandMenu
            query={slashSearchQuery}
            selectedIndex={selectedSlashIndex}
            onSelect={handleSlashSelect}
            skillCommands={skillCommands}
          />
        )}

        {/* Skill 多选面板 */}
        {showSkillPopover && (
          <div ref={skillPopoverRef} className="absolute bottom-full mb-2 left-0 z-50 w-80 max-h-[360px] flex flex-col rounded-xl border border-[var(--border)] bg-white shadow-lg">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
              <span className="text-xs font-medium text-[var(--ink-secondary)]">技能列表</span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => {
                    for (const s of allSkills) {
                      addSkill(s.name);
                    }
                  }}
                  className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
                >
                  全选
                </button>
                <span className="text-[var(--border)]">|</span>
                <button
                  onClick={() => setSelectedSkills([])}
                  className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
                >
                  清除
                </button>
              </div>
            </div>
            {/* Tab 切换 */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border)]">
              <button
                onClick={() => setSkillPanelTab('selected')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  skillPanelTab === 'selected' ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium' : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
                }`}
              >
                已启用 ({selectedSkills.length})
              </button>
              <button
                onClick={() => setSkillPanelTab('all')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  skillPanelTab === 'all' ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium' : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
                }`}
              >
                全部
              </button>
            </div>
            {/* 搜索框 */}
            <div className="px-3 py-1.5 border-b border-[var(--border)]">
              <div className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1">
                <Search size={12} className="text-[var(--ink-tertiary)] shrink-0" />
                <input
                  type="text"
                  value={skillSearchQuery}
                  onChange={(e) => setSkillSearchQuery(e.target.value)}
                  placeholder="搜索技能..."
                  className="w-full text-xs bg-transparent outline-none text-[var(--ink)] placeholder:text-[var(--ink-tertiary)]"
                />
              </div>
            </div>
            {/* 列表 */}
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const baseList = skillPanelTab === 'selected'
                  ? allSkills.filter((s) => selectedSkills.some((ss) => ss.name === s.name))
                  : allSkills;
                const filtered = skillSearchQuery
                  ? baseList.filter((s) =>
                      s.name.toLowerCase().includes(skillSearchQuery.toLowerCase()) ||
                      s.description?.toLowerCase().includes(skillSearchQuery.toLowerCase())
                    )
                  : baseList;
                if (filtered.length === 0) {
                  return <div className="px-3 py-3 text-sm text-[var(--ink-tertiary)]">{skillPanelTab === 'selected' ? '暂无已启用技能' : '暂无技能'}</div>;
                }
                return filtered.map((s) => {
                  const isSelected = selectedSkills.some((ss) => ss.name === s.name);
                  return (
                    <button
                      key={`${s.source}:${s.name}`}
                      onClick={() => handleSkillToggle(s.name)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        isSelected ? 'bg-[var(--accent)]/5' : 'hover:bg-[var(--hover)]'
                      }`}
                    >
                      <span className={`shrink-0 w-4 ${isSelected ? 'text-[var(--accent)]' : 'text-transparent'}`}>
                        <Check size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium truncate block ${isSelected ? 'text-[var(--ink)]' : 'text-[var(--ink)]'}`}>{s.name}</span>
                        {s.description && (
                          <span className="text-xs text-[var(--ink-tertiary)] truncate block">{s.description}</span>
                        )}
                      </div>
                      <Tag variant="scope" tone={s.source === 'project' ? 'accent' : 'neutral'}>
                        {s.source === 'project' ? '项目' : '全局'}
                      </Tag>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* MCP Popover */}
        {showMCPPopover && (
          <div ref={mcpPopoverRef} className="absolute bottom-full mb-2 left-12 z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-[var(--border)] bg-white shadow-lg">
            <div className="px-3 py-2 text-xs font-medium text-[var(--ink-secondary)] border-b border-[var(--border)]">
              工具 (在此工作区启用)
            </div>
            {mcpServers.length === 0 ? (
              <div className="px-3 py-3 text-sm text-[var(--ink-tertiary)]">暂无全局启用的 MCP Server，前往设置添加</div>
            ) : (
              mcpServers.map((s) => {
                const isWsEnabled = workspaceMcpEnabled.has(s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--ink)] truncate">{s.name || s.id}</div>
                      {s.description && (
                        <div className="text-xs text-[var(--ink-tertiary)] truncate">{s.description}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWorkspaceMcpToggle(s.id, !isWsEnabled);
                      }}
                      className={`relative ml-2 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        isWsEnabled ? 'bg-[var(--accent)]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                          isWsEnabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })
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
                {allProviders.map((p) => {
                  const available = isProviderAvailable(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!available}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!available) return;
                        if (agentDir) {
                          updateWorkspaceConfig(agentDir, { providerId: p.id });
                        } else {
                          updateConfig({ currentProviderId: p.id });
                        }
                        setShowProviderSubmenu(false);
                      }}
                      title={!available ? '请在设置页面配置 API Key' : undefined}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                        !available
                          ? 'opacity-45 cursor-not-allowed text-[var(--ink-tertiary)]'
                          : effectiveProvider.id === p.id
                            ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                            : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                      }`}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-[10px] text-[var(--ink-tertiary)] bg-[var(--hover)] px-1 py-0.5 rounded">
                        {available ? p.cloudProvider : '未配置'}
                      </span>
                    </button>
                  );
                })}
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

        {/* Skill 标签卡片（多选） */}
        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
            {selectedSkills.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1">
                <Puzzle size={11} className="text-[var(--ink-secondary)] shrink-0" />
                <span className="text-xs font-medium text-[var(--ink)]">{s.name}</span>
                <button
                  onClick={() => removeSkill(s.name)}
                  className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
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
          placeholder={selectedSkills.length > 0 || attachedFiles.length > 0 || text.includes('@') ? "输入消息..." : "输入消息，使用 @ 引用文件，/ 使用技能..."}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] outline-none"
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
              className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                showSkillPopover || selectedSkills.length > 0 ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
              }`}
              title="选择技能"
            >
              <Puzzle size={16} />
              {selectedSkills.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-bold leading-none">
                  {selectedSkills.length}
                </span>
              )}
            </button>

            <button
              ref={mcpBtnRef}
              onClick={() => { setShowMCPPopover((v) => !v); setShowSkillPopover(false); setShowModelPopover(false); }}
              className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                showMCPPopover || workspaceMcpCount > 0 ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
              }`}
              title="选择 MCP Server"
            >
              <Wrench size={16} />
              {workspaceMcpCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-bold leading-none">
                  {workspaceMcpCount}
                </span>
              )}
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

            {/* Streaming 时：Stop + Send 并排；空闲时：仅 Send */}
            {isLoading && (
              <button
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ background: 'var(--error, #c25a3a)', cursor: 'pointer' }}
                title="停止"
              >
                <Square size={12} color="white" fill="white" />
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!canSend || !isCurrentProviderAvailable}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{
                background: canSend && isCurrentProviderAvailable ? 'var(--accent-warm, #3d3d3d)' : 'var(--border)',
                cursor: canSend && isCurrentProviderAvailable ? 'pointer' : 'default',
              }}
              title={!isCurrentProviderAvailable ? '请前往设置页面配置供应商 API Key' : '发送 (Enter)'}
            >
              <Send size={14} color="white" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
