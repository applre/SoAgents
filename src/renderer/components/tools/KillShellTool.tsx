interface Props { input: Record<string, unknown>; result?: string }

export default function KillShellTool({ result }: Props) {
  return (
    <div className="text-[var(--ink-secondary)]">
      {result && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {result}
        </pre>
      )}
    </div>
  );
}
