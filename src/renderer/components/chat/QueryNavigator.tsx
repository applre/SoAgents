// Query Navigator — floating right-side panel for quick session query navigation.
//
// Ported from MyAgents. Two SoAgents-specific deltas:
//   1. `Message.blocks` (not `msg.content`) — extractor walks blocks for text type.
//   2. CSS token names adapted to SoAgents design tokens.
//
// Unified row design: dashes are always visible in the same position.
// On hover, text labels slide in from the right — dashes stay anchored.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Message } from '../../types/chat';

/** Minimum user queries to show the navigator */
const MIN_QUERIES = 3;

interface QueryNavigatorProps {
  historyMessages: Message[];
  streamingMessage: Message | null;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  pauseAutoScroll: (duration?: number) => void;
  /** Virtuoso-aware navigation: scrolls to message by ID even if virtualized (not in DOM) */
  onNavigateToQuery?: (messageId: string) => void;
}

/** Extract plain text preview from a message's blocks (SoAgents-specific). */
function getQueryText(msg: Message): string {
  if (!Array.isArray(msg.blocks)) return '';
  for (const block of msg.blocks) {
    if (block.type === 'text') return block.text;
  }
  return '';
}

/** Check if a user message is a system injection (not real user query) */
function isSystemInjection(text: string): boolean {
  return (
    text.includes('<HEARTBEAT>') ||
    text.includes('<MEMORY_UPDATE>') ||
    text.startsWith('<system-reminder>')
  );
}

