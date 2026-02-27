import { useEffect, useState } from 'react';
import type { Message } from '../types/chat';
import MessageItem from './Message';
import { useAutoScroll } from '../hooks/useAutoScroll';

interface Props {
  messages: Message[];
  isLoading?: boolean;
  onOpenUrl?: (url: string) => void;
}

export default function MessageList({ messages, isLoading, onOpenUrl }: Props) {
  const { scrollRef, checkAtBottom } = useAutoScroll(messages.length, isLoading);

  return (
    <div
      ref={scrollRef}
      onScroll={checkAtBottom}
      className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4"
    >
      {messages.length === 0 && !isLoading && (
        <div className="flex h-full items-center justify-center text-[var(--ink-tertiary)]">
          发送消息开始对话
        </div>
      )}
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} onOpenUrl={onOpenUrl} />
      ))}
      {isLoading && <ThinkingIndicator />}
    </div>
  );
}

const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function ThinkingIndicator() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % BRAILLE_FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 px-1 py-1 text-sm text-[var(--ink-tertiary)]">
        <span className="font-mono text-[var(--accent)] text-base leading-none">
          {BRAILLE_FRAMES[frame]}
        </span>
        <span>思考中…</span>
      </div>
    </div>
  );
}
