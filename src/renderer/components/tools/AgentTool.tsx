import { CheckCircle, Clock, Loader2, Wrench, XCircle } from 'lucide-react';

interface Props { input: Record<string, unknown>; result?: string }

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

export default function AgentTool({ input, result }: Props) {
  const description = String(input.description ?? '');
  const prompt = String(input.prompt ?? '');
  const subagentType = String(input.subagent_type ?? '');
  const isBackground = Boolean(input.run_in_background);

  // Parse result
  let parsedStatus: string | null = null;
  let textContent: string | null = null;
  let durationMs: number | null = null;
  let totalTokens: number | null = null;
  let toolUseCount: number | null = null;

  if (result) {
    try {
      const parsed = JSON.parse(result);
      parsedStatus = parsed.status ?? null;
      durationMs = parsed.totalDurationMs ?? null;
      totalTokens = parsed.totalTokens ?? null;
      toolUseCount = parsed.totalToolUseCount ?? null;
      if (Array.isArray(parsed.content)) {
        textContent = parsed.content
          .filter((c: { type: string; text?: string }) => c.type === 'text' && c.text)
          .map((c: { text: string }) => c.text)
          .join('\n\n');
      }
    } catch {
      textContent = result;
    }
  }

  const isCompleted = parsedStatus === 'completed';
  const isError = parsedStatus === 'error';
  const isRunning = !result;

  return (
    <div className="space-y-2">
      {/* Header: type badge + description */}
      <div className="flex items-center gap-2 text-[var(--ink-secondary)]">
        {subagentType && (
          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
            {subagentType}
          </span>
        )}
        {isBackground && (
          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
            后台
          </span>
        )}
        <span className="font-medium">{description}</span>
      </div>

      {/* Stats bar */}
      {(isRunning || parsedStatus) && (
        <div className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs ${
          isRunning ? 'bg-[var(--accent)]/5 text-[var(--accent)]'
          : isCompleted ? 'bg-[var(--success)]/10 text-[var(--success)]'
          : isError ? 'bg-[var(--error)]/10 text-[var(--error)]'
          : 'bg-[var(--surface)] text-[var(--ink-tertiary)]'
        }`}>
          {/* Status */}
          <div className="flex items-center gap-1.5 font-medium">
            {isRunning ? <Loader2 className="size-3.5 animate-spin" />
              : isCompleted ? <CheckCircle className="size-3.5" />
              : isError ? <XCircle className="size-3.5" />
              : null}
            <span>{isRunning ? '运行中' : isCompleted ? '完成' : isError ? '错误' : parsedStatus}</span>
          </div>

          {/* Duration */}
          {durationMs != null && (
            <div className="flex items-center gap-1 text-[var(--ink-tertiary)]">
              <Clock className="size-3.5" />
              <span>{formatDuration(durationMs)}</span>
            </div>
          )}

          {/* Tool use count */}
          {toolUseCount != null && toolUseCount > 0 && (
            <div className="flex items-center gap-1 text-[var(--ink-tertiary)]">
              <Wrench className="size-3.5" />
              <span>{toolUseCount} 次工具调用</span>
            </div>
          )}

          {/* Tokens */}
          {totalTokens != null && totalTokens > 0 && (
            <span className="text-[var(--ink-tertiary)]">{formatTokens(totalTokens)} tokens</span>
          )}
        </div>
      )}

      {/* Prompt preview */}
      {prompt && (
        <div className="rounded-lg bg-indigo-500/5 px-2.5 py-1.5">
          <pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-[var(--ink-secondary)]">
            {prompt.length > 300 ? prompt.slice(0, 300) + '...' : prompt}
          </pre>
        </div>
      )}

      {/* Result content */}
      {textContent && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {textContent.length > 1000 ? textContent.slice(0, 1000) + '\n...' : textContent}
        </pre>
      )}
    </div>
  );
}
