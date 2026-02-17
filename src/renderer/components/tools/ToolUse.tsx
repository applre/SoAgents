import { useState } from 'react';
import type { ContentBlock } from '../../types/chat';
import BashTool from './BashTool';
import ReadTool from './ReadTool';
import WriteTool from './WriteTool';
import EditTool from './EditTool';
import GlobTool from './GlobTool';
import GrepTool from './GrepTool';

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
  Task: '🤖',
};

export default function ToolUse({ block }: Props) {
  const [open, setOpen] = useState(false);
  const icon = TOOL_ICONS[block.name] ?? '🛠';
  const statusIcon = block.status === 'running' ? '⏳' : block.status === 'error' ? '✗' : '✓';
  const statusColor = block.status === 'running'
    ? 'text-[var(--ink-tertiary)]'
    : block.status === 'error'
    ? 'text-red-500'
    : 'text-green-600';

  const hasDetails = block.input || block.result;

  return (
    <div className="my-1 rounded border border-[var(--border)] bg-[var(--paper-dark)] text-xs">
      <button
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-[var(--paper-light)]"
        onClick={() => hasDetails && setOpen((v) => !v)}
      >
        <span>{icon}</span>
        <span className="font-mono font-medium text-[var(--ink-secondary)]">{block.name}</span>
        <span className={`ml-auto ${statusColor}`}>{statusIcon}</span>
        {hasDetails && <span className="text-[var(--ink-tertiary)]">{open ? '▾' : '▸'}</span>}
      </button>

      {open && hasDetails && (
        <div className="border-t border-[var(--border)] px-2 py-1.5 space-y-1.5">
          {block.input && renderTool(block)}
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
    default: return (
      <pre className="whitespace-pre-wrap font-mono text-[var(--ink-secondary)]">
        {block.input}
        {block.result && <><hr className="my-1 border-[var(--border)]"/>{block.result}</>}
      </pre>
    );
  }
}

function tryParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
