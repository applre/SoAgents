import { useState, useCallback } from 'react';

interface AskQuestion {
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
}

interface Props {
  questions: AskQuestion[];
  toolUseId: string;
  onRespond: (answers: Record<string, string>) => void;
}

export default function AskUserQuestionPrompt({ questions, onRespond }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});

  const total = questions.length;
  const q = questions[step];
  const isLast = step === total - 1;
  const isFirst = step === 0;

  const currentAnswer = answers[q.question] ?? '';
  const hasAnswer = currentAnswer.trim() !== '';

  const setAnswer = useCallback((label: string) => {
    setOtherTexts((prev) => ({ ...prev, [q.question]: '' }));
    setAnswers((prev) => ({ ...prev, [q.question]: label }));
  }, [q.question]);

  const toggleAnswer = useCallback((label: string) => {
    setOtherTexts((prev) => ({ ...prev, [q.question]: '' }));
    setAnswers((prev) => {
      const current = prev[q.question] ?? '';
      const selected = current ? current.split(', ') : [];
      const idx = selected.indexOf(label);
      if (idx >= 0) selected.splice(idx, 1);
      else selected.push(label);
      return { ...prev, [q.question]: selected.join(', ') };
    });
  }, [q.question]);

  const isSelected = (label: string): boolean => {
    if (q.multiSelect) return currentAnswer.split(', ').includes(label);
    return currentAnswer === label;
  };

  const isOtherActive = (): boolean => {
    if (!currentAnswer) return false;
    const allLabels = q.options.map((o) => o.label);
    if (q.multiSelect) {
      return currentAnswer.split(', ').filter(Boolean).some((s) => !allLabels.includes(s));
    }
    return !allLabels.includes(currentAnswer);
  };

  const handleNext = () => {
    if (isLast) {
      const allAnswered = questions.every((qq) => answers[qq.question]?.trim());
      if (allAnswered) onRespond(answers);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setStep((s) => s - 1);
  };

  // 单选：点击即选中并自动下一步
  const handleOptionClick = (label: string) => {
    if (q.multiSelect) {
      toggleAnswer(label);
    } else {
      setAnswer(label);
      // 单选自动下一步（延迟一点让用户看到选中态）
      setTimeout(() => {
        if (isLast) {
          const nextAnswers = { ...answers, [q.question]: label };
          const allAnswered = questions.every((qq) => nextAnswers[qq.question]?.trim());
          if (allAnswered) onRespond(nextAnswers);
        } else {
          setStep((s) => s + 1);
        }
      }, 150);
    }
  };

  return (
    <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] px-4 py-3 mx-4 mb-3">
      {/* 顶栏：标题 + 步骤指示器 */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">💬</span>
          <span className="text-xs font-medium text-[var(--ink)]">Claude 向你提问</span>
        </div>
        {total > 1 && (
          <div className="flex items-center gap-1">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? 'w-4 bg-[var(--accent)]'
                    : answers[questions[i].question]?.trim()
                      ? 'w-1.5 bg-[var(--accent)]/40'
                      : 'w-1.5 bg-[var(--ink-tertiary)]/30'
                }`}
              />
            ))}
            <span className="ml-1.5 text-[10px] text-[var(--ink-tertiary)]">{step + 1}/{total}</span>
          </div>
        )}
      </div>

      {/* 当前问题 header + 文本 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-block rounded bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
          {q.header}
        </span>
        <span className="text-sm text-[var(--ink)]">{q.question}</span>
      </div>

      {/* 选项列表 */}
      <div className="space-y-1">
        {q.options.map((opt) => {
          const selected = isSelected(opt.label);
          return (
            <button
              key={opt.label}
              onClick={() => handleOptionClick(opt.label)}
              className={`w-full text-left rounded-lg border px-3 py-1.5 transition-colors ${
                selected
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--border)] hover:border-[var(--ink-tertiary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 text-xs">
                  {q.multiSelect ? (selected ? '☑' : '☐') : (selected ? '●' : '○')}
                </span>
                <span className={`text-sm ${selected ? 'text-[var(--accent)] font-medium' : 'text-[var(--ink)]'}`}>
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="text-xs text-[var(--ink-tertiary)] truncate">— {opt.description}</span>
                )}
              </div>
            </button>
          );
        })}

        {/* Other */}
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
          isOtherActive() ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)]'
        }`}>
          <span className="text-xs text-[var(--ink-tertiary)] flex-shrink-0">Other:</span>
          <input
            type="text"
            value={otherTexts[q.question] ?? ''}
            onChange={(e) => {
              setOtherTexts((prev) => ({ ...prev, [q.question]: e.target.value }));
              setAnswers((prev) => ({ ...prev, [q.question]: e.target.value }));
            }}
            placeholder="自定义答案..."
            className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)]"
          />
        </div>
      </div>

      {/* 底部导航 */}
      <div className="mt-2.5 flex items-center justify-between">
        <div>
          {!isFirst && (
            <button
              onClick={handlePrev}
              className="text-xs text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors"
            >
              ← 上一题
            </button>
          )}
        </div>
        <button
          onClick={handleNext}
          disabled={!hasAnswer}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition-opacity disabled:opacity-30 ${
            isLast
              ? 'bg-[var(--accent)] text-white hover:opacity-90'
              : 'bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20'
          }`}
        >
          {isLast ? '提交' : '下一题 →'}
        </button>
      </div>
    </div>
  );
}
