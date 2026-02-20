import React, { useCallback, useState } from 'react';
import { PanelLeft, Plus } from 'lucide-react';
import { startWindowDrag } from '../utils/env';
import type { SessionMetadata } from '../types/session';
import SearchModal from './SearchModal';

interface Props {
  sessions: SessionMetadata[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onOpenSettings: () => void;
  onCollapse: () => void;
  isSettingsActive?: boolean;
}

export default function LeftSidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onOpenSettings,
  onCollapse,
  isSettingsActive = false,
}: Props) {
  const [showSearch, setShowSearch] = useState(false);

  const sessionTitle = useCallback((s: SessionMetadata) => {
    return s.title || '未命名对话';
  }, []);

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[var(--surface)]"
      style={{
        width: 278,
        minWidth: 278,
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* 上方可滚动内容区 */}
      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto min-h-0"
        style={{ paddingTop: 10, paddingLeft: 14, paddingRight: 14 }}
      >
        {/* 顶部：Logo + 折叠按钮（预留macOS traffic lights 空间）*/}
        <div
          className="flex shrink-0 items-center justify-between"
          style={{ height: 48, paddingLeft: 4, paddingRight: 4, marginTop: 24 }}
          onMouseDown={startWindowDrag}
        >
          <div className="flex items-center gap-2">
            <span className="text-[20px] font-semibold text-[var(--ink)]">SoAgents</span>
          </div>
          <PanelLeft
            size={20}
            className="text-[var(--ink-tertiary)] cursor-pointer hover:text-[var(--ink)] transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onCollapse}
          />
        </div>

        {/* 主菜单 */}
        <div className="flex shrink-0 flex-col gap-1">
          <button
            onClick={onNewChat}
            className="flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--hover)] transition-colors text-left"
          >
            新建对话
          </button>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--hover)] transition-colors text-left"
          >
            搜索对话
          </button>
        </div>

        {/* 最近对话 */}
        {!isSettingsActive && sessions.length > 0 && (
          <div
            className="flex flex-col gap-2.5 rounded-2xl"
            style={{ background: '#F5F3F0', padding: '10px 8px' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold text-[var(--ink-secondary)]">最近对话</span>
              </div>
              <button onClick={onNewChat}>
                <Plus size={16} className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors" />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {sessions.slice(0, 10).map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelectSession(s.id)}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-[14px] transition-colors truncate ${
                      isActive
                        ? 'bg-[var(--border)] text-[var(--ink)]'
                        : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                    }`}
                  >
                    {sessionTitle(s)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 搜索弹窗 */}
      {showSearch && (
        <SearchModal
          onSelectSession={onSelectSession}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* 固定底部：设置 */}
      <div style={{ padding: '0 14px 14px' }}>
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-2.5 px-2 rounded-lg h-[38px] w-full transition-colors text-left ${
            isSettingsActive
              ? 'bg-[var(--hover)] text-[var(--ink)]'
              : 'hover:bg-[var(--hover)] text-[var(--ink)]'
          }`}
        >
          <span className="text-[14px] font-medium">设置</span>
        </button>
      </div>
    </div>
  );
}
