import { useRef, useEffect, useCallback } from 'react';

export function useAutoScroll(triggerCount: number, isLoading?: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

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

  useEffect(() => {
    scrollToBottom();
  }, [triggerCount, isLoading, scrollToBottom]);

  return { scrollRef, checkAtBottom };
}
