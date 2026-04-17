// Workspaces view — workspace list driven by ConfigContext.workspaces
// Click card = new chat, hover = settings button, right-click = context menu
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Bot, Folder, SlidersHorizontal, MessageSquarePlus, Trash2,
  Plus, HeartPulse, Loader2, Pencil, X, Check, Settings2,
} from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { useAgentStatuses } from '../hooks/useAgentStatuses';
import WorkspaceConfigPanel from '../components/WorkspaceConfigPanel';
import type { AgentConfig } from '../../shared/types/agentConfig';
import type { WorkspaceEntry } from '../../shared/types/workspace';

function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, '~');
}

function dirName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

const PLATFORM_LABELS: Record<string, string> = {
  telegram: 'TG',
  feishu: '飞书',
  dingtalk: '钉钉',
};

// Curated icon list (subset of Lucide for workspace icons)
const ICON_OPTIONS = [
  'folder', 'code', 'globe', 'book', 'briefcase', 'box', 'cpu',
  'database', 'file-text', 'git-branch', 'home', 'layers', 'layout',
  'monitor', 'package', 'pen-tool', 'rocket', 'server', 'shield',
  'star', 'terminal', 'zap', 'heart', 'music', 'camera', 'coffee',
] as const;

interface Props {
  onNewChatInDir: (agentDir: string) => void;
  onAddWorkspace: () => void;
}

interface MenuState {
  ws: WorkspaceEntry;
  x: number;
  y: number;
}

interface EditState {
  ws: WorkspaceEntry;
  name: string;
  icon: string;
}

