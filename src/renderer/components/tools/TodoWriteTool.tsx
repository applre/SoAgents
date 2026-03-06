interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

interface Props { input: Record<string, unknown>; result?: string }

export default function TodoWriteTool({ input }: Props) {
  const todos = Array.isArray(input.todos) ? (input.todos as TodoItem[]) : [];

  if (todos.length === 0) {
    return <div className="text-[var(--ink-tertiary)]">加载待办事项...</div>;
  }

  const completedCount = todos.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-1.5">
      {/* 进度汇总 */}
      <div className="text-[var(--ink-tertiary)] tabular-nums">
        {completedCount}/{todos.length} 已完成
      </div>

      {/* 待办列表 */}
      <div className="space-y-0.5">
        {todos.map((todo, i) => {
          const isCompleted = todo.status === 'completed';
          const isInProgress = todo.status === 'in_progress';

          return (
            <div
              key={i}
              className={`flex items-start gap-2 rounded px-2 py-1 ${
                isInProgress ? 'bg-blue-500/10' : ''
              }`}
            >
              {/* 状态图标 */}
              <span className="mt-px shrink-0 w-4 text-center">
                {isCompleted ? (
                  <span className="text-green-600">✓</span>
                ) : isInProgress ? (
                  <span className="text-blue-500 animate-pulse">●</span>
                ) : (
                  <span className="text-[var(--ink-tertiary)]">○</span>
                )}
              </span>

              {/* 内容 */}
              <span
                className={`flex-1 ${
                  isCompleted
                    ? 'text-[var(--ink-tertiary)] line-through'
                    : isInProgress
                    ? 'text-blue-500 font-medium'
                    : 'text-[var(--ink-secondary)]'
                }`}
              >
                {isInProgress ? (todo.activeForm || todo.content) : todo.content}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
