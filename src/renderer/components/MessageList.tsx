import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { Message } from '../types/chat';
import MessageItem from './Message';
import { useVirtuosoScroll } from '../hooks/useVirtuosoScroll';

interface Props {
  messages: Message[];
  isLoading?: boolean;
  streamingMessage?: Message | null;
  onOpenUrl?: (url: string) => void;
}

// ── Virtuoso Footer — memo'd component that receives props directly (no stale refs) ──
const VirtuosoFooter = memo(function VirtuosoFooter({ showStatus }: { showStatus: boolean }) {
  return (
    <>
      {showStatus && (
        <div className="mx-auto w-full px-6 py-2" style={{ maxWidth: 860 }}>
          <ThinkingIndicator />
        </div>
      )}
      {/* 底部呼吸间距 */}
      <div className="h-10" />
    </>
  );
});

export default function MessageList({ messages, isLoading, streamingMessage, onOpenUrl }: Props) {
  const {
    virtuosoRef,
    followEnabledRef,
    handleAtBottomChange,
    handleFollowOutput,
  } = useVirtuosoScroll();

  // 流式期间用 rAF 驱动自动滚动，每个 chunk 最多触发一次
  const scrollRafRef = useRef(0);
  useEffect(() => {
    if (streamingMessage && followEnabledRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        virtuosoRef.current?.autoscrollToBottom();
      });
    }
    return () => cancelAnimationFrame(scrollRafRef.current);
  }, [streamingMessage, followEnabledRef, virtuosoRef]);

  // Refs for stable Virtuoso itemContent callback — updated via useEffect
  // (Footer no longer uses these refs; it receives showStatus as a prop)
  const isLoadingRef = useRef(isLoading);
  const onOpenUrlRef = useRef(onOpenUrl);
  const streamingMessageRef = useRef(streamingMessage);
  useEffect(() => {
    isLoadingRef.current = isLoading;
    onOpenUrlRef.current = onOpenUrl;
    streamingMessageRef.current = streamingMessage;
  });

  const renderItem = useMemo(() => {
    function VirtuosoItemContent(_index: number, message: Message) {
      const sm = streamingMessageRef.current;
      const isStreamingMsg = !!sm && message === sm;
      return (
        <div className="mx-auto w-full px-6 py-2" style={{ maxWidth: 860 }}>
          <MessageItem
            message={message}
            isStreaming={isStreamingMsg && isLoadingRef.current}
            onOpenUrl={onOpenUrlRef.current}
          />
        </div>
      );
    }
    return VirtuosoItemContent;
  }, []);

  const computeItemKey = useMemo(() => (_index: number, message: Message) => message.id, []);

  // showStatus computed from props directly — always up-to-date
  const showStatus = !!isLoading && !streamingMessage;

  // Stable Footer wrapper — useMemo keeps component identity stable for Virtuoso
  const FooterComponent = useMemo(() => {
    return function Footer() {
      return <VirtuosoFooter showStatus={showStatus} />;
    };
  // showStatus is a primitive boolean — safe in deps, won't cause unnecessary recreations
  }, [showStatus]);

  const components = useMemo(() => ({ Footer: FooterComponent }), [FooterComponent]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--ink-tertiary)]">
        发送消息开始对话
      </div>
    );
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={messages}
      computeItemKey={computeItemKey}
      followOutput={handleFollowOutput}
      atBottomStateChange={handleAtBottomChange}
      atBottomThreshold={50}
      defaultItemHeight={200}
      className="flex-1"
      style={{ overscrollBehavior: 'none' }}
      components={components}
      itemContent={renderItem}
    />
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