export default function WorkspacesView({ onNewChatInDir, onAddWorkspace }: Props) {
  const { config, workspaces, updateWorkspaceConfig, removeWorkspace } = useConfig();
  const { statuses } = useAgentStatuses();
  const [settingsPath, setSettingsPath] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [launchingPath, setLaunchingPath] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const agents: AgentConfig[] = useMemo(() => config.agents ?? [], [config.agents]);

  const agentByPath = useMemo(() => {
    const map = new Map<string, AgentConfig>();
    for (const a of agents) map.set(a.workspacePath, a);
    return map;
  }, [agents]);

  const sortedWorkspaces = useMemo(
    () => [...workspaces]
      .filter((ws) => !ws.internal)
      .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)),
    [workspaces],
  );

  // Close context menu on outside click
  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menu]);

  const handleCardClick = useCallback((ws: WorkspaceEntry) => {
    setLaunchingPath(ws.path);
    onNewChatInDir(ws.path);
    // Clear loading after a short delay (tab switch is near-instant)
    setTimeout(() => setLaunchingPath(null), 600);
  }, [onNewChatInDir]);

  const handleContextMenu = useCallback((e: React.MouseEvent, ws: WorkspaceEntry) => {
    e.preventDefault();
    setMenu({ ws, x: e.clientX, y: e.clientY });
  }, []);

  const handleOpenSettings = useCallback((ws: WorkspaceEntry) => {
    setSettingsPath(ws.path);
    setMenu(null);
  }, []);

  const handleRemoveWorkspace = useCallback(async (ws: WorkspaceEntry) => {
    setMenu(null);
    await removeWorkspace(ws.path);
  }, [removeWorkspace]);

  const handleStartEdit = useCallback((ws: WorkspaceEntry) => {
    setEditState({
      ws,
      name: ws.displayName || dirName(ws.path),
      icon: ws.icon || '',
    });
    setMenu(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editState) return;
    const folderName = dirName(editState.ws.path);
    await updateWorkspaceConfig(editState.ws.path, {
      displayName: editState.name.trim() === folderName ? undefined : editState.name.trim() || undefined,
      icon: editState.icon || undefined,
    });
    setEditState(null);
  }, [editState, updateWorkspaceConfig]);

  return (
    <>
    {/* Agent settings overlay (same as WorkspaceFilesPanel "Agent 设置") */}
    {settingsPath && (
      <WorkspaceConfigPanel
        agentDir={settingsPath}
        isOpen
        onClose={() => setSettingsPath(null)}
      />
    )}
    <div className="h-full overflow-y-auto px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--ink)]">工作区</h2>
          <p className="mt-1 text-[13px] text-[var(--ink-tertiary)]">
            点击工作区开始对话，或通过设置按钮管理 Agent 配置。
          </p>
        </div>
        <button
          onClick={onAddWorkspace}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          添加
        </button>
      </div>

      {/* Grid */}
      {sortedWorkspaces.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border)] px-8 py-16">
          <Folder className="h-8 w-8 text-[var(--ink-tertiary)]" />
          <p className="mt-3 text-sm text-[var(--ink-tertiary)]">
            尚未添加工作区。点击上方「添加」按钮选择本地文件夹。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {sortedWorkspaces.map((ws) => {
            const agent = agentByPath.get(ws.path);
            const isActiveAgent = !!agent?.enabled;
            const agentStatus = isActiveAgent ? statuses[agent!.id] : undefined;
            const onlineChannels = agentStatus?.channels.filter((ch) => ch.status === 'online' || ch.status === 'connecting').length ?? 0;
            const totalChannels = isActiveAgent ? (agent?.channels?.length ?? 0) : 0;
            const hasHeartbeat = isActiveAgent && agent?.heartbeat?.enabled;
            const isLoading = launchingPath === ws.path;

            return (
              <div
                key={ws.path}
                className={`group relative rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-all hover:border-[var(--accent)]/40 hover:shadow-sm ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
                onContextMenu={(e) => handleContextMenu(e, ws)}
              >
                {/* Main clickable area */}
                <button
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:scale-[0.98] transition-transform"
                  onClick={() => handleCardClick(ws)}
                  disabled={isLoading}
                >
                  {/* Icon */}
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--hover)]">
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin text-[var(--ink-secondary)]" />
                    ) : isActiveAgent ? (
                      <Bot size={16} className="text-[var(--ink-secondary)]" />
                    ) : (
                      <Folder size={16} className="text-[var(--ink-tertiary)]" />
                    )}
                    {!isLoading && isActiveAgent && totalChannels > 0 && (
                      <div
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)]"
                        style={{
                          background: onlineChannels > 0 ? 'var(--success)' : 'var(--ink-tertiary)',
                        }}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Name + badges (single line) */}
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold text-[var(--ink)]">
                        {ws.displayName || agent?.name || dirName(ws.path)}
                      </span>
                      {hasHeartbeat && (
                        <HeartPulse size={11} className="shrink-0 text-[var(--accent)]" />
                      )}
                      {agent && !isActiveAgent && (
                        <span className="shrink-0 rounded px-1 py-px text-[10px] bg-[var(--hover)] text-[var(--ink-tertiary)]">
                          停用
                        </span>
                      )}
                    </div>

                    {/* Path */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="truncate text-[11px] text-[var(--ink-tertiary)]">
                        {shortenPath(ws.path)}
                      </span>
                    </div>

                    {/* Channel badges with status colors */}
                    {isActiveAgent && totalChannels > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {agent.channels.map((ch) => {
                          const chStatus = agentStatus?.channels.find((s) => s.channelId === ch.id);
                          const isOnline = chStatus?.status === 'online' || chStatus?.status === 'connecting';
                          const isError = chStatus?.status === 'error';
                          return (
                            <span
                              key={ch.id}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] bg-[var(--hover)] text-[var(--ink-tertiary)]"
                            >
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-full"
                                style={{
                                  background: isOnline ? 'var(--success)' : isError ? 'var(--error)' : 'var(--ink-tertiary)',
                                }}
                              />
                              {PLATFORM_LABELS[ch.type] || ch.type}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {isActiveAgent && totalChannels === 0 && (
                      <div className="mt-0.5 text-[11px] text-[var(--accent)]/70">
                        待配置聊天机器人
                      </div>
                    )}
                  </div>

                  {/* Agent settings button — always visible */}
                  {!isLoading && (
                    <div
                      className="group/btn relative shrink-0 rounded-lg p-1.5 text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); handleOpenSettings(ws); }}
                      title="Agent 设置"
                    >
                      <SlidersHorizontal size={14} strokeWidth={2.2} />
                      <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ink)] px-2 py-0.5 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover/btn:opacity-100">
                        Agent 设置
                      </span>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-xl border border-[var(--border)] bg-white py-1"
          style={{ left: menu.x, top: menu.y, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          <button
            onClick={() => { onNewChatInDir(menu.ws.path); setMenu(null); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
          >
            <MessageSquarePlus size={14} />
            新建对话
          </button>
          <button
            onClick={() => handleStartEdit(menu.ws)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
          >
            <Pencil size={14} />
            编辑工作区
          </button>
          <button
            onClick={() => handleOpenSettings(menu.ws)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
          >
            <Settings2 size={14} />
            Agent 设置
          </button>
          <button
            onClick={() => void handleRemoveWorkspace(menu.ws)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--error)] hover:bg-[var(--hover)] transition-colors"
          >
            <Trash2 size={14} />
            移除工作区
          </button>
        </div>
      )}

      {/* Edit dialog */}
      {editState && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setEditState(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[var(--ink)]">编辑工作区</h3>
              <button
                onClick={() => setEditState(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Icon picker */}
            <label className="mb-2 block text-[12px] font-medium text-[var(--ink-secondary)]">图标</label>
            <div className="mb-4 grid grid-cols-9 gap-1.5 max-h-[140px] overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              {/* Default (no icon) */}
              <button
                onClick={() => setEditState((s) => s ? { ...s, icon: '' } : s)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  !editState.icon ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]' : 'hover:bg-[var(--hover)]'
                }`}
                title="默认"
              >
                <Folder size={14} className={!editState.icon ? 'text-[var(--accent)]' : 'text-[var(--ink-tertiary)]'} />
              </button>
              {ICON_OPTIONS.filter((i) => i !== 'folder').map((iconId) => (
                <button
                  key={iconId}
                  onClick={() => setEditState((s) => s ? { ...s, icon: iconId } : s)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-[12px] ${
                    editState.icon === iconId ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]' : 'hover:bg-[var(--hover)]'
                  }`}
                  title={iconId}
                >
                  <span className={editState.icon === iconId ? 'text-[var(--accent)]' : 'text-[var(--ink-tertiary)]'}>
                    {iconId.charAt(0).toUpperCase()}
                  </span>
                </button>
              ))}
            </div>

            {/* Name input */}
            <label className="mb-2 block text-[12px] font-medium text-[var(--ink-secondary)]">名称</label>
            <input
              value={editState.name}
              onChange={(e) => setEditState((s) => s ? { ...s, name: e.target.value } : s)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveEdit(); if (e.key === 'Escape') setEditState(null); }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              placeholder={dirName(editState.ws.path)}
              autoFocus
            />

            {/* Path (read-only) */}
            <div className="mt-3 text-[11px] text-[var(--ink-tertiary)] truncate">
              {shortenPath(editState.ws.path)}
            </div>

            {/* Actions */}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditState(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => void handleSaveEdit()}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                <Check size={14} />
                保存
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}
