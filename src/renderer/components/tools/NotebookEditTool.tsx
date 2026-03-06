interface Props { input: Record<string, unknown>; result?: string }

export default function NotebookEditTool({ input, result }: Props) {
  const notebookPath = String(input.notebook_path ?? '');
  const editMode = String(input.edit_mode ?? 'replace');
  const cellType = String(input.cell_type ?? 'code');
  const newSource = String(input.new_source ?? '');

  const modeLabel = editMode === 'insert' ? '插入' : editMode === 'delete' ? '删除' : '替换';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[var(--ink-secondary)]">
        <span className="font-mono">{notebookPath}</span>
        <span className="rounded bg-[var(--paper)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-tertiary)]">
          {modeLabel} · {cellType}
        </span>
        {result && <span className="text-green-600">✓</span>}
      </div>

      {editMode !== 'delete' && newSource && (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {newSource}
        </pre>
      )}
    </div>
  );
}
