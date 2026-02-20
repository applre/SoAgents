import type { Message } from '../types/chat';
import MessageItem from './Message';
import { useAutoScroll } from '../hooks/useAutoScroll';

interface Props {
  messages: Message[];
}

export default function MessageList({ messages }: Props) {
  const { scrollRef, checkAtBottom } = useAutoScroll(messages);

  return (
    <div
      ref={scrollRef}
      onScroll={checkAtBottom}
      className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4"
    >
      {messages.length === 0 && (
        <div className="flex h-full items-center justify-center text-[var(--ink-tertiary)]">
          发送消息开始对话
        </div>
      )}
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
}
