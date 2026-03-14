interface Props { input: Record<string, unknown>; result?: string }

export default function BashOutputTool({ result }: Props) {
  if (!result) return null;

  const lines = result.split('\n');
  const preview = lines.slice(0, 20).join('\n');
  const truncated = lines.length > 20;

  return (
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
      {preview}{truncated && '\n...'}
    </pre>
  );
}
