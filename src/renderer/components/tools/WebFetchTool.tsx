interface Props { input: Record<string, unknown>; result?: string }

export default function WebFetchTool({ input, result }: Props) {
  const url = String(input.url ?? '');
  const prompt = String(input.prompt ?? '');
  const lines = result?.split('\n') ?? [];
  const preview = lines.slice(0, 20).join('\n');
  const truncated = lines.length > 20;

  return (
    <div className="space-y-1">
      {/* URL */}
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--ink-tertiary)]">🌍</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[var(--accent)] hover:underline truncate"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      </div>

      {/* Prompt */}
      {prompt && (
        <div className="text-[var(--ink-tertiary)] italic text-[11px]">
          {prompt}
        </div>
      )}

      {/* Result */}
      {result && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {preview}{truncated && '\n...'}
        </pre>
      )}
    </div>
  );
}
