interface Props { input: Record<string, unknown>; result?: string }

export default function SkillTool({ input, result }: Props) {
  const skillName = String(input.skill ?? '');
  const args = input.args ? String(input.args) : null;

  return (
    <div className="space-y-1">
      <div className="font-mono text-[var(--ink-secondary)]">
        <span className="text-[var(--ink-tertiary)]">/ </span>
        <span className="font-medium">{skillName}</span>
        {args && <span className="ml-1.5 text-[var(--ink-tertiary)]">{args}</span>}
      </div>

      {result && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {result}
        </pre>
      )}
    </div>
  );
}
