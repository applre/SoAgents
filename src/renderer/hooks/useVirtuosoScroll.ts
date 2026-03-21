import { useRef, useEffect, useCallback } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';

/**
 * Virtuoso 三态 follow 模型:
 *  - 'force': 始终跟随 (scrollToBottom 后，直到确认到底)
 *  - true:    在底部时跟随 (正常流式)
 *  - false:   禁用 (用户上滚)
 *
 * 状态转换:
 *  scrollToBottom() → 'force'
 *  atBottomStateChange(true) + force → true
 *  atBottomStateChange(false) + true → false
 */
export function useVirtuosoScroll() {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const followEnabledRef = useRef<boolean | 'force'>(true);

  const scrollToBottom = useCallback(() => {
    followEnabledRef.current = 'force';
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
  }, []);

  const handleAtBottomChange = useCallback((atBottom: boolean) => {
    if (atBottom && followEnabledRef.current === 'force') {
      // force 模式到底后降级为普通跟随
      followEnabledRef.current = true;
    }
    if (!atBottom && followEnabledRef.current === true) {
      // 用户滚离底部 → 停止跟随
      followEnabledRef.current = false;
    }
  }, []);

  const handleFollowOutput = useCallback((isAtBottom: boolean) => {
    const mode = followEnabledRef.current;
    if (!mode) return false;
    if (mode === 'force') return 'smooth' as const;
    return isAtBottom ? 'smooth' as const : false;
  }, []);

  // cleanup
  useEffect(() => {
    return () => {
      followEnabledRef.current = true;
    };
  }, []);

  return {
    virtuosoRef,
    followEnabledRef,
    scrollToBottom,
    handleAtBottomChange,
    handleFollowOutput,
  };
}
