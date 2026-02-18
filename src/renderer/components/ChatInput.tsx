import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Square, ArrowUp } from 'lucide-react';
import SlashCommandMenu from './SlashCommandMenu';

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  isLoading: boolean;
}

export default function ChatInput({ onSend, onStop, isLoading }: Props) {
  const [text, setText] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const slashQuery = showSlash && text.startsWith('/') ? text.slice(1) : '';

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setShowSlash(val.startsWith('/'));
    // 自动高度
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText('');
    setShowSlash(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, isLoading, onSend]);

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

  const handleSlashSelect = useCallback((cmd: string) => {
    setText(`/${cmd}`);
    setShowSlash(false);
    textareaRef.current?.focus();
  }, []);

  const handleSlashClose = useCallback(() => {
    setShowSlash(false);
  }, []);

  const canSend = text.trim().length > 0;

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        className="relative rounded-2xl border border-[var(--border)] bg-white shadow-sm"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        {showSlash && (
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={handleSlashClose}
          />
        )}

        {/* 文本区域 */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (/ 使用技能)"
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] outline-none"
          style={{ minHeight: 44, maxHeight: 160 }}
        />

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          <div className="flex items-center gap-1">
            {/* 预留左侧工具图标位置 */}
          </div>

          {/* 发送 / 停止按钮 */}
          {isLoading ? (
            <button
              onClick={onStop}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-secondary)] transition-colors"
              title="停止"
            >
              <Square size={14} fill="white" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{
                background: canSend ? 'var(--accent)' : 'var(--border)',
                cursor: canSend ? 'pointer' : 'default',
              }}
              title="发送 (Enter)"
            >
              <ArrowUp size={16} color="white" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
