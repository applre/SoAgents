import { memo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { ContentBlock } from '../types/chat';
import ProcessRow from './ProcessRow';

type ProcessBlock =
  | Extract<ContentBlock, { type: 'thinking' }>
  | Extract<ContentBlock, { type: 'tool_use' }>;

interface Props {
  blocks: ProcessBlock[];
  isLatestActiveSection?: boolean;
  isStreaming?: boolean;
}

/** 2 head + N folded + 2 tail — fold kicks in at 6+ blocks */
const FOLD_THRESHOLD = 6;
const VISIBLE_HEAD = 2;
const VISIBLE_TAIL = 2;

const BlockGroup = memo(function BlockGroup({ blocks, isLatestActiveSection = false, isStreaming = false }: Props) {
  const [isUnfolded, setIsUnfolded] = useState(false);

  if (blocks.length === 0) return null;

  const isStreamingActive = isStreaming && isLatestActiveSection;
  const shouldFold = !isUnfolded && blocks.length >= FOLD_THRESHOLD;
  const foldedCount = shouldFold ? blocks.length - VISIBLE_HEAD - VISIBLE_TAIL : 0;

  // Collapsible layout: activates 1 step before FOLD_THRESHOLD so the DOM structure
  // is already stable when folding triggers, enabling smooth CSS Grid transition.
  if (blocks.length > VISIBLE_HEAD + VISIBLE_TAIL) {
    return (
      <div className="my-3 overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-[var(--surface)]/30 transition-all select-none">
        <div className="flex flex-col">
          {/* Head: first 2 blocks — always visible */}
          {blocks.slice(0, VISIBLE_HEAD).map((block, i) => (
            <ProcessRow key={i} block={block} index={i} totalBlocks={blocks.length} isStreaming={isStreamingActive} />
          ))}

          {/* Middle: collapsible zone — CSS Grid animation */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: shouldFold ? '0fr' : '1fr' }}
          >
            <div className="overflow-hidden">
              {blocks.slice(VISIBLE_HEAD, blocks.length - VISIBLE_TAIL).map((block, i) => {
                const idx = VISIBLE_HEAD + i;
                return (
                  <ProcessRow key={idx} block={block} index={idx} totalBlocks={blocks.length} isStreaming={isStreamingActive} />
                );
              })}
            </div>
          </div>

          {/* Fold bar: inversely animated — appears as middle collapses */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: shouldFold ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => setIsUnfolded(true)}
                className="group/fold flex w-full items-center gap-3 border-b border-[var(--border)]/30 px-4 py-2 text-left transition-colors cursor-pointer hover:bg-[var(--hover)]"
              >
                <div className="size-1.5 shrink-0" />
                <div className="flex size-4 shrink-0 items-center justify-center text-[var(--ink-tertiary)]">
                  <MoreHorizontal className="size-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--ink-tertiary)] group-hover/fold:text-[var(--ink-secondary)] transition-colors">
                    展开全部
                  </span>
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--accent)]">
                    +{foldedCount}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Tail: last 2 blocks — always visible */}
          {blocks.slice(blocks.length - VISIBLE_TAIL).map((block, i) => {
            const idx = blocks.length - VISIBLE_TAIL + i;
            return (
              <ProcessRow key={idx} block={block} index={idx} totalBlocks={blocks.length} isStreaming={isStreamingActive} />
            );
          })}
        </div>
      </div>
    );
  }

  // Flat layout for small block groups (≤4 blocks)
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-[var(--surface)]/30 transition-all select-none">
      <div className="flex flex-col">
        {blocks.map((block, i) => (
          <ProcessRow key={i} block={block} index={i} totalBlocks={blocks.length} isStreaming={isStreamingActive} />
        ))}
      </div>
    </div>
  );
});

export default BlockGroup;
