import { useState, useCallback, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import WorkspaceSelector from '../components/WorkspaceSelector';

interface Props {
  tabId: string;
  onSelectWorkspace: (tabId: string, agentDir: string, initialMessage?: string) => void;
}

export default function Launcher({ tabId, onSelectWorkspace }: Props) {
  const { workspaces, touchWorkspace } = useConfig();
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const recentWorkspaces = [...workspaces].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  const dirName = (p: string) => p.split('/').filter(Boolean).pop() ?? p;

  // Auto-select most recent workspace on mount
  useEffect(() => {
    if (!selectedDir && recentWorkspaces.length > 0) {
      setSelectedDir(recentWorkspaces[0].path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback((dir: string) => {
    setSelectedDir(dir);
    touchWorkspace(dir);
    setShowSelector(false);
    textareaRef.current?.focus();
  }, [touchWorkspace]);

  const handleSend = useCallback(() => {
    const text = message.trim();
    if (!text || !selectedDir) return;
    touchWorkspace(selectedDir);
    onSelectWorkspace(tabId, selectedDir, text);
  }, [message, selectedDir, tabId, onSelectWorkspace, touchWorkspace]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--paper)] px-8">
      <div className="w-full" style={{ maxWidth: 620 }}>
        {/* Welcome */}
        <div className="mb-8 text-center">
          <div style={{ fontSize: 40, opacity: 0.6, marginBottom: 16 }}>👋</div>
          <div className="text-[16px] text-[var(--ink-secondary)] mb-2">有什么可以帮你的?</div>
          {/* Workspace selector trigger */}
          <div className="relative inline-flex flex-col items-center">
            <button
              onClick={() => setShowSelector((v) => !v)}
              className="inline-flex items-baseline gap-1.5 cursor-pointer hover:opacity-70 transition-opacity"
            >
              <span className="text-[20px] font-medium text-[var(--ink)]">
                {selectedDir ? dirName(selectedDir) : '选择工作区'}
              </span>
              <span className="text-[12px] text-[var(--ink-tertiary)]">▾</span>
            </button>
            {showSelector && (
              <WorkspaceSelector
                workspaces={recentWorkspaces}
                selectedPath={selectedDir}
                onSelect={handleSelect}
                onClose={() => setShowSelector(false)}
              />
            )}
          </div>
        </div>

        {/* Input */}
        <div
          className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息开始对话..."
            className="w-full resize-none border-none bg-transparent px-4 py-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] outline-none"
            rows={3}
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <button
              onClick={handleSend}
              disabled={!message.trim() || !selectedDir}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
