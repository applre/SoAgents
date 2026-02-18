import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { Paperclip, Sparkles, Key, ChevronDown, Send, FileText, X } from 'lucide-react';
import SlashCommandMenu, { type CommandItem } from './SlashCommandMenu';
import { globalApiGetJson } from '../api/apiFetch';
import { useConfig } from '../context/ConfigContext';
import { useTabState } from '../context/TabContext';
import { PROVIDERS } from '../types/config';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { isTauri } from '../utils/env';

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  isLoading: boolean;
  agentDir?: string;
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
}

function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
}

export default function ChatInput({ onSend, onStop, isLoading, agentDir }: Props) {
  const [text, setText] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [skillCommands, setSkillCommands] = useState<CommandItem[]>([]);
  const [showSkillPopover, setShowSkillPopover] = useState(false);
  const [showMCPPopover, setShowMCPPopover] = useState(false);
  const [showModelPopover, setShowModelPopover] = useState(false);
  const [mcpServers, setMcpServers] = useState<Record<string, MCPServer>>({});
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skillBtnRef = useRef<HTMLButtonElement>(null);
  const mcpBtnRef = useRef<HTMLButtonElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);

  const { currentProvider, updateConfig } = useConfig();
  const { apiGet } = useTabState();
  const slashQuery = showSlash && text.startsWith('/') ? text.slice(1) : '';

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
        !mcpBtnRef.current?.contains(target) &&
        !modelBtnRef.current?.contains(target)
      ) {
        setShowSkillPopover(false);
        setShowMCPPopover(false);
        setShowModelPopover(false);
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
    const fullMessage = [filePaths, trimmed].filter(Boolean).join('\n');
    if (!fullMessage || isLoading) return;
    onSend(fullMessage);
    setText('');
    setAttachedFiles([]);
    setShowSlash(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, attachedFiles, isLoading, onSend]);

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
      setText(skill.content || `/${cmd}`);
    } catch {
      setText(`/${cmd}`);
    }
    setShowSlash(false);
    textareaRef.current?.focus();
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
      }
    }, 0);
  }, [agentDir]);

  const handleSkillSelect = useCallback(async (name: string) => {
    setShowSkillPopover(false);
    try {
      const path = agentDir
        ? `/api/skills/${name}?agentDir=${encodeURIComponent(agentDir)}`
        : `/api/skills/${name}`;
      const skill = await globalApiGetJson<{ content: string }>(path);
      setText(skill.content || '');
    } catch {
      setText('');
    }
    textareaRef.current?.focus();
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
      }
    }, 0);
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

  const canSend = text.trim().length > 0 || attachedFiles.length > 0;
  const mcpList = Object.entries(mcpServers);

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        className="relative rounded-2xl border border-[var(--border)] bg-white"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
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
          <div className="absolute bottom-full mb-2 left-0 z-50 w-72 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-white shadow-lg">
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

        {/* 附件卡片区 */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachedFiles.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 w-44"
              >
                {/* 文件图标 */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                  <FileText size={18} className="text-orange-500" />
                </div>
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
          placeholder="帮我写一份项目计划书  tab"
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
              <Sparkles size={16} />
            </button>

            <button
              ref={mcpBtnRef}
              onClick={() => { setShowMCPPopover((v) => !v); setShowSkillPopover(false); setShowModelPopover(false); }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                showMCPPopover ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
              }`}
              title="选择 MCP Server"
            >
              <Key size={16} />
            </button>
          </div>

          {/* 右侧：模型选择 + 发送 */}
          <div className="flex items-center gap-2">
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
