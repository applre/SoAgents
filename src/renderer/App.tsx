import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelRightOpen, PanelRightClose, PanelLeftOpen, SquarePen, Settings2 } from 'lucide-react';
import { startWindowDrag } from './utils/env';
import type { Tab, OpenFile } from './types/tab';
import LeftSidebar from './components/LeftSidebar';
import { startGlobalSidecar, getDefaultWorkspace } from './api/tauriClient';
import Launcher from './pages/Launcher';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Editor from './pages/Editor';
import WorkspaceFilesPanel from './components/WorkspaceFilesPanel';
import { EditorActionBar, RichTextToolbar } from './components/EditorToolbar';
import type { ToolbarAction } from './components/EditorToolbar';
import { ConfigProvider } from './context/ConfigProvider';
import type { SessionMetadata } from '../shared/types/session';

function createTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: crypto.randomUUID(),
    title: '新标签页',
    view: 'launcher',
    agentDir: null,
    sessionId: null,
    isGenerating: false,
    openFiles: [],
    activeSubTab: 'chat',
    ...overrides,
  };
}

const INITIAL_TAB = createTab();

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([INITIAL_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>(INITIAL_TAB.id);
  const [tabSessions, setTabSessions] = useState<Record<string, SessionMetadata[]>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [pendingInjects, setPendingInjects] = useState<Record<string, string>>({});
  const resetSessionRef = useRef<(() => Promise<void>) | null>(null);
  const deleteSessionRef = useRef<((sessionId: string) => Promise<void>) | null>(null);
  const updateSessionTitleRef = useRef<((sessionId: string, title: string) => Promise<void>) | null>(null);
  const [pinnedSessionIds, setPinnedSessionIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('soagents:pinned-sessions');
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });
  // 编辑器 action ref：由 Editor 组件通过 onActionRef 暴露
  const editorActionRef = useRef<{ handleAction: (a: ToolbarAction) => void; save: () => void } | null>(null);

  useEffect(() => {
    startGlobalSidecar().catch(console.error);
    // 获取默认工作区路径，打开初始 tab
    getDefaultWorkspace().then((dir) => {
      if (!dir) return;
      setTabs((prev) => prev.map((t) =>
        t.id === INITIAL_TAB.id && !t.agentDir
          ? { ...t, agentDir: dir, view: 'chat' as const, title: dir.split('/').pop() ?? dir }
          : t
      ));
    }).catch(console.error);
  }, []);

  const handleExposeReset = useCallback((fn: () => Promise<void>) => {
    resetSessionRef.current = fn;
  }, []);

  const handleExposeDeleteSession = useCallback((fn: (sessionId: string) => Promise<void>) => {
    deleteSessionRef.current = fn;
  }, []);

  const handleExposeUpdateTitle = useCallback((fn: (sessionId: string, title: string) => Promise<void>) => {
    updateSessionTitleRef.current = fn;
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      resetSessionRef.current?.().catch(console.error);
    }
    deleteSessionRef.current?.(sessionId).catch(console.error);
  }, [activeSessionId]);

  const handleRenameSession = useCallback((sessionId: string, title: string) => {
    updateSessionTitleRef.current?.(sessionId, title).catch(console.error);
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

  const handleSessionsChange = useCallback((tabId: string, s: SessionMetadata[]) => {
    setTabSessions((prev) => ({ ...prev, [tabId]: s }));
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
    setTabs((prev) => {
      const target = prev.find((t) => t.id === activeTabId && t.view === 'chat')
        ?? prev.find((t) => t.view === 'chat');
      if (!target) return prev;
      setActiveTabId(target.id);
      return prev.map((t) => (t.id === target.id ? { ...t, sessionId: null, activeSubTab: 'chat' } : t));
    });
    resetSessionRef.current?.().catch(console.error);
  }, [activeTabId]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setTabs((prev) => {
      const target = prev.find((t) => t.id === activeTabId && t.view === 'chat')
        ?? prev.find((t) => t.view === 'chat');
      if (!target) return prev;
      setActiveTabId(target.id);
      return prev.map((t) => (t.id === target.id ? { ...t, sessionId, activeSubTab: 'chat' } : t));
    });
  }, [activeTabId]);

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

  const handleAddWorkspace = useCallback(() => {
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const handleOpenWorkspace = useCallback((agentDir: string) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.agentDir === agentDir && t.view === 'chat');
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const tab = createTab({
        agentDir,
        view: 'chat',
        title: agentDir.split('/').pop() ?? agentDir,
        sessionId: null,
      });
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
    setActiveSessionId(null);
  }, []);

  const handleCloseTab = useCallback((tabId: string) => {
    setTabSessions((prev) => { const { [tabId]: _, ...rest } = prev; return rest; });
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

  const handleSelectWorkspace = useCallback((tabId: string, agentDir: string) => {
    setTabs((prev) => {
      // 若目标 agentDir 已在其他 tab 打开，直接跳转
      const existing = prev.find((t) => t.agentDir === agentDir && t.view === 'chat' && t.id !== tabId);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      setTabSessions((prev) => { const { [tabId]: _, ...rest } = prev; return rest; });
      setActiveSessionId(null);
      return prev.map((t) =>
        t.id === tabId
          ? { ...t, agentDir, view: 'chat' as const, title: agentDir.split('/').pop() ?? agentDir, sessionId: null }
          : t
      );
    });
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

  const isEditorActive = activeTab?.activeSubTab !== 'chat' && activeTab?.activeSubTab !== undefined;

  return (
    <ConfigProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--paper)]">
        {showSidebar ? (
          <LeftSidebar
            sessions={tabSessions[activeTabId] ?? []}
            activeSessionId={activeSessionId}
            pinnedSessionIds={pinnedSessionIds}
            onNewChat={handleNewChat}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onTogglePin={handleTogglePin}
            onOpenSettings={handleOpenSettings}
            onCollapse={() => setShowSidebar(false)}
            isSettingsActive={activeTab?.view === 'settings'}
          />
        ) : (
          <div
            className="flex shrink-0 flex-col items-center bg-[var(--surface)]"
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
              title="新建对话"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
            >
              <SquarePen size={18} />
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
              <Settings2 size={18} />
            </button>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* TopTabBar：工作区 */}
          <WorkspaceTabBar
            tabs={workspaceTabs}
            activeTabId={activeTabId}
            onSwitchTab={setActiveTabId}
            onAddWorkspace={handleAddWorkspace}
            onCloseTab={handleCloseTab}
            onSelectWorkspace={handleSelectWorkspace}
            onOpenWorkspace={handleOpenWorkspace}
            showFilesPanel={showFilesPanel}
            onToggleFilesPanel={() => setShowFilesPanel((v) => !v)}
          />

          {/* SecondTabBar：对话 + 打开的文件 tabs */}
          {activeTab && activeTab.view === 'chat' && (
            <div
              className="flex items-center shrink-0 bg-[var(--paper)]"
              style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', gap: 4, height: 44 }}
              onMouseDown={startWindowDrag}
            >
              <button
                onClick={() => handleSwitchSubTab('chat')}
                className="flex items-center gap-2 rounded-lg px-3 transition-colors"
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
                对话
              </button>

              {activeTab.openFiles.map((f) => {
                const isActive = activeTab.activeSubTab === f.filePath;
                return (
                  <div
                    key={f.filePath}
                    className="flex items-center gap-1.5"
                    style={{
                      height: 34,
                      borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      padding: '0 8px',
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleSwitchSubTab(f.filePath)}
                      style={{
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--ink)' : 'var(--ink-tertiary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {f.title}
                    </button>
                    <button
                      onClick={() => handleCloseFileTab(f.filePath)}
                      style={{
                        fontSize: 14,
                        color: 'var(--ink-tertiary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                      className="hover:text-[var(--ink)] transition-colors"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
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
              .filter((t) => t.view === 'chat' && t.agentDir)
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
                    <Chat
                      tab={t}
                      onSessionsChange={handleSessionsChange}
                      onActiveSessionChange={t.id === activeTabId ? setActiveSessionId : undefined}
                      onExposeReset={t.id === activeTabId ? handleExposeReset : undefined}
                      onExposeDeleteSession={t.id === activeTabId ? handleExposeDeleteSession : undefined}
                      onExposeUpdateTitle={t.id === activeTabId ? handleExposeUpdateTitle : undefined}
                      injectText={pendingInjects[t.id] ?? null}
                      onInjectConsumed={() => setPendingInjects((prev) => { const { [t.id]: _, ...rest } = prev; return rest; })}
                    />
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
                      <Editor
                        filePath={f.filePath}
                        mode={f.mode}
                        onActionRef={(ref) => { if (fileVisible) editorActionRef.current = ref; }}
                      />
                    </div>
                  );
                })
              )}

            {activeTab?.view === 'launcher' && (
              <Launcher tabId={activeTab.id} onSelectWorkspace={handleSelectWorkspace} />
            )}
            {activeTab?.view === 'settings' && <Settings />}
          </main>
        </div>

        {/* 文件面板：与 LeftSidebar 同级，全高列，内部自行管理对齐 */}
        {showFilesPanel && (
          <WorkspaceFilesPanel
            agentDir={activeTab?.agentDir ?? null}
            onOpenFile={openEditorFile}
          />
        )}
      </div>
    </ConfigProvider>
  );
}

// ── WorkspaceTabBar ───────────────────────────────────────────────────
const RECENT_DIRS_KEY = 'soagents:recent-dirs';

function loadRecentDirs(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_DIRS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface WorkspaceTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitchTab: (tabId: string) => void;
  onAddWorkspace: () => void;
  onCloseTab: (tabId: string) => void;
  onSelectWorkspace: (tabId: string, agentDir: string) => void;
  onOpenWorkspace: (agentDir: string) => void;
  showFilesPanel: boolean;
  onToggleFilesPanel: () => void;
}

function WorkspaceTabBar({ tabs, activeTabId, onSwitchTab, onAddWorkspace, onCloseTab, onSelectWorkspace, onOpenWorkspace, showFilesPanel, onToggleFilesPanel }: WorkspaceTabBarProps) {
  const [openDropdownTabId, setOpenDropdownTabId] = useState<string | null>(null);
  const [recentDirs, setRecentDirs] = useState<string[]>([]);

  useEffect(() => {
    if (openDropdownTabId) setRecentDirs(loadRecentDirs());
  }, [openDropdownTabId]);

  return (
    <div
      className="relative flex items-center justify-between px-5 border-b border-[var(--border)] bg-[var(--paper)] shrink-0 z-50"
      style={{ height: 48 }}
      onMouseDown={startWindowDrag}
    >
      {openDropdownTabId && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownTabId(null)} />
      )}

      <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isSettings = tab.view === 'settings';
          const label = isSettings ? '设置' : (tab.agentDir?.split('/').filter(Boolean).pop() ?? '新工作区');
          const isDropdownOpen = openDropdownTabId === tab.id;

          return (
            <div key={tab.id} className="relative">
              <div
                onClick={() => onSwitchTab(tab.id)}
                className="flex items-center gap-1 rounded-lg px-2.5 cursor-pointer select-none"
                style={{
                  height: 34,
                  background: isActive ? '#F0EDE8' : 'transparent',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <span className={`text-[14px] font-semibold ${isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-tertiary)]'}`}>
                  {label}
                </span>
                {isActive && (
                  <>
                    {!isSettings && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownTabId(isDropdownOpen ? null : tab.id);
                        }}
                        className="text-[12px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors px-0.5"
                      >
                        {isDropdownOpen ? '⌄' : '›'}
                      </button>
                    )}
                    {(isSettings || tabs.length > 1) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                        className="text-[14px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] leading-none w-4 text-center"
                      >
                        ×
                      </button>
                    )}
                  </>
                )}
              </div>

              {isDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1 z-50 min-w-[280px] rounded-xl border border-[var(--border)] bg-white py-1.5"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                >
                  {recentDirs.length === 0 ? (
                    <div className="px-3 py-2 text-[13px] text-[var(--ink-tertiary)]">暂无最近工作区</div>
                  ) : (
                    recentDirs.map((dir) => {
                      const isCurrentDir = dir === tab.agentDir;
                      const name = dir.split('/').filter(Boolean).pop() ?? dir;
                      return (
                        <button
                          key={dir}
                          onClick={() => { onOpenWorkspace(dir); setOpenDropdownTabId(null); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-[var(--hover)] transition-colors"
                        >
                          <svg className="h-4 w-4 shrink-0 text-[var(--ink-tertiary)]" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-[13px] font-medium text-[var(--ink)] truncate">{name}</p>
                            <p className="text-[11px] text-[var(--ink-tertiary)] truncate">{dir}</p>
                          </div>
                          {isCurrentDir && (
                            <svg className="h-4 w-4 shrink-0 text-[var(--accent)]" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      );
                    })
                  )}
                  <div className="mx-2 my-1 border-t border-[var(--border)]" />
                  <button
                    onClick={() => { onAddWorkspace(); setOpenDropdownTabId(null); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-[var(--hover)] transition-colors"
                  >
                    <svg className="h-4 w-4 shrink-0 text-[var(--ink-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="text-[13px] text-[var(--ink)]">添加工作区</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={onAddWorkspace}
          className="text-[18px] font-medium leading-none text-[var(--ink-tertiary)] hover:text-[var(--ink)] w-7 h-7 flex items-center justify-center rounded transition-colors"
        >
          +
        </button>
      </div>

      {/* 右侧：展开工作区文件面板（设置页隐藏） */}
      {tabs.find((t) => t.id === activeTabId)?.view !== 'settings' && (
        <button
          onClick={onToggleFilesPanel}
          onMouseDown={(e) => e.stopPropagation()}
          title="工作区文件"
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
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
