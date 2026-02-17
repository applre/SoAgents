interface Props { input: Record<string, unknown>; result?: string }
export default function EditTool({ input, result }: Props) {
  return (
    <div className="text-[var(--ink-secondary)]">
      <span className="font-mono">{String(input.file_path ?? '')}</span>
      {result && <span className="ml-2 text-green-600">✓ 编辑成功</span>}
    </div>
  );
}
