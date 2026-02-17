interface Props { input: Record<string, unknown>; result?: string }
export default function ReadTool({ input, result }: Props) {
  const lines = result?.split('\n').length ?? 0;
  return (
    <div className="text-[var(--ink-secondary)]">
      <span className="font-mono">{String(input.file_path ?? '')}</span>
      {result && <span className="ml-2 text-[var(--ink-tertiary)]">({lines} 行)</span>}
    </div>
  );
}
