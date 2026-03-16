import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ContentBlock } from '../../types/chat';
import { parsePartialJson } from '../../utils/parsePartialJson';
import { getToolBadgeConfig } from './toolBadgeConfig';
import BashTool from './BashTool';
import BashOutputTool from './BashOutputTool';
import KillShellTool from './KillShellTool';
import ReadTool from './ReadTool';
import WriteTool from './WriteTool';
import EditTool from './EditTool';
import GlobTool from './GlobTool';
import GrepTool from './GrepTool';
import WebSearchTool from './WebSearchTool';
import WebFetchTool from './WebFetchTool';
import TodoWriteTool from './TodoWriteTool';
import SkillTool from './SkillTool';
import NotebookEditTool from './NotebookEditTool';
import AgentTool from './AgentTool';

interface Props {
  block: Extract<ContentBlock, { type: 'tool_use' }>;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']);

/** TodoWrite/WebSearch 默认展开 */
const AUTO_OPEN_TOOLS = new Set(['TodoWrite', 'WebSearch']);

/** 从已完成的工具调用中提取图片预览 URL */
function getToolImagePreviewUrl(block: Extract<ContentBlock, { type: 'tool_use' }>): string | null {
  if (block.status !== 'done' || !block.input) return null;
  const input = tryParse(block.input);

  if (block.name === 'Write') {
    const p = String(input.file_path ?? '');
    const ext = p.split('.').pop()?.toLowerCase() ?? '';
    if (IMAGE_EXTS.has(ext)) return `asset://localhost${p}`;
  }

  if (block.name === 'Bash') {
    const command = String(input.command ?? '');
    const patterns = [/>\s*(\S+)/g, /-o\s+(\S+)/g, /(?:^|\s)(\/[^\s]+)/g];
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(command)) !== null) {
        const p = m[1];
        const ext = p.split('.').pop()?.toLowerCase() ?? '';
        if (IMAGE_EXTS.has(ext)) return `asset://localhost${p}`;
      }
    }
  }

  return null;
}

/** 获取折叠行的简短摘要 */
function getToolSummary(block: Extract<ContentBlock, { type: 'tool_use' }>): string {
  const input = tryParse(block.input ?? '{}');
  switch (block.name) {
    case 'Bash': return String(input.command ?? '').slice(0, 60);
    case 'BashOutput': return '';
    case 'KillShell': return '';
    case 'Read': return String(input.file_path ?? '');
    case 'Write': return String(input.file_path ?? '');
    case 'Edit': return String(input.file_path ?? '');
    case 'Glob': return String(input.pattern ?? '');
    case 'Grep': return String(input.pattern ?? '');
    case 'WebSearch': return String(input.query ?? '');
    case 'WebFetch': return String(input.url ?? '').slice(0, 60);
    case 'Skill': return String(input.skill ?? '');
    case 'NotebookEdit': return String(input.notebook_path ?? '');
    case 'Agent':
    case 'Task': return String(input.description ?? '');
    case 'AskUserQuestion': return '等待用户回答';
    case 'EnterPlanMode': return '进入计划模式';
    case 'ExitPlanMode': return '退出计划模式';
    default: return '';
  }
}

