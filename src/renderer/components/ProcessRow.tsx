import { Brain, ChevronDown, Loader2, XCircle } from 'lucide-react';
import { memo, useEffect, useRef, useState, useCallback } from 'react';
import type { ContentBlock } from '../types/chat';
import { getToolBadgeConfig } from './tools/toolBadgeConfig';
import ToolUse from './tools/ToolUse';
import Markdown from './Markdown';

type ProcessBlock =
  | Extract<ContentBlock, { type: 'thinking' }>
  | Extract<ContentBlock, { type: 'tool_use' }>;

interface Props {
  block: ProcessBlock;
  index: number;
  totalBlocks: number;
  isStreaming?: boolean;
}

/** Get tool sub-label for display */
function getToolLabel(block: Extract<ContentBlock, { type: 'tool_use' }>): string {
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(block.input ?? '{}'); } catch { /* */ }
  switch (block.name) {
    case 'Bash': return String(parsed.command ?? '').slice(0, 60);
    case 'Read': case 'Write': case 'Edit': return String(parsed.file_path ?? '');
    case 'Glob': return String(parsed.pattern ?? '');
    case 'Grep': return String(parsed.pattern ?? '');
    case 'WebSearch': return String(parsed.query ?? '');
    case 'WebFetch': return String(parsed.url ?? '').slice(0, 60);
    case 'Skill': return String(parsed.skill ?? '');
    case 'Agent': case 'Task': return String(parsed.description ?? '');
    default: return '';
  }
}

const ProcessRow = memo(function ProcessRow({ block, index, totalBlocks, isStreaming = false }: Props) {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTimeRef = useRef(0);

  const isThinking = block.type === 'thinking';
  const isToolUse = block.type === 'tool_use';
  const isLastBlock = index === totalBlocks - 1;

  // Thinking is active if streaming and it's the last block (no isComplete field in SoAgents)
  const isThinkingActive = isThinking && isStreaming && isLastBlock;
  // Tool is active via status field
  const isToolActive = isToolUse && block.status === 'running';
  const isBlockActive = isThinkingActive || isToolActive;

  // Thinking timer
  useEffect(() => {
    if (!isThinkingActive) {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
        thinkingTimerRef.current = undefined;
      }
      return;
    }
    startTimeRef.current = Date.now();
    thinkingTimerRef.current = setInterval(() => {
      setThinkingElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
        thinkingTimerRef.current = undefined;
      }
    };
  }, [isThinkingActive]);

  // Check if block has expandable content
  const hasContent =
    (isThinking && block.thinking && block.thinking.length > 0) ||
    (isToolUse && (block.input || block.result));

  // Expand state: user toggle > auto (thinking active = expanded)
  const isExpanded = userToggled !== null
    ? userToggled
    : (isThinking && isThinkingActive);

  const handleToggle = useCallback(() => {
    if (!hasContent) return;
    setUserToggled(prev => prev === null ? true : !prev);
  }, [hasContent]);

  // Build display content
  let icon: React.ReactNode = null;
  let mainLabel = '';
  let subLabel = '';

  if (isThinking) {
    if (isThinkingActive) {
      const elapsedSec = thinkingElapsed;
      mainLabel = elapsedSec > 0 ? `思考中… (${elapsedSec}s)` : '思考中…';
      icon = <Loader2 className="size-4 animate-spin" />;
    } else {
      // Completed thinking — show character count as duration proxy
      const charCount = block.thinking?.length ?? 0;
      mainLabel = charCount > 0 ? `思考了 ${Math.ceil(charCount / 100)}s` : '思考过程';
      icon = <Brain className="size-4" />;
    }
  } else if (isToolUse) {
    const config = getToolBadgeConfig(block.name);
    mainLabel = block.name;
    subLabel = getToolLabel(block);

    if (isToolActive) {
      icon = <Loader2 className="size-4 animate-spin" />;
    } else if (block.status === 'error') {
      icon = <XCircle className="size-4 text-[var(--error)]" />;
    } else {
      icon = config.icon;
    }
  }

  // Dot color
  let dotClass = 'bg-[var(--ink-tertiary)]/40';
  if (isBlockActive) dotClass = 'bg-amber-400 animate-pulse';
  else if (isToolUse && block.status === 'error') dotClass = 'bg-[var(--error)]';

  return (
    <div className={`group select-none ${index < totalBlocks - 1 ? 'border-b border-[var(--line-subtle)]' : ''}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={!hasContent}
        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${hasContent ? 'cursor-pointer hover:bg-[var(--hover)]' : 'cursor-default'}`}
      >
        {/* Left indicator dot */}
        <div className={`flex size-1.5 shrink-0 rounded-full ${dotClass}`} />

        {/* Icon */}
        <div className="flex size-4 shrink-0 items-center justify-center text-[var(--ink-tertiary)] [&>svg]:size-4">
          {icon}
        </div>

        {/* Labels */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={`text-sm leading-snug ${isThinking ? 'text-[var(--ink-secondary)]' : 'text-[var(--ink)] font-medium'}`}>
            {mainLabel}
          </span>
          {subLabel && (
            <span className="text-xs text-[var(--ink-tertiary)] font-mono truncate">
              {subLabel}
            </span>
          )}
        </div>

        {/* Chevron */}
        {hasContent && (
          <ChevronDown className={`size-4 text-[var(--ink-tertiary)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Expanded body — CSS Grid animation */}
      {hasContent && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="border-t border-[var(--border)] bg-[var(--paper)]/50 px-4 pb-4 pt-3">
              <div className="ml-7">
                {isThinking && block.thinking && (
                  <div className="text-[var(--ink-secondary)] select-text">
                    <Markdown compact>{block.thinking}</Markdown>
                  </div>
                )}
                {isToolUse && (
                  <div className="w-full overflow-hidden select-text">
                    <ToolUse block={block} embedded />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ProcessRow;
