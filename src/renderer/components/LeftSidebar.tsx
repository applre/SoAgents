import React, { useCallback } from 'react';
import { PanelLeft, Plus } from 'lucide-react';
import type { SessionMetadata } from '../types/session';

interface Props {
  sessions: SessionMetadata[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onOpenSettings: () => void;
}

export default function LeftSidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onOpenSettings,
}: Props) {
  const sessionTitle = useCallback((s: SessionMetadata) => {
    return s.title || '未命名对话';
  }, []);

  return (
    <div
      className="flex h-full flex-col gap-3 overflow-hidden bg-[var(--surface)]"
      style={{
        width: 278,
        minWidth: 278,
        borderRight: '1px solid var(--border)',
        paddingTop: 10,
        paddingBottom: 14,
        paddingLeft: 14,
        paddingRight: 14,
      }}
    >
      {/* 顶部：Logo + 折叠按钮（预留macOS traffic lights 空间）*/}
      <div
        className="flex shrink-0 items-center justify-between"
        style={{ height: 48, paddingLeft: 4, paddingRight: 4, marginTop: 24, WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="text-[20px] font-semibold text-[var(--ink)]">SoAgents</span>
        </div>
        <PanelLeft
          size={20}
          className="text-[var(--ink-tertiary)] cursor-pointer hover:text-[var(--ink)] transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
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
          className="flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--hover)] transition-colors text-left"
        >
          搜索对话
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--hover)] transition-colors text-left"
        >
          设置
        </button>
      </div>

      {/* 最近对话 */}
      {sessions.length > 0 && (
        <div
          className="flex flex-col gap-2.5 rounded-2xl"
          style={{ background: '#F5F3F0', padding: '10px 12px' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--ink-tertiary)] text-sm">⌄</span>
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

      {/* 弹性空间 */}
      <div className="flex-1" />

      {/* 底部：用户信息 */}
      <div className="flex shrink-0 items-center gap-2 px-2" style={{ height: 42 }}>
        <div className="h-6 w-6 rounded-full bg-[var(--border)] shrink-0" />
        <span className="text-[14px] font-medium text-[var(--ink-tertiary)]">游客模式</span>
      </div>
    </div>
  );
}
