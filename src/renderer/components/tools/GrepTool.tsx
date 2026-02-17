interface Props { input: Record<string, unknown>; result?: string }
export default function GrepTool({ input, result }: Props) {
  const count = result?.split('\n').filter(Boolean).length ?? 0;
  return (
    <div className="text-[var(--ink-secondary)]">
      <span className="font-mono">{String(input.pattern ?? '')}</span>
      {input.path != null && <span className="font-mono ml-1 text-[var(--ink-tertiary)]"> in {String(input.path)}</span>}
      {result && <span className="ml-2 text-[var(--ink-tertiary)]">{count} 处匹配</span>}
    </div>
  );
}
