import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ContentBlock } from '../types/chat';
import ProcessRow from './ProcessRow';

type ProcessBlock =
  | Extract<ContentBlock, { type: 'thinking' }>
  | Extract<ContentBlock, { type: 'tool_use' }>;

interface Props {
  blocks: ProcessBlock[];
  isStreaming?: boolean;
}

/** 折叠阈值：≥6 个块时折叠中间部分 */
const FOLD_THRESHOLD = 6;
const VISIBLE_HEAD = 2;
const VISIBLE_TAIL = 2;

/**
 * BlockGroup: 将连续的 thinking/tool_use 块分组渲染
 * - ≤ 5 块：全部平铺
 * - ≥ 6 块：显示前 2 + 后 2，中间折叠
 */
const BlockGroup = memo(function BlockGroup({ blocks, isStreaming }: Props) {
  const [isUnfolded, setIsUnfolded] = useState(false);

  if (blocks.length === 0) return null;

  const shouldFold = !isUnfolded && blocks.length >= FOLD_THRESHOLD;
  const foldedCount = shouldFold ? blocks.length - VISIBLE_HEAD - VISIBLE_TAIL : 0;

  // ≥5 块时使用可折叠 DOM 结构（提前 1 步，让折叠触发时 DOM 不变，CSS 过渡流畅）
  if (blocks.length > VISIBLE_HEAD + VISIBLE_TAIL) {
    return (
      <div>
        {/* Head: 前 2 块 — 始终可见 */}
        {blocks.slice(0, VISIBLE_HEAD).map((block, i) => (
          <ProcessRow key={i} block={block} isStreaming={isStreaming} />
        ))}

        {/* Middle: 可折叠区 — CSS Grid 动画 */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: shouldFold ? '0fr' : '1fr' }}
        >
          <div className="overflow-hidden">
            {blocks.slice(VISIBLE_HEAD, blocks.length - VISIBLE_TAIL).map((block, i) => (
              <ProcessRow key={VISIBLE_HEAD + i} block={block} isStreaming={isStreaming} />
            ))}
          </div>
        </div>

        {/* Fold bar: 折叠时显示 */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: shouldFold ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-[11px] text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink-secondary)] transition-colors"
              onClick={() => setIsUnfolded(true)}
            >
              <ChevronDown className="size-3" />
              展开全部
              <span className="rounded-full bg-[var(--surface)] px-1.5 text-[10px]">+{foldedCount}</span>
            </button>
          </div>
        </div>

        {/* Tail: 最后 2 块 — 始终可见 */}
        {blocks.slice(blocks.length - VISIBLE_TAIL).map((block, i) => (
          <ProcessRow key={blocks.length - VISIBLE_TAIL + i} block={block} isStreaming={isStreaming} />
        ))}
      </div>
    );
  }

  // ≤ 4 块：平铺布局
  return (
    <div>
      {blocks.map((block, i) => (
        <ProcessRow key={i} block={block} isStreaming={isStreaming} />
      ))}
    </div>
  );
});

export default BlockGroup;
