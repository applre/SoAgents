import { useState } from 'react';

interface Props {
  question: string;
  options?: string[];
  toolUseId: string;
  onRespond: (response: string) => void;
}

export default function AskUserQuestionPrompt({ question, options, onRespond }: Props) {
  const [text, setText] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[480px] rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5 shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">❓</span>
          <h3 className="font-semibold text-[var(--ink)]">Claude 向你提问</h3>
        </div>
        <p className="mb-4 text-sm text-[var(--ink)]">{question}</p>
        {options ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => onRespond(opt)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--ink-secondary)] hover:bg-[var(--accent-warm)] hover:text-white hover:border-transparent"
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper-light)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-warm)]"
              rows={3}
              placeholder="输入你的回答..."
            />
            <button
              onClick={() => text.trim() && onRespond(text.trim())}
              disabled={!text.trim()}
              className="mt-2 rounded-lg bg-[var(--accent-warm)] px-4 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-40"
            >
              确认
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
