interface Props { input: Record<string, unknown>; result?: string }

export default function AgentTool({ input, result }: Props) {
  const description = String(input.description ?? '');
  const prompt = String(input.prompt ?? '');
  const subagentType = String(input.subagent_type ?? '');
  const isBackground = Boolean(input.run_in_background);

  // 尝试从 result 解析状态
  let parsedStatus: string | null = null;
  let textContent: string | null = null;
  if (result) {
    try {
      const parsed = JSON.parse(result);
      parsedStatus = parsed.status ?? null;
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

  const statusIcon = parsedStatus === 'completed' ? '✓' : parsedStatus === 'error' ? '✗' : null;
  const statusColor = parsedStatus === 'completed' ? 'text-green-600' : parsedStatus === 'error' ? 'text-red-500' : '';

  return (
    <div className="space-y-1.5">
      {/* 标题行 */}
      <div className="flex items-center gap-2 text-[var(--ink-secondary)]">
        {subagentType && (
          <span className="rounded bg-[var(--paper)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-tertiary)]">
            {subagentType}
          </span>
        )}
        {isBackground && (
          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
            后台
          </span>
        )}
        <span className="font-medium">{description}</span>
        {statusIcon && <span className={statusColor}>{statusIcon}</span>}
      </div>

      {/* Prompt 预览 */}
      {prompt && (
        <div className="rounded bg-blue-500/5 px-2 py-1.5">
          <pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[var(--ink-secondary)] text-[11px]">
            {prompt.length > 300 ? prompt.slice(0, 300) + '...' : prompt}
          </pre>
        </div>
      )}

      {/* 结果 */}
      {textContent && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {textContent.length > 1000 ? textContent.slice(0, 1000) + '\n...' : textContent}
        </pre>
      )}
    </div>
  );
}
