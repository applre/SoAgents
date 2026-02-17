interface Props { input: Record<string, unknown>; result?: string }
export default function WriteTool({ input, result }: Props) {
  return (
    <div className="text-[var(--ink-secondary)]">
      <span className="font-mono">{String(input.file_path ?? '')}</span>
      {result && <span className="ml-2 text-green-600">✓ 写入成功</span>}
    </div>
  );
}
