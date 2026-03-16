import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelRightOpen, PanelRightClose, PanelLeftOpen, Settings as SettingsIcon, MessageSquare, MessageSquarePlus, Search, Clock, FileText, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { startWindowDrag, toggleMaximize } from './utils/env';
import { initFrontendLogger } from './utils/frontendLogger';
import type { Tab, OpenFile } from './types/tab';
import LeftSidebar from './components/LeftSidebar';
import SearchModal from './components/SearchModal';
import { startGlobalSidecar, getDefaultWorkspace, stopSessionSidecar } from './api/tauriClient';
import { globalApiDeleteJson, globalApiPutJson } from './api/apiFetch';
import Chat, { WorkspaceTrigger } from './pages/Chat';
import { TabProvider } from './context/TabProvider';
import Settings from './pages/Settings';
import { ScheduledTasksView } from './components/scheduledTasks';
import { ScheduledTaskProvider } from './context/ScheduledTaskContext';
import Editor from './pages/Editor';
import WebViewPanel from './pages/WebViewPanel';
import WorkspaceFilesPanel from './components/WorkspaceFilesPanel';
import { EditorActionBar, RichTextToolbar } from './components/EditorToolbar';
import type { ToolbarAction } from './components/EditorToolbar';
import { ConfigProvider } from './context/ConfigProvider';
import { useUpdater } from './hooks/useUpdater';
import { useSidebarSessions } from './hooks/useSidebarSessions';
import type { SessionMetadata } from '../shared/types/session';

function createTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: crypto.randomUUID(),
    title: '新对话',
    view: 'chat',
    agentDir: null,
    sessionId: null,
    isGenerating: false,
    openFiles: [],
    activeSubTab: 'chat',
    ...overrides,
  };
}

const INITIAL_TAB = createTab();