export default function QueryNavigator({
  historyMessages,
  streamingMessage,
  scrollContainerRef,
  pauseAutoScroll,
  onNavigateToQuery,
}: QueryNavigatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeIndexRaw, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Extract real user queries (filter out system injections)
  const queries = useMemo(() => {
    const allMessages = streamingMessage
      ? [...historyMessages, streamingMessage]
      : historyMessages;

    return allMessages
      .filter((msg) => {
        if (msg.role !== 'user') return false;
        const text = getQueryText(msg);
        return text.trim() !== '' && !isSystemInjection(text);
      })
      .map((msg) => ({
        id: msg.id,
        text: getQueryText(msg),
      }));
  }, [historyMessages, streamingMessage]);

  // Clamp activeIndex to valid range (handles session switch, query list shrink)
  const activeIndex = activeIndexRaw >= 0 && activeIndexRaw < queries.length ? activeIndexRaw : -1;

  // Track active query via IntersectionObserver.
  // With virtualization, elements mount/unmount as the user scrolls. A
  // MutationObserver watches for child changes in the container and re-observes
  // any new user message elements.
  const visibleIndicesRef = useRef(new Set<number>());

  useEffect(() => {
    visibleIndicesRef.current.clear();

    if (queries.length < MIN_QUERIES) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const idToQueryIndex = new Map<string, number>();
    queries.forEach((q, i) => idToQueryIndex.set(q.id, i));

    const observedElements = new WeakSet<Element>();
    const visibleSet = visibleIndicesRef.current;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const messageId = el.getAttribute('data-message-id');
          if (!messageId) continue;
          const qIndex = idToQueryIndex.get(messageId);
          if (qIndex === undefined) continue;

          if (entry.isIntersecting) {
            visibleSet.add(qIndex);
          } else {
            visibleSet.delete(qIndex);
          }
        }

        if (visibleSet.size > 0) {
          setActiveIndex(Math.min(...visibleSet));
        }
      },
      {
        root: container,
        rootMargin: '0px 0px -60% 0px',
        threshold: 0,
      },
    );

    // Observe all currently-visible user elements
    const observeUserElements = () => {
      const userElements = container.querySelectorAll<HTMLElement>('[data-role="user"]');
      userElements.forEach((el) => {
        if (!observedElements.has(el)) {
          observedElements.add(el);
          intersectionObserver.observe(el);
        }
      });
    };

    observeUserElements();

    // Re-observe when virtuoso mounts/unmounts elements (DOM subtree changes).
    // Debounce: streaming causes 100+ mutations/sec. Batch into a single
    // querySelectorAll scan per 100ms window.
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const mutationObserver = new MutationObserver(() => {
      if (debounceTimer) return; // Already scheduled
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        observeUserElements();
      }, 100);
    });
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [queries, scrollContainerRef]);

  // Auto-scroll the panel to keep active item visible
  useEffect(() => {
    if (isExpanded && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [isExpanded, activeIndex]);

  // Navigate to a query — prefer virtuoso-aware navigation (handles virtualized messages)
  const handleQueryClick = useCallback(
    (queryId: string) => {
      // Virtuoso path: scroll by index even if the message is not in the DOM
      if (onNavigateToQuery) {
        onNavigateToQuery(queryId);
        return;
      }

      // Fallback: direct DOM scroll (for non-virtualized contexts)
      const container = scrollContainerRef.current;
      if (!container) return;

      const target = container.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(queryId)}"]`,
      );
      if (!target) return;

      pauseAutoScroll(2000);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [scrollContainerRef, pauseAutoScroll, onNavigateToQuery],
  );

  if (queries.length < MIN_QUERIES) return null;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-30 hidden md:flex items-center pointer-events-none"
    >
      {/* Single unified container — dashes always anchored right, text slides in */}
      <div
        aria-hidden={!isExpanded}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={`pointer-events-auto relative max-h-[60vh] overflow-hidden transition-[width,background-color,border-color,box-shadow] duration-200 ${
          isExpanded
            ? 'w-72 rounded-xl border border-[var(--border)] shadow-lg'
            : 'w-5 border border-transparent'
        }`}
        style={isExpanded ? {
          background: 'var(--paper)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        } : undefined}
      >
        {/* Top fade mask */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-5 transition-opacity duration-200 ${
            isExpanded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ background: 'linear-gradient(to bottom, var(--paper), transparent)' }}
        />

        {/* Scrollable list — each row: [text (conditional)] + [dash (always)] */}
        <div
          ref={listRef}
          className="overflow-y-auto max-h-[60vh] py-3"
        >
          {queries.map((q, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={q.id}
                ref={isActive ? activeItemRef : undefined}
                type="button"
                tabIndex={isExpanded ? 0 : -1}
                onClick={() => isExpanded && handleQueryClick(q.id)}
                className={`flex w-full items-center gap-1.5 py-[5px] text-left transition-colors ${
                  isExpanded
                    ? `px-3 cursor-pointer rounded-lg ${isActive ? 'bg-[var(--hover)]' : 'hover:bg-[var(--hover)]'}`
                    : 'px-0 cursor-default justify-end'
                }`}
              >
                {/* Query text — only visible when expanded */}
                <span
                  className={`flex-1 truncate text-[13px] leading-6 transition-opacity duration-200 ${
                    isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                  } ${isActive ? 'text-[var(--accent)] font-medium' : 'text-[var(--ink-tertiary)]'}`}
                >
                  {q.text}
                </span>

                {/* Dash — always visible, same position */}
                <span
                  className={`flex-shrink-0 rounded-full transition-all duration-150 ${
                    isActive
                      ? 'w-[10px] h-[3px] bg-[var(--accent)]'
                      : isExpanded
                        ? 'w-[8px] h-[2px] bg-[var(--ink-tertiary)]'
                        : 'w-[8px] h-[2px] bg-[var(--ink-tertiary)] opacity-40'
                  } ${isExpanded ? 'mr-1' : 'mr-1.5'}`}
                />
              </button>
            );
          })}
        </div>

        {/* Bottom fade mask */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 transition-opacity duration-200 ${
            isExpanded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ background: 'linear-gradient(to top, var(--paper), transparent)' }}
        />
      </div>
    </div>
  );
}
