import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Loader2, Brain, XCircle, ChevronRight } from 'lucide-react';
import type { ContentBlock } from '../types/chat';
import { getToolBadgeConfig } from './tools/toolBadgeConfig';
import ToolUse from './tools/ToolUse';

type ProcessBlock =
  | Extract<ContentBlock, { type: 'thinking' }>
  | Extract<ContentBlock, { type: 'tool_use' }>;

interface Props {
  block: ProcessBlock;
  isStreaming?: boolean;
}

/** TodoWrite/WebSearch 默认展开 */
const AUTO_OPEN_TOOLS = new Set(['TodoWrite', 'WebSearch']);

/** 获取工具摘要 */
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

const ProcessRow = memo(function ProcessRow({ block, isStreaming }: Props) {
  const isThinking = block.type === 'thinking';
  const isToolUse = block.type === 'tool_use';

  // 展开状态：三态派生
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const isActive = isThinking
    ? !!isStreaming
    : (isToolUse && block.status === 'running');
  const autoOpen = isToolUse ? AUTO_OPEN_TOOLS.has(block.name) : false;

  const isExpanded = userToggled !== null
    ? userToggled
    : (isActive && isThinking) || autoOpen;

  const handleToggle = useCallback(() => {
    setUserToggled((prev) => prev === null ? !isExpanded : !prev);
  }, [isExpanded]);

  // 思考计时器
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const startTimeRef = useRef(0);
  useEffect(() => {
    if (!isThinking || !isActive) return;
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      setThinkingElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isThinking, isActive]);

  // 状态点样式
  let dotColor = 'bg-[var(--ink-tertiary)]/40';
  if (isActive) dotColor = 'bg-amber-400 animate-pulse';
  else if (isToolUse && block.status === 'error') dotColor = 'bg-[var(--error)]';

  // 图标
  let icon: React.ReactNode = null;
  if (isThinking) {
    icon = isActive
      ? <Loader2 className="size-3.5 animate-spin text-[var(--ink-tertiary)]" />
      : <Brain className="size-3.5 text-[var(--ink-tertiary)]" />;
  } else if (isToolUse) {
    const config = getToolBadgeConfig(block.name);
    icon = isActive
      ? <Loader2 className="size-3.5 animate-spin text-[var(--ink-tertiary)]" />
      : (block.status === 'error'
          ? <XCircle className="size-3.5 text-[var(--error)]" />
          : config.icon);
  }

  // 主标签
  let label = '';
  let subLabel = '';
  if (isThinking) {
    label = isActive ? '思考中…' : '思考过程';
    if (isActive && thinkingElapsed > 0) subLabel = `${thinkingElapsed}s`;
    else if (!isActive && block.thinking) {
      // 思考结束后显示字数
      subLabel = `${block.thinking.length} 字`;
    }
  } else if (isToolUse) {
    label = block.name;
    subLabel = getToolLabel(block);
  }

  return (
    <div className="my-0.5">
      {/* 行式头部 */}
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-[var(--hover)]"
        onClick={handleToggle}
      >
        {/* 状态点 */}
        <span className={`inline-block size-1.5 shrink-0 rounded-full ${dotColor}`} />
        {/* 图标 */}
        <span className="shrink-0">{icon}</span>
        {/* 主标签 */}
        <span className="font-medium text-[var(--ink-secondary)]">{label}</span>
        {/* 子标签 */}
        {subLabel && (
          <span className="truncate font-mono text-[var(--ink-tertiary)]">{subLabel}</span>
        )}
        {/* 展开箭头 */}
        <ChevronRight className={`ml-auto size-3 shrink-0 text-[var(--ink-tertiary)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* 展开详情：CSS Grid 高度动画 */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pl-6 pr-1.5 pb-1 pt-0.5">
            {isThinking && (
              <div className="text-xs text-[var(--ink-tertiary)] italic whitespace-pre-wrap max-h-48 overflow-y-auto">
                {block.thinking}
              </div>
            )}
            {isToolUse && (
              <ToolUse block={block} embedded />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProcessRow;
