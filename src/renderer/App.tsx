import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Tab } from './types/tab';
import CustomTitleBar from './components/CustomTitleBar';
import TabBar from './components/TabBar';
import Launcher from './pages/Launcher';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { ConfigProvider } from './context/ConfigProvider';

function createTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: crypto.randomUUID(),
    title: '新标签页',
    view: 'launcher',
    agentDir: null,
    sessionId: null,
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

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  // 新建 Tab
  const handleNew = useCallback(() => {
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  // 关闭 Tab
  const handleClose = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length === 1) {
          // 最后一个 tab 不允许关闭，重置为初始状态
          const fresh = createTab({ title: '新标签页' });
          setActiveTabId(fresh.id);
          return [fresh];
        }
        const next = prev.filter((t) => t.id !== id);
        // 如果关闭的是当前激活的 tab，激活相邻的
        if (id === activeTabId) {
          const idx = prev.findIndex((t) => t.id === id);
          const newActive = next[Math.min(idx, next.length - 1)];
          setActiveTabId(newActive.id);
        }
        return next;
      });
    },
    [activeTabId]
  );

  // 打开设置 Tab（全局唯一）
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

  // 拖拽重排
  const handleReorder = useCallback((next: Tab[]) => {
    setTabs(next);
  }, []);

  // 工作区选择后更新 tab
  const handleSelectWorkspace = useCallback((tabId: string, agentDir: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, agentDir, view: 'chat' as const, title: agentDir.split('/').pop() ?? agentDir }
          : t
      )
    );
  }, []);

  // 键盘快捷键：Cmd+T 新建，Cmd+W 关闭
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (!e.metaKey) return;
      if (e.key === 't') {
        e.preventDefault();
        handleNew();
      } else if (e.key === 'w') {
        e.preventDefault();
        handleClose(activeTabId);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [activeTabId, handleNew, handleClose]);

  return (
    <ConfigProvider>
    <div className="flex h-screen flex-col bg-[var(--paper)] overflow-hidden">
      <CustomTitleBar>
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onActivate={setActiveTabId}
          onClose={handleClose}
          onNew={handleNew}
          onReorder={handleReorder}
          onOpenSettings={handleOpenSettings}
        />
      </CustomTitleBar>

      {/* 页面内容区 */}
      <main className="flex-1 overflow-hidden">
        {activeTab?.view === 'launcher' && activeTab && (
          <Launcher tabId={activeTab.id} onSelectWorkspace={handleSelectWorkspace} />
        )}
        {activeTab?.view === 'chat' && activeTab && <Chat tab={activeTab} />}
        {activeTab?.view === 'settings' && <Settings />}
      </main>
    </div>
    </ConfigProvider>
  );
}
