import { useRef, useEffect, useCallback } from 'react';

export function useAutoScroll(triggerCount: number, isLoading?: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const rafRef = useRef<number>(0);

  const checkAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // 消息条数或 loading 状态变化时滚动
  useEffect(() => {
    scrollToBottom();
  }, [triggerCount, isLoading, scrollToBottom]);

  // 流式内容更新时：用 MutationObserver 监听 DOM 变化，自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isLoading) return;

    const observer = new MutationObserver(() => {
      if (!isAtBottomRef.current) return;
      // 用 rAF 合并高频更新，避免每个 chunk 都触发一次滚动
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (el && isAtBottomRef.current) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [isLoading]);

  return { scrollRef, checkAtBottom };
}