/* ── 可拖拽的文件 Tab 项 ── */
function SortableFileTab({ file, isActive, onActivate, onClose }: {
  file: OpenFile;
  isActive: boolean;
  onActivate: (filePath: string) => void;
  onClose: (filePath: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.filePath });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group flex shrink-0 min-w-[100px] items-center gap-1.5 rounded-md transition-colors ${
        !isActive ? 'hover:bg-[var(--hover)]' : ''
      }`}
      onClick={() => onActivate(file.filePath)}
    >
      <div
        className="flex items-center gap-1.5"
        style={{
          height: 34,
          borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
          padding: '0 8px',
          cursor: 'pointer',
        }}
      >
        <FileText size={14} className="shrink-0" style={{ color: isActive ? 'var(--ink-secondary)' : 'var(--ink-tertiary)' }} />
        {/* 未保存修改标记圆点 */}
        {file.isDirty && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-warm)]" />
        )}
        <span
          title={file.title}
          className="max-w-[160px] truncate"
          style={{
            fontSize: 14,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? 'var(--ink)' : 'var(--ink-tertiary)',
          }}
        >
          {file.title}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(file.filePath); }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all hover:bg-black/10 ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{ color: 'var(--ink-tertiary)' }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([INITIAL_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>(INITIAL_TAB.id);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [runningSessions, setRunningSessions] = useState<Set<string>>(new Set());
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [pendingInjects, setPendingInjects] = useState<Record<string, string>>({});
  const [pendingRefText, setPendingRefText] = useState<Record<string, string>>({});
  const [pinnedSessionIds, setPinnedSessionIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('soagents:pinned-sessions');
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });
  // 编辑器 action ref：由 Editor 组件通过 onActionRef 暴露
  const editorActionRef = useRef<{ handleAction: (a: ToolbarAction) => void; save: () => void } | null>(null);

  // 文件 dirty 状态回调
  const handleDirtyChange = useCallback((filePath: string, isDirty: boolean) => {
    setTabs((prev) =>
      prev.map((t) => ({
        ...t,
        openFiles: t.openFiles.map((f) =>
          f.filePath === filePath ? { ...f, isDirty } : f
        ),
      }))
    );
  }, []);

  // Auto-updater
  const { updateReady, updateVersion, checking, checkForUpdate, restartAndUpdate } = useUpdater();

  // Independent session fetch for sidebar (all workspaces)
  const { sessions: allSessions } = useSidebarSessions();

  useEffect(() => {
    initFrontendLogger();
    // 必须等 global sidecar 就绪后再设置 agentDir，否则 refreshSessions 会因 sidecar 未启动而静默失败
    Promise.all([startGlobalSidecar(), getDefaultWorkspace()]).then(([, dir]) => {
      if (!dir) return;
      setTabs((prev) => prev.map((t) =>
        t.id === INITIAL_TAB.id && !t.agentDir
          ? { ...t, agentDir: dir, title: dir.split('/').pop() ?? dir }
          : t
      ));
    }).catch(console.error);
  }, []);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    // 停止 sidecar + 调用全局 API 删除 session
    await stopSessionSidecar(sessionId).catch(() => {});
    await globalApiDeleteJson(`/chat/sessions/${sessionId}`).catch(console.error);
    // 如果是当前活跃 session，重置 tab
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setTabs((prev) => prev.map((t) =>
        t.sessionId === sessionId ? { ...t, sessionId: null } : t
      ));
    }
  }, [activeSessionId]);

  const handleRenameSession = useCallback(async (sessionId: string, title: string) => {
    await globalApiPutJson(`/chat/sessions/${sessionId}/title`, { title }).catch(console.error);
  }, []);

  const handleTogglePin = useCallback((sessionId: string) => {
    setPinnedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      localStorage.setItem('soagents:pinned-sessions', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleRunningSessionsChange = useCallback((sessionId: string, running: boolean) => {
    setRunningSessions((prev) => {
      const next = new Set(prev);
      if (running) next.add(sessionId);
      else next.delete(sessionId);
      return next;
    });
  }, []);

  const handleSessionIdChange = useCallback((tabId: string, newSessionId: string) => {
    setTabs((prev) => prev.map((t) =>
      t.id === tabId ? { ...t, sessionId: newSessionId } : t
    ));
    setActiveSessionId(newSessionId);
  }, []);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  // 当前活跃的 OpenFile
  const activeOpenFile = useMemo<OpenFile | null>(() => {
    if (!activeTab || activeTab.activeSubTab === 'chat') return null;
    return activeTab.openFiles.find((f) => f.filePath === activeTab.activeSubTab) ?? null;
  }, [activeTab]);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    const dir = activeTab?.agentDir ?? null;
    const tab = createTab(dir ? {
      agentDir: dir,
      title: dir.split('/').pop() ?? '新对话',
    } : {});
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, [activeTab?.agentDir]);

  const handleOpenSettings = useCallback(() => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.view === 'settings');
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const tab = createTab({ title: '设置', view: 'settings' });
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, []);

  const handleOpenScheduledTasks = useCallback(() => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.view === 'scheduled-tasks');
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const tab = createTab({ title: '定时任务', view: 'scheduled-tasks' });
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, []);

  const handleAddWorkspace = useCallback(() => {
    const dir = activeTab?.agentDir ?? null;
    const tab = createTab(dir ? {
      agentDir: dir,
      title: dir.split('/').pop() ?? '新对话',
    } : {});
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, [activeTab?.agentDir]);


  const handleNavigateToSession = useCallback((agentDir: string, sessionId: string) => {
    setTabs((prev) => {
      // Find existing tab with this session
      const existing = prev.find((t) => t.sessionId === sessionId);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      // Create new tab for this session
      const tab = createTab({
        agentDir,
        view: 'chat',
        title: agentDir.split('/').pop() ?? agentDir,
        sessionId,
      });
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
    setActiveSessionId(sessionId);
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    const session = allSessions.find((s) => s.id === sessionId);
    if (session) {
      handleNavigateToSession(session.agentDir, sessionId);
    }
  }, [allSessions, handleNavigateToSession]);

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = newTabs[Math.min(idx, newTabs.length - 1)];
        setActiveTabId(next.id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const handleAgentDirChange = useCallback((tabId: string, agentDir: string) => {
    setActiveSessionId(null);
    setTabs((prev) => prev.map((t) =>
      t.id === tabId
        ? { ...t, agentDir, title: agentDir.split('/').pop() ?? agentDir, sessionId: null }
        : t
    ));
  }, []);

  // 打开文件：加入当前 workspace tab 的 openFiles，并切换 activeSubTab
  const openEditorFile = useCallback((filePath: string) => {
    const title = filePath.split('/').pop() ?? filePath;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const existing = t.openFiles.find((f) => f.filePath === filePath);
        const openFiles = existing
          ? t.openFiles
          : [...t.openFiles, { filePath, title, mode: 'edit' as const }];
        return { ...t, openFiles, activeSubTab: filePath };
      })
    );
  }, [activeTabId]);

  // 引用文件：将 @相对路径 注入到当前 chat 输入框
  const handleInsertReference = useCallback((paths: string[]) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab?.agentDir) return;
    const refText = paths
      .map((p) => {
        const rel = p.startsWith(tab.agentDir!) ? p.slice(tab.agentDir!.length + 1) : p;
        return p.endsWith('/') ? `@${rel}` : `@${rel}`;
      })
      .join('\n');
    setPendingRefText((prev) => ({ ...prev, [activeTabId]: refText }));
  }, [tabs, activeTabId]);

  // 打开 URL：在 SecondTabBar 中新建 WebView tab
  const openUrl = useCallback((url: string) => {
    let title: string;
    try { title = new URL(url).hostname; } catch { title = url; }
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const existing = t.openFiles.find((f) => f.filePath === url);
        const openFiles = existing
          ? t.openFiles
          : [...t.openFiles, { filePath: url, title, mode: 'preview' as const, isUrl: true }];
        return { ...t, openFiles, activeSubTab: url };
      })
    );
  }, [activeTabId]);

  // 关闭文件 tab
  const handleCloseFileTab = useCallback((filePath: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const openFiles = t.openFiles.filter((f) => f.filePath !== filePath);
        const activeSubTab = t.activeSubTab === filePath
          ? (openFiles[openFiles.length - 1]?.filePath ?? 'chat')
          : t.activeSubTab;
        return { ...t, openFiles, activeSubTab };
      })
    );
  }, [activeTabId]);

  // 拖拽排序文件 tabs
  const fileTabSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const handleFileTabDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeTab) return;
    const files = activeTab.openFiles;
    const oldIndex = files.findIndex((f) => f.filePath === active.id);
    const newIndex = files.findIndex((f) => f.filePath === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        return { ...t, openFiles: arrayMove(t.openFiles, oldIndex, newIndex) };
      })
    );
  }, [activeTab, activeTabId]);

  // 切换 SecondTabBar；从文件切到对话时注入文件路径引用
  const handleSwitchSubTab = useCallback((subTab: 'chat' | string, fromFilePath?: string) => {
    setTabs((prev) =>
      prev.map((t) => t.id === activeTabId ? { ...t, activeSubTab: subTab } : t)
    );
    if (subTab === 'chat' && fromFilePath) {
      setPendingInjects((prev) => ({ ...prev, [activeTabId]: fromFilePath }));
    }
  }, [activeTabId]);

  // 切换编辑/预览模式
  const handleSetFileMode = useCallback((mode: 'edit' | 'preview') => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        return {
          ...t,
          openFiles: t.openFiles.map((f) =>
            f.filePath === t.activeSubTab ? { ...f, mode } : f
          ),
        };
      })
    );
  }, [activeTabId]);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (!e.metaKey) return;
      if (e.key === 't') {
        e.preventDefault();
        handleAddWorkspace();
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [handleAddWorkspace]);

  const workspaceTabs = tabs;

  const isEditorActive = activeTab?.activeSubTab !== 'chat'
    && activeTab?.activeSubTab !== undefined
    && !activeOpenFile?.isUrl;

  return (
    <ConfigProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--paper)]">
        {showSidebar ? (
          <LeftSidebar
            sessions={allSessions}
            activeSessionId={activeSessionId}
            agentDir={activeTab?.agentDir ?? undefined}
            pinnedSessionIds={pinnedSessionIds}
            runningSessions={runningSessions}
            onNewChat={handleNewChat}
            onSelectSession={handleSelectSession}
            onNavigateToSession={handleNavigateToSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onTogglePin={handleTogglePin}
            onOpenSettings={handleOpenSettings}
            onOpenScheduledTasks={handleOpenScheduledTasks}
            onCollapse={() => setShowSidebar(false)}
            isSettingsActive={activeTab?.view === 'settings'}
            isScheduledTasksActive={activeTab?.view === 'scheduled-tasks'}
            updateReady={updateReady}
            updateVersion={updateVersion}
            onRestartAndUpdate={restartAndUpdate}
          />
        ) : (
          <div
            className="relative z-50 flex shrink-0 flex-col items-center bg-[var(--surface)]"
            style={{ width: 72, borderRight: '1px solid var(--border)', paddingTop: 10, paddingBottom: 14 }}
            onMouseDown={startWindowDrag}
          >
            {/* 展开按钮 */}
            <div style={{ marginTop: 24, height: 48 }} className="flex items-center justify-center">
              <PanelLeftOpen
                size={18}
                className="text-[var(--ink-tertiary)] cursor-pointer hover:text-[var(--ink)] transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setShowSidebar(true)}
              />
            </div>
            {/* 新建对话 */}
            <button
              onClick={handleNewChat}
              onMouseDown={(e) => e.stopPropagation()}
              title="新建对话"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
            >
              <MessageSquarePlus size={18} />
            </button>
            {/* 搜索对话 */}
            <button
              onClick={() => setShowSearch(true)}
              onMouseDown={(e) => e.stopPropagation()}
              title="搜索对话"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
            >
              <Search size={18} />
            </button>
            {/* 定时任务 */}
            <button
              onClick={handleOpenScheduledTasks}
              onMouseDown={(e) => e.stopPropagation()}
              title="定时任务"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                activeTab?.view === 'scheduled-tasks'
                  ? 'bg-[var(--hover)] text-[var(--ink)]'
                  : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
              }`}
            >
              <Clock size={18} />
            </button>
            {/* 弹性空间 */}
            <div className="flex-1" />
            {/* 设置 */}
            <button
              onClick={handleOpenSettings}
              title="设置"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                activeTab?.view === 'settings'
                  ? 'bg-[var(--hover)] text-[var(--ink)]'
                  : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
              }`}
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        )}

        {/* 搜索弹窗（收缩侧边栏时使用） */}
        {!showSidebar && showSearch && (
          <SearchModal
            agentDir={activeTab?.agentDir ?? undefined}
            onSelectSession={handleSelectSession}
            onClose={() => setShowSearch(false)}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* TopTabBar：工作区 */}
          <SessionTabBar
            tabs={workspaceTabs}
            activeTabId={activeTabId}
            allSessions={allSessions}
            onSwitchTab={setActiveTabId}
            onNewTab={handleAddWorkspace}
            onCloseTab={handleCloseTab}
            showFilesPanel={showFilesPanel}
            onToggleFilesPanel={() => setShowFilesPanel((v) => !v)}
          />

          {/* SecondTabBar：对话 + 打开的文件 tabs */}
          {activeTab && activeTab.view === 'chat' && (
            <div
              className="flex items-center shrink-0 overflow-x-auto bg-[var(--paper)] scrollbar-hide"
              style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', gap: 4, height: 44 }}
              onMouseDown={startWindowDrag}
            >
              <button
                onClick={() => handleSwitchSubTab('chat')}
                className="flex shrink-0 items-center gap-1.5 px-3 transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  height: 34,
                  fontSize: 14,
                  fontWeight: activeTab.activeSubTab === 'chat' ? 600 : 500,
                  color: activeTab.activeSubTab === 'chat' ? 'var(--ink)' : 'var(--ink-tertiary)',
                  borderBottom: activeTab.activeSubTab === 'chat' ? '2px solid var(--accent)' : '2px solid transparent',
                  borderRadius: 0,
                }}
              >
                <MessageSquare size={14} className="shrink-0" />
                <span>对话</span>
                {(() => {
                  const session = activeTab.sessionId ? allSessions.find((s) => s.id === activeTab.sessionId) : null;
                  return session?.title ? (
                    <span className="max-w-[120px] truncate text-[var(--ink-tertiary)] font-normal" title={session.title}>
                      {session.title}
                    </span>
                  ) : null;
                })()}
              </button>

              <DndContext
                sensors={fileTabSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleFileTabDragEnd}
              >
                <SortableContext items={activeTab.openFiles.map((f) => f.filePath)} strategy={horizontalListSortingStrategy}>
                  {activeTab.openFiles.map((f) => (
                    <SortableFileTab
                      key={f.filePath}
                      file={f}
                      isActive={activeTab.activeSubTab === f.filePath}
                      onActivate={(fp) => handleSwitchSubTab(fp)}
                      onClose={handleCloseFileTab}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* 编辑器工具栏：仅文件 tab 激活时显示 */}
          {isEditorActive && activeOpenFile && (() => {
            const isPreviewable = /\.(md|markdown|html|htm)$/i.test(activeOpenFile.filePath);
            const isMarkdown = /\.(md|markdown)$/i.test(activeOpenFile.filePath);
            return (
              <>
                <EditorActionBar
                  mode={isPreviewable ? activeOpenFile.mode : 'edit'}
                  isDirty={activeOpenFile.isDirty}
                  onModeChange={isPreviewable ? handleSetFileMode : undefined}
                  onSave={() => editorActionRef.current?.save()}
                  onGoToChat={() => handleSwitchSubTab('chat', activeOpenFile.filePath)}
                />
                {isMarkdown && (
                  <RichTextToolbar
                    mode={activeOpenFile.mode}
                    onAction={(action) => editorActionRef.current?.handleAction(action)}
                  />
                )}
              </>
            );
          })()}

          {/* 内容区：chat / editor */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {tabs
              .filter((t) => t.view === 'chat')
              .map((t) => {
                const chatVisible = activeTab?.id === t.id && t.activeSubTab === 'chat';
                return (
                  <div
                    key={t.id}
                    style={{
                      display: chatVisible ? 'flex' : 'none',
                      height: '100%',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      flex: 1,
                    }}
                  >
                    {t.agentDir ? (
                      <TabProvider
                        tabId={t.id}
                        agentDir={t.agentDir}
                        sessionId={t.sessionId}
                        isActive={activeTabId === t.id}
                        onRunningSessionsChange={handleRunningSessionsChange}
                        onSessionIdChange={(sid: string) => handleSessionIdChange(t.id, sid)}
                      >
                        <Chat
                          agentDir={t.agentDir}
                          onAgentDirChange={(dir) => handleAgentDirChange(t.id, dir)}
                          injectText={pendingInjects[t.id] ?? null}
                          onInjectConsumed={() => setPendingInjects((prev) => { const { [t.id]: _, ...rest } = prev; return rest; })}
                          injectRefText={pendingRefText[t.id] ?? null}
                          onRefTextConsumed={() => setPendingRefText((prev) => { const { [t.id]: _, ...rest } = prev; return rest; })}
                          onOpenUrl={openUrl}
                        />
                      </TabProvider>
                    ) : (
                      <div className="flex h-full flex-col bg-[var(--paper)]">
                        <div className="flex flex-1 flex-col items-center justify-center">
                          <div className="w-full px-8" style={{ maxWidth: 660 }}>
                            <div className="mb-6 text-center">
                              <h1 className="text-[26px] font-semibold text-[var(--ink)]">👋 有什么可以帮你的？</h1>
                              <div className="mt-2">
                                <WorkspaceTrigger agentDir={null} onAgentDirChange={(dir) => handleAgentDirChange(t.id, dir)} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            {tabs
              .filter((t) => t.view === 'chat')
              .flatMap((t) =>
                t.openFiles.map((f) => {
                  const fileVisible = activeTab?.id === t.id && t.activeSubTab === f.filePath;
                  return (
                    <div
                      key={`${t.id}:${f.filePath}`}
                      style={{
                        display: fileVisible ? 'flex' : 'none',
                        height: '100%',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        flex: 1,
                      }}
                    >
                      {f.isUrl ? (
                        <WebViewPanel url={f.filePath} visible={fileVisible} />
                      ) : (
                        <Editor
                          filePath={f.filePath}
                          mode={f.mode}
                          onDirtyChange={handleDirtyChange}
                          onActionRef={(ref) => { if (fileVisible) editorActionRef.current = ref; }}
                          onOpenUrl={openUrl}
                        />
                      )}
                    </div>
                  );
                })
              )}

            {activeTab?.view === 'settings' && (
              <Settings
                checkForUpdate={checkForUpdate}
                checking={checking}
              />
            )}
            {activeTab?.view === 'scheduled-tasks' && (
              <ScheduledTaskProvider>
                <ScheduledTasksView onNavigateToSession={handleNavigateToSession} />
              </ScheduledTaskProvider>
            )}
          </main>
        </div>

        {/* 文件面板：与 LeftSidebar 同级，全高列，内部自行管理对齐 */}
        {showFilesPanel && activeTab?.view !== 'settings' && activeTab?.view !== 'scheduled-tasks' && (
          <WorkspaceFilesPanel
            agentDir={activeTab?.agentDir ?? null}
            onOpenFile={openEditorFile}
            onInsertReference={handleInsertReference}
          />
        )}
      </div>
    </ConfigProvider>
  );
}

// ── SessionTabBar ─────────────────────────────────────────────────────

interface SessionTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  allSessions: SessionMetadata[];
  onSwitchTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
  showFilesPanel: boolean;
  onToggleFilesPanel: () => void;
}

function SessionTabBar({ tabs, activeTabId, allSessions, onSwitchTab, onNewTab, onCloseTab, showFilesPanel, onToggleFilesPanel }: SessionTabBarProps) {
  return (
    <div
      className="relative flex items-center justify-between px-5 border-b border-[var(--border)] bg-[var(--paper)] shrink-0 z-50"
      style={{ height: 48, paddingTop: 2 }}
      onMouseDown={startWindowDrag}
      onDoubleClick={toggleMaximize}
    >
      <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-hide" onMouseDown={(e) => e.stopPropagation()}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isSettings = tab.view === 'settings';
          const isScheduledTasks = tab.view === 'scheduled-tasks';
          const sessionMeta = tab.sessionId ? allSessions.find((s) => s.id === tab.sessionId) : null;
          const label = isSettings ? '设置' : isScheduledTasks ? '定时任务' : (sessionMeta?.title || '新对话');

          return (
            <div
              key={tab.id}
              onClick={() => onSwitchTab(tab.id)}
              className="flex items-center gap-1 rounded-lg px-2.5 cursor-pointer select-none shrink-0"
              style={{
                height: 34,
                maxWidth: 180,
                background: isActive ? '#F0EDE8' : 'transparent',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {isSettings && <SettingsIcon size={14} className={`shrink-0 ${isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-tertiary)]'}`} />}
              <span className={`text-[13px] font-semibold truncate ${isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-tertiary)]'}`}>
                {label}
              </span>
              {isActive && (isSettings || isScheduledTasks || tabs.length > 1) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                  className="text-[14px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] leading-none w-4 text-center shrink-0"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={onNewTab}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-[18px] font-medium leading-none text-[var(--ink-tertiary)] hover:text-[var(--ink)] w-7 h-7 flex items-center justify-center rounded transition-colors shrink-0"
        >
          +
        </button>
      </div>

      {/* 右侧：展开工作区文件面板（设置页/定时任务页隐藏） */}
      {tabs.find((t) => t.id === activeTabId)?.view !== 'settings' && tabs.find((t) => t.id === activeTabId)?.view !== 'scheduled-tasks' && (
        <button
          onClick={onToggleFilesPanel}
          onMouseDown={(e) => e.stopPropagation()}
          title="工作区文件"
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0 ${
            showFilesPanel
              ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
          }`}
        >
          {showFilesPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      )}
    </div>
  );
}
