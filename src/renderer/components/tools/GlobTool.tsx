interface Props { input: Record<string, unknown>; result?: string }
export default function GlobTool({ input, result }: Props) {
  const count = result?.split('\n').filter(Boolean).length ?? 0;
  return (
    <div className="text-[var(--ink-secondary)]">
      <span className="font-mono">{String(input.pattern ?? '')}</span>
      {result && <span className="ml-2 text-[var(--ink-tertiary)]">{count} 个文件</span>}
    </div>
  );
}
