import { Loader2 } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { Message } from '../types/chat';
import MessageItem from './Message';
import { useVirtuosoScroll, type VirtuosoScrollControls } from '../hooks/useVirtuosoScroll';

interface Props {
  messages: Message[];
  isLoading?: boolean;
  streamingMessage?: Message | null;
  sessionId?: string | null;
  isStreaming?: boolean;
  /** Optional: parent-owned scroll controls. When absent, MessageList falls
   *  back to its own internal useVirtuosoScroll() so legacy callers keep
   *  working. Chat.tsx passes controls in so it can share the scrollerRef
   *  with useChatSearch + QueryNavigator. */
  scrollControls?: VirtuosoScrollControls;
  /** Message actions forwarded to each MessageItem. */
  onRewind?: (messageId: string) => void;
  onRetry?: (assistantMessageId: string) => void;
  onFork?: (assistantMessageId: string) => void;
}

const STREAMING_MESSAGES = [
  '苦思冥想中…', '深思熟虑中…', '灵光一闪中…', '绞尽脑汁中…', '思绪飞速运转中…',
  '小脑袋瓜转啊转…', '神经元疯狂放电中…', '灵感小火花碰撞中…', '正在努力组织语言…',
  '在知识海洋里捞答案…', '正在翻阅宇宙图书馆…', '答案正在酝酿中…', '灵感咖啡冲泡中…',
  '递归思考中，请勿打扰…', '正在遍历可能性…', '加载智慧模块中…',
  '容我想想…', '稍等，马上就好…', '别急，好饭不怕晚…', '正在认真对待你的问题…',
];

function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}小时${minutes}分钟${seconds}秒`;
  if (minutes > 0) return `${minutes}分钟${seconds}秒`;
  return `${seconds}秒`;
}

function getRandomStreamingMessage(): string {
  return STREAMING_MESSAGES[Math.floor(Math.random() * STREAMING_MESSAGES.length)];
}

// ── Virtuoso Footer — memo'd component that receives props directly (no stale refs) ──
const VirtuosoFooter = memo(function VirtuosoFooter({ showStatus, statusMessage }: { showStatus: boolean; statusMessage: string }) {
  return (
    <div className="mx-auto max-w-3xl px-3">
      {showStatus && <StatusTimer message={statusMessage} />}
      <div style={{ height: 80 }} aria-hidden="true" />
    </div>
  );
});

export default function MessageList({ messages, isLoading, streamingMessage, sessionId, isStreaming, scrollControls, onRewind, onRetry, onFork }: Props) {
  const fallback = useVirtuosoScroll();
  const {
    virtuosoRef,
    scrollerRef,
    followEnabledRef,
    handleAtBottomChange,
    handleFollowOutput,
  } = scrollControls ?? fallback;

  // Scroll to bottom + fade-in after session switch
  const [fadeIn, setFadeIn] = useState(false);
  const sessionScrollCountRef = useRef(0);
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    // Increment counter to detect session changes (effect runs on sessionId change)
    const scrollId = ++sessionScrollCountRef.current;
    followEnabledRef.current = 'force';
    setFadeIn(true);
    const timer = setTimeout(() => {
      if (scrollId !== sessionScrollCountRef.current) return; // stale
      const ref = virtuosoRef.current;
      if (!ref) return;
      ref.scrollToIndex({ index: 'LAST', align: 'end' });
      requestAnimationFrame(() => {
        ref.scrollToIndex({ index: 'LAST', align: 'end' });
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
  const streamingMessageRef = useRef(streamingMessage);
  const actionsRef = useRef({ onRewind, onRetry, onFork });
  useEffect(() => {
    isLoadingRef.current = isLoading;
    streamingMessageRef.current = streamingMessage;
    actionsRef.current = { onRewind, onRetry, onFork };
  });

  const renderItem = useMemo(() => {
    function VirtuosoItemContent(_index: number, message: Message) {
      const sm = streamingMessageRef.current;
      const isStreamingMsg = !!sm && message === sm;
      const { onRewind: r, onRetry: rt, onFork: f } = actionsRef.current;
      return (
        <div className="mx-auto max-w-3xl px-3 py-1 overflow-hidden">
          <MessageItem
            message={message}
            isStreaming={isStreamingMsg && isLoadingRef.current}
            onRewind={r}
            onRetry={rt}
            onFork={f}
          />
        </div>
      );
    }
    return VirtuosoItemContent;
  }, []);

  const computeItemKey = useMemo(() => (_index: number, message: Message) => message.id, []);

  // showStatus computed from props directly — always up-to-date
  const showStatus = !!isLoading && !streamingMessage;

  // Random message per streaming turn — changes when message count changes
  const streamingStatusMessage = useMemo(
    () => getRandomStreamingMessage(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages.length]
  );

  // Stable Footer wrapper — useMemo keeps component identity stable for Virtuoso
  const FooterComponent = useMemo(() => {
    return function Footer() {
      return <VirtuosoFooter showStatus={showStatus} statusMessage={streamingStatusMessage} />;
    };
  }, [showStatus, streamingStatusMessage]);

  const components = useMemo(() => ({ Footer: FooterComponent }), [FooterComponent]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--ink-tertiary)]">
        发送消息开始对话
      </div>
    );
  }

  return (
    <div
      className="relative flex-1"
      data-streaming={isStreaming || undefined}
      style={fadeIn ? { animation: 'message-list-fade-in 600ms ease-out both' } : undefined}
      onAnimationEnd={() => setFadeIn(false)}
    >
      <Virtuoso
        key={sessionId || 'pending'}
        ref={virtuosoRef}
        scrollerRef={(el) => {
          // Virtuoso hands us the real scrollable element. Store it on the
          // shared ref so useChatSearch + QueryNavigator can reach the DOM
          // scroller from Chat.tsx.
          scrollerRef.current = el as HTMLElement | null;
        }}
        data={messages}
        computeItemKey={computeItemKey}
        followOutput={handleFollowOutput}
        atBottomStateChange={handleAtBottomChange}
        atBottomThreshold={50}
        defaultItemHeight={200}
        className="h-full"
        style={{ overscrollBehavior: 'none' }}
        components={components}
        itemContent={renderItem}
      />
    </div>
  );
}

const StatusTimer = memo(function StatusTimer({ message }: { message: string }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(0);
  useEffect(() => {
    startTimeRef.current = Date.now();
    const id = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--ink-tertiary)]">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>{message}{elapsedSeconds > 0 && ` (${formatElapsedTime(elapsedSeconds)})`}</span>
    </div>
  );
});
