import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
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
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText('');
    setShowSlash(false);
  }, [text, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (showSlash) return; // slash menu handles Enter
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

  return (
    <div className="border-t border-[var(--border)] bg-[var(--paper)] p-3">
      <div className="relative">
        {showSlash && (
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={handleSlashClose}
          />
        )}
        <div className="flex items-end gap-2 rounded-lg border border-[var(--border)] bg-[var(--paper-light)] px-3 py-2 focus-within:border-[var(--accent-warm)]">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="发送消息... (Enter 发送，Shift+Enter 换行)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-[var(--ink)] placeholder-[var(--ink-tertiary)] outline-none"
            style={{ maxHeight: 120 }}
          />
          {isLoading ? (
            <button
              onClick={onStop}
              className="shrink-0 rounded p-1 text-[var(--error)] hover:bg-[var(--paper-dark)]"
              title="停止"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="shrink-0 rounded p-1 text-[var(--accent-warm)] hover:bg-[var(--paper-dark)] disabled:opacity-30"
              title="发送 (Enter)"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