export default function ToolUse({ block }: Props) {
  const autoOpen = AUTO_OPEN_TOOLS.has(block.name);
  const [open, setOpen] = useState(autoOpen);
  const config = getToolBadgeConfig(block.name);
  const isRunning = block.status === 'running';
  const isError = block.status === 'error';
  const statusIcon = isRunning ? <Loader2 className="size-3 animate-spin text-[var(--ink-tertiary)]" /> : null;

  const hasDetails = block.input || block.result;
  const imagePreviewUrl = getToolImagePreviewUrl(block);
  const summary = getToolSummary(block);

  return (
    <div className="my-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 text-xs">
      <button
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-[var(--hover)] rounded-lg transition-colors"
        onClick={() => hasDetails && setOpen((v) => !v)}
      >
        {/* Tool icon */}
        <span className={`flex shrink-0 items-center justify-center ${config.iconColor}`}>
          {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : config.icon}
        </span>

        {/* Tool name */}
        <span className={`font-medium ${config.textColor}`}>{block.name}</span>

        {/* Summary (collapsed only) */}
        {summary && !open && (
          <span className="ml-0.5 truncate font-mono text-[var(--ink-tertiary)]">{summary}</span>
        )}

        {/* Status + chevron */}
        <span className="ml-auto flex items-center gap-1.5">
          {statusIcon}
          {!isRunning && (
            <span className={isError ? 'text-[var(--error)]' : 'text-[var(--success)]'}>
              {isError ? '✗' : '✓'}
            </span>
          )}
          {hasDetails && (
            <span className="text-[var(--ink-tertiary)]">{open ? '▾' : '▸'}</span>
          )}
        </span>
      </button>

      {open && hasDetails && (
        <div className="border-t border-[var(--border)] px-2.5 py-2 space-y-1.5">
          {block.input && renderTool(block)}
        </div>
      )}

      {/* 图片预览 */}
      {imagePreviewUrl && (
        <div className="border-t border-[var(--border)] px-2.5 py-2">
          <img
            src={imagePreviewUrl}
            alt="预览"
            className="max-w-full max-h-64 rounded-lg"
            onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
          />
        </div>
      )}
    </div>
  );
}

function renderTool(block: Extract<ContentBlock, { type: 'tool_use' }>) {
  const input = tryParse(block.input ?? '{}');
  switch (block.name) {
    case 'Bash': return <BashTool input={input} result={block.result} />;
    case 'BashOutput': return <BashOutputTool input={input} result={block.result} />;
    case 'KillShell': return <KillShellTool input={input} result={block.result} />;
    case 'Read': return <ReadTool input={input} result={block.result} />;
    case 'Write': return <WriteTool input={input} result={block.result} />;
    case 'Edit': return <EditTool input={input} result={block.result} />;
    case 'Glob': return <GlobTool input={input} result={block.result} />;
    case 'Grep': return <GrepTool input={input} result={block.result} />;
    case 'WebSearch': return <WebSearchTool input={input} result={block.result} />;
    case 'WebFetch': return <WebFetchTool input={input} result={block.result} />;
    case 'TodoWrite': return <TodoWriteTool input={input} result={block.result} />;
    case 'Skill': return <SkillTool input={input} result={block.result} />;
    case 'NotebookEdit': return <NotebookEditTool input={input} result={block.result} />;
    case 'Agent':
    case 'Task': return <AgentTool input={input} result={block.result} />;
    case 'AskUserQuestion': return renderAskUser(input, block.result);
    case 'EnterPlanMode':
    case 'ExitPlanMode': return renderPlanMode(block.name, block.result);
    default: return (
      <pre className="whitespace-pre-wrap font-mono text-[var(--ink-secondary)]">
        {block.input}
        {block.result && <><hr className="my-1 border-[var(--border)]"/>{block.result}</>}
      </pre>
    );
  }
}

function renderAskUser(input: Record<string, unknown>, result?: string) {
  const question = String(input.question ?? '');
  return (
    <div className="space-y-1.5">
      {question && (
        <div className="text-[var(--ink-secondary)] italic">
          {question}
        </div>
      )}
      {result && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {result}
        </pre>
      )}
    </div>
  );
}

function renderPlanMode(name: string, result?: string) {
  return (
    <div className="space-y-1.5">
      <div className="text-[var(--ink-secondary)]">
        {name === 'EnterPlanMode' ? '进入计划模式' : '退出计划模式'}
      </div>
      {result && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {result}
        </pre>
      )}
    </div>
  );
}

function tryParse(s: string): Record<string, unknown> {
  return parsePartialJson<Record<string, unknown>>(s) ?? {};
}
