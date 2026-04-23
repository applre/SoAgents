/**
 * ChatSearchPanel — floating top-right in-page text finder for Chat.
 *
 * Fixed-width single-row panel. Scope is only already rendered messages;
 * virtualized items are not searchable (see useChatSearch).
 *
 * Interaction:
 *   • Enter = next match, Shift+Enter = previous
 *   • Esc closes
 *   • Cmd/Ctrl+F inside the input re-selects the text
 */

import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';

import type { ChatSearchController } from '@/hooks/useChatSearch';

const PANEL_WIDTH = 340;

interface ChatSearchPanelProps {
  controller: ChatSearchController;
  onClose: () => void;
}

export default function ChatSearchPanel({ controller, onClose }: ChatSearchPanelProps) {
  const { query, setQuery, matchCount, currentIndex, next, prev, hasQuery } = controller;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) prev();
      else next();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      inputRef.current?.select();
    }
  };

  const counterLabel = (() => {
    if (!hasQuery) return '';
    if (matchCount === 0) return '0 / 0';
    return `${currentIndex + 1} / ${matchCount}`;
  })();

  return (
    <div
      className="absolute right-4 top-3 z-[100] flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-2 py-1.5 shadow-md"
      style={{ width: PANEL_WIDTH }}
      role="search"
      onMouseDown={e => e.stopPropagation()}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ink-tertiary)]" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="在当前页面中查找"
        aria-label="在当前页面中查找"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)]"
      />
      <span className="shrink-0 text-[11px] tabular-nums text-[var(--ink-tertiary)]">
        {counterLabel}
      </span>
      <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
      <button
        type="button"
        onClick={prev}
        disabled={matchCount === 0}
        title="上一个 (Shift+Enter)"
        aria-label="上一个匹配"
        className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={next}
        disabled={matchCount === 0}
        title="下一个 (Enter)"
        aria-label="下一个匹配"
        className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onClose}
        title="关闭 (Esc)"
        aria-label="关闭搜索"
        className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
