interface Props {
  toolName: string;
  toolUseId: string;
  toolInput: Record<string, unknown>;
  onRespond: (allow: boolean) => void;
}

export default function PermissionPrompt({ toolName, toolInput, onRespond }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[480px] rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5 shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">🔐</span>
          <h3 className="font-semibold text-[var(--ink)]">权限请求</h3>
        </div>
        <p className="mb-3 text-sm text-[var(--ink-secondary)]">
          Claude 想要使用工具：
          <span className="mx-1 rounded bg-[var(--paper-dark)] px-1.5 py-0.5 font-mono text-xs font-medium text-[var(--ink)]">
            {toolName}
          </span>
        </p>
        {Object.keys(toolInput).length > 0 && (
          <pre className="mb-4 max-h-40 overflow-auto rounded bg-[var(--paper-dark)] p-2.5 text-xs font-mono text-[var(--ink-secondary)]">
            {JSON.stringify(toolInput, null, 2)}
          </pre>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onRespond(false)}
            className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm text-[var(--ink-secondary)] hover:bg-[var(--paper-dark)]"
          >
            拒绝
          </button>
          <button
            onClick={() => onRespond(true)}
            className="rounded-lg bg-[var(--accent-warm)] px-4 py-1.5 text-sm text-white hover:opacity-90"
          >
            允许
          </button>
        </div>
      </div>
    </div>
  );
}
