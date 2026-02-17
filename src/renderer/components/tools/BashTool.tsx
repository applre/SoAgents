interface Props { input: Record<string, unknown>; result?: string }

export default function BashTool({ input, result }: Props) {
  const lines = result?.split('\n') ?? [];
  const preview = lines.slice(0, 20).join('\n');
  const truncated = lines.length > 20;
  return (
    <div className="space-y-1">
      <div className="font-mono text-[var(--ink-secondary)]">
        <span className="text-[var(--ink-tertiary)]">$ </span>{String(input.command ?? '')}
      </div>
      {result && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {preview}{truncated && '\n...'}
        </pre>
      )}
    </div>
  );
}
