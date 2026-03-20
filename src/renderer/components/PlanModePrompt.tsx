interface ExitPlanModeProps {
  requestId: string;
  plan?: string;
  onRespond: (approved: boolean) => void;
}

export function ExitPlanModePrompt({ plan, onRespond }: ExitPlanModeProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[520px] rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5 shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold text-[var(--ink)]">执行方案审批</h3>
        </div>
        <p className="mb-3 text-sm text-[var(--ink-secondary)]">
          Claude 制定了以下方案，是否批准执行？
        </p>
        {plan && (
          <pre className="mb-4 max-h-60 overflow-auto rounded bg-[var(--surface)] p-3 text-xs font-mono text-[var(--ink-secondary)] whitespace-pre-wrap">
            {plan}
          </pre>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onRespond(false)}
            className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm text-[var(--ink-secondary)] hover:bg-[var(--hover)]"
          >
            拒绝
          </button>
          <button
            onClick={() => onRespond(true)}
            className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm text-white hover:opacity-90"
          >
            批准执行
          </button>
        </div>
      </div>
    </div>
  );
}

interface EnterPlanModeProps {
  requestId: string;
  onRespond: (approved: boolean) => void;
}

export function EnterPlanModePrompt({ onRespond }: EnterPlanModeProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[420px] rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5 shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold text-[var(--ink)]">进入计划模式</h3>
        </div>
        <p className="mb-3 text-sm text-[var(--ink-secondary)]">
          Claude 请求进入计划模式。在计划模式下，Claude 将先制定方案再执行，需要你的审批。
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onRespond(false)}
            className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm text-[var(--ink-secondary)] hover:bg-[var(--hover)]"
          >
            拒绝
          </button>
          <button
            onClick={() => onRespond(true)}
            className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm text-white hover:opacity-90"
          >
            同意
          </button>
        </div>
      </div>
    </div>
  );
}
