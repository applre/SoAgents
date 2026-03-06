import { useState } from 'react';
import type { ContentBlock } from '../../types/chat';
import { parsePartialJson } from '../../utils/parsePartialJson';
import BashTool from './BashTool';
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

const TOOL_ICONS: Record<string, string> = {
  Bash: '⚡',
  Read: '📄',
  Write: '✏️',
  Edit: '🔧',
  Glob: '🔍',
  Grep: '🔎',
  WebSearch: '🌐',
  WebFetch: '🌍',
  TodoWrite: '☑️',
  Skill: '⚙️',
  NotebookEdit: '📓',
  Agent: '🤖',
  Task: '🤖',
  AskUserQuestion: '❓',
  EnterPlanMode: '📋',
  ExitPlanMode: '📋',
};

/** TodoWrite/WebSearch 默认展开 */
const AUTO_OPEN_TOOLS = new Set(['TodoWrite', 'WebSearch']);

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']);

/** 从已完成的工具调用中提取图片预览 URL（asset 协议） */
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
    case 'EnterPlanMode':
    case 'ExitPlanMode': return 'Plan Mode';
    default: return '';
  }
}

export default function ToolUse({ block }: Props) {
  const autoOpen = AUTO_OPEN_TOOLS.has(block.name);
  const [open, setOpen] = useState(autoOpen);
  const icon = TOOL_ICONS[block.name] ?? '🛠';
  const statusIcon = block.status === 'running' ? '⏳' : block.status === 'error' ? '✗' : '✓';
  const statusColor = block.status === 'running'
    ? 'text-[var(--ink-tertiary)]'
    : block.status === 'error'
    ? 'text-red-500'
    : 'text-green-600';

  const hasDetails = block.input || block.result;
  const imagePreviewUrl = getToolImagePreviewUrl(block);
  const summary = getToolSummary(block);

  return (
    <div className="my-1 rounded border border-[var(--border)] bg-[var(--paper-dark)] text-xs">
      <button
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-[var(--paper-light)]"
        onClick={() => hasDetails && setOpen((v) => !v)}
      >
        <span>{icon}</span>
        <span className="font-mono font-medium text-[var(--ink-secondary)]">{block.name}</span>
        {summary && !open && (
          <span className="ml-1 truncate font-mono text-[var(--ink-tertiary)]">{summary}</span>
        )}
        <span className={`ml-auto shrink-0 ${statusColor}`}>{statusIcon}</span>
        {hasDetails && <span className="shrink-0 text-[var(--ink-tertiary)]">{open ? '▾' : '▸'}</span>}
      </button>

      {open && hasDetails && (
        <div className="border-t border-[var(--border)] px-2 py-1.5 space-y-1.5">
          {block.input && renderTool(block)}
        </div>
      )}

      {/* 图片预览：不受折叠控制，工具完成后始终显示 */}
      {imagePreviewUrl && (
        <div className="border-t border-[var(--border)] px-2 py-2">
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
    default: return (
      <pre className="whitespace-pre-wrap font-mono text-[var(--ink-secondary)]">
        {block.input}
        {block.result && <><hr className="my-1 border-[var(--border)]"/>{block.result}</>}
      </pre>
    );
  }
}

function tryParse(s: string): Record<string, unknown> {
  return parsePartialJson<Record<string, unknown>>(s) ?? {};
}
