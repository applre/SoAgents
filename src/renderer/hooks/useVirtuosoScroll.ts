/**
 * useVirtuosoScroll — thin wrapper around react-virtuoso's scroll API.
 *
 * Three-state follow model:
 *  - `'force'`: always follow (after scrollToBottom, until confirmed at bottom)
 *  - `true`:    follow when at bottom (normal streaming)
 *  - `false`:   disabled (user scrolled up, or paused)
 *
 * Transitions:
 *   scrollToBottom() → 'force'
 *   atBottomStateChange(true)  + force → true  (confirmed at bottom)
 *   atBottomStateChange(false) + true  → false (user scrolled up)
 *   pauseAutoScroll() → false (temporary; restored to prior value after `duration`)
 *
 * Exports:
 *   - `handleFollowOutput`: glue for Virtuoso's `followOutput` prop.
 *   - `scrollerRef`: the real DOM scroller element (set via Virtuoso's
 *     `scrollerRef` callback). Consumed by ChatSearch / QueryNavigator for
 *     DOM-level scroll + range operations.
 *   - `pauseAutoScroll(duration)`: momentarily disable auto-follow so
 *     programmatic scrolls (e.g. QueryNavigator → scrollIntoView) aren't
 *     undone by streaming chunks.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';

export interface VirtuosoScrollControls {
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  scrollerRef: React.MutableRefObject<HTMLElement | null>;
  followEnabledRef: React.MutableRefObject<boolean | 'force'>;
  scrollToBottom: () => void;
  pauseAutoScroll: (duration?: number) => void;
  handleAtBottomChange: (atBottom: boolean) => void;
  handleFollowOutput: (isAtBottom: boolean) => 'smooth' | false;
}

export function useVirtuosoScroll(): VirtuosoScrollControls {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const followEnabledRef = useRef<boolean | 'force'>(true);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track what followEnabled was before pause so we restore correctly.
  const prePauseFollowRef = useRef<boolean | 'force'>(true);

  const scrollToBottom = useCallback(() => {
    followEnabledRef.current = 'force';
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
  }, []);

  const pauseAutoScroll = useCallback((duration = 500) => {
    prePauseFollowRef.current = followEnabledRef.current;
    followEnabledRef.current = false;
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      followEnabledRef.current = prePauseFollowRef.current;
      pauseTimerRef.current = null;
    }, duration);
  }, []);

  const handleAtBottomChange = useCallback((atBottom: boolean) => {
    if (atBottom && followEnabledRef.current === 'force') {
      followEnabledRef.current = true;
    }
    if (!atBottom && followEnabledRef.current === true) {
      followEnabledRef.current = false;
    }
  }, []);

  const handleFollowOutput = useCallback((isAtBottom: boolean): 'smooth' | false => {
    const mode = followEnabledRef.current;
    if (!mode) return false;
    if (mode === 'force') return 'smooth';
    return isAtBottom ? 'smooth' : false;
  }, []);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      followEnabledRef.current = true;
    };
  }, []);

  return {
    virtuosoRef,
    scrollerRef,
    followEnabledRef,
    scrollToBottom,
    pauseAutoScroll,
    handleAtBottomChange,
    handleFollowOutput,
  };
}
