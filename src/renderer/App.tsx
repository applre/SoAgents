import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Tab } from './types/tab';
import LeftSidebar from './components/LeftSidebar';
import { startGlobalSidecar } from './api/tauriClient';
import Launcher from './pages/Launcher';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Editor from './pages/Editor';
import WorkspaceFilesPanel from './components/WorkspaceFilesPanel';
import { ConfigProvider } from './context/ConfigProvider';
import type { SessionMetadata } from './types/session';

function createTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: crypto.randomUUID(),
    title: '新标签页',
    view: 'launcher',
    agentDir: null,
    sessionId: null,
    filePath: null,
    isGenerating: false,
    ...overrides,
  };
}

const INITIAL_TAB = createTab({
  title: 'soagents',
  view: 'chat',
  agentDir: '/Users/wangjida/repos/soagents',
});

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([INITIAL_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>(INITIAL_TAB.id);
  // 每个 tab 独立存储自己的 sessions
  const [tabSessions, setTabSessions] = useState<Record<string, SessionMetadata[]>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const resetSessionRef = useRef<(() => Promise<void>) | null>(null);

  // 启动全局 sidecar（Settings / WorkspaceFilesPanel 依赖）
  useEffect(() => {
    startGlobalSidecar().catch(console.error);
  }, []);
  const handleExposeReset = useCallback((fn: () => Promise<void>) => {
    resetSessionRef.current = fn;
  }, []);

  // tabId 由 Chat 内部通过 context 读取后传入，此回调无需依赖 activeTabId，保持稳定
  const handleSessionsChange = useCallback((tabId: string, s: SessionMetadata[]) => {
    setTabSessions((prev) => ({ ...prev, [tabId]: s }));
  }, []);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  // 新建对话（在当前 chat tab 中）
  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setTabs((prev) => {
      const target = prev.find((t) => t.id === activeTabId && t.view === 'chat')
        ?? prev.find((t) => t.view === 'chat');
      if (!target) return prev;
      setActiveTabId(target.id);
      return prev.map((t) => (t.id === target.id ? { ...t, sessionId: null } : t));
    });
    resetSessionRef.current?.().catch(console.error);
  }, [activeTabId]);

  // 选择历史 session
  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setTabs((prev) => {
      const target = prev.find((t) => t.id === activeTabId && t.view === 'chat')
        ?? prev.find((t) => t.view === 'chat');
      if (!target) return prev;
      setActiveTabId(target.id);
      return prev.map((t) => (t.id === target.id ? { ...t, sessionId } : t));
    });
  }, [activeTabId]);

  // editor tab：标题/路径更新
  const handleEditorTitleChange = useCallback((tabId: string, title: string, filePath: string) => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, title, filePath } : t));
  }, []);

  // 新建空白文档
  const handleNewEditor = useCallback(() => {
    const tab = createTab({ title: 'untitled.md', view: 'editor' });
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  // 打开 .md 文件
  const handleOpenEditorFile = useCallback(async () => {
    const { isTauri } = await import('./utils/env');
    if (!isTauri()) return;
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }], multiple: false });
    if (!selected || typeof selected !== 'string') return;
    const title = selected.split('/').pop() ?? 'untitled.md';
    // 若已打开同路径 tab，直接激活
    const existing = tabs.find((t) => t.view === 'editor' && t.filePath === selected);
    if (existing) { setActiveTabId(existing.id); return; }
    const tab = createTab({ title, view: 'editor', filePath: selected });
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, [tabs]);

  // 打开设置
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

  // 新增工作区：创建新的 launcher tab
  const handleAddWorkspace = useCallback(() => {
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  // 从下拉菜单打开工作区：已打开则跳转，否则新建 tab
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

  // 关闭 tab，同时清理该 tab 的 sessions 缓存
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

  // 工作区选择后更新 tab，清空该 tab 的旧 sessions 缓存
  const handleSelectWorkspace = useCallback((tabId: string, agentDir: string) => {
    setTabSessions((prev) => { const { [tabId]: _, ...rest } = prev; return rest; });
    setActiveSessionId(null);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, agentDir, view: 'chat' as const, title: agentDir.split('/').pop() ?? agentDir, sessionId: null }
          : t
      )
    );
  }, []);

  // 键盘快捷键：Cmd+T 新建工作区
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

  // 工作区 tab 列表（排除 settings），用于 WorkspaceTabBar
  const workspaceTabs = useMemo(
    () => tabs.filter((t) => t.view !== 'settings'),
    [tabs]
  );

  return (
    <ConfigProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--paper)]">
        {/* 左侧栏：显示当前活跃工作区的 sessions */}
        <LeftSidebar
          sessions={tabSessions[activeTabId] ?? []}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onOpenSettings={handleOpenSettings}
        />

        {/* 主内容区 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 工作区 TabBar（始终显示） */}
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

          <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-hidden">
            {/* 所有 chat tab 持久挂载，切换时仅切换 display，保持 sidecar 连接不断 */}
            {tabs
              .filter((t) => t.view === 'chat' && t.agentDir)
              .map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: activeTab?.id === t.id ? 'flex' : 'none',
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
                  />
                </div>
              ))}
            {/* editor tabs — 持久挂载，切换时仅 display 切换 */}
            {tabs
              .filter((t) => t.view === 'editor')
              .map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: activeTab?.id === t.id ? 'flex' : 'none',
                    height: '100%',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flex: 1,
                  }}
                >
                  <Editor
                    tabId={t.id}
                    initialFilePath={t.filePath}
                    onTitleChange={handleEditorTitleChange}
                  />
                </div>
              ))}
            {activeTab?.view === 'launcher' && (
              <Launcher tabId={activeTab.id} onSelectWorkspace={handleSelectWorkspace} />
            )}
            {activeTab?.view === 'settings' && <Settings />}
          </main>
          {showFilesPanel && (
            <WorkspaceFilesPanel agentDir={activeTab?.agentDir ?? null} />
          )}
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

// 工作区 TabBar
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
    if (openDropdownTabId) {
      setRecentDirs(loadRecentDirs());
    }
  }, [openDropdownTabId]);

  return (
    <div
      className="relative flex items-center justify-between px-5 border-b border-[var(--border)] bg-[var(--paper)] shrink-0 z-50"
      style={{ height: 48 }}
    >
      {/* 点击遮罩，关闭下拉 */}
      {openDropdownTabId && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownTabId(null)} />
      )}

      <div className="flex items-center gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const label = tab.agentDir?.split('/').filter(Boolean).pop() ?? '新工作区';
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownTabId(isDropdownOpen ? null : tab.id);
                      }}
                      className="text-[12px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors px-0.5"
                    >
                      {isDropdownOpen ? '⌄' : '›'}
                    </button>
                    {tabs.length > 1 && (
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

              {/* 工作区切换下拉菜单 */}
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
                          onClick={() => {
                            onOpenWorkspace(dir);
                            setOpenDropdownTabId(null);
                          }}
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
                    onClick={() => {
                      onAddWorkspace();
                      setOpenDropdownTabId(null);
                    }}
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

        {/* 新增工作区 */}
        <button
          onClick={onAddWorkspace}
          className="text-[18px] font-medium leading-none text-[var(--ink-tertiary)] hover:text-[var(--ink)] w-7 h-7 flex items-center justify-center rounded transition-colors"
        >
          +
        </button>
      </div>

      {/* 右侧：展开工作区文件面板 */}
      <button
        onClick={onToggleFilesPanel}
        title="工作区文件"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          showFilesPanel
            ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
            : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
          <line x1="10" y1="1.7" x2="10" y2="14.3" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
      </button>
    </div>
  );
}
