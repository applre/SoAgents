import { Bold, Italic, Code, Link2, Minus, Eye, PenLine } from 'lucide-react';

export type ToolbarAction =
  | 'bold' | 'italic' | 'h1' | 'h2' | 'code' | 'codeblock' | 'link' | 'divider';

interface Props {
  mode: 'edit' | 'preview';
  onModeChange: (mode: 'edit' | 'preview') => void;
  onAction: (action: ToolbarAction) => void;
  fileName: string;
}

export default function EditorToolbar({ mode, onModeChange, onAction, fileName }: Props) {
  const tools: { icon: React.ReactNode; label: string; action: ToolbarAction }[] = [
    { icon: <Bold size={14} />, label: '粗体 (Ctrl+B)', action: 'bold' },
    { icon: <Italic size={14} />, label: '斜体 (Ctrl+I)', action: 'italic' },
    { icon: <span className="text-[11px] font-bold leading-none">H1</span>, label: '一级标题', action: 'h1' },
    { icon: <span className="text-[11px] font-bold leading-none">H2</span>, label: '二级标题', action: 'h2' },
    { icon: <Code size={14} />, label: '行内代码', action: 'code' },
    { icon: <span className="text-[10px] font-mono leading-none">```</span>, label: '代码块', action: 'codeblock' },
    { icon: <Link2 size={14} />, label: '链接', action: 'link' },
    { icon: <Minus size={14} />, label: '分割线', action: 'divider' },
  ];

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] bg-[var(--paper)] shrink-0">
      {/* 左：格式化按钮（仅编辑模式） */}
      <div className="flex items-center gap-0.5">
        {mode === 'edit' && tools.map((t) => (
          <button
            key={t.action}
            onClick={() => onAction(t.action)}
            title={t.label}
            className="flex h-7 min-w-[28px] items-center justify-center rounded px-1 text-[var(--ink-secondary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* 中：文件名 */}
      <span className="text-[13px] text-[var(--ink-secondary)] truncate max-w-[300px]">{fileName}</span>

      {/* 右：Edit / Preview 切换 */}
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
        <button
          onClick={() => onModeChange('edit')}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === 'edit'
              ? 'bg-white text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
          }`}
        >
          <PenLine size={11} />编辑
        </button>
        <button
          onClick={() => onModeChange('preview')}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === 'preview'
              ? 'bg-white text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
          }`}
        >
          <Eye size={11} />预览
        </button>
      </div>
    </div>
  );
}
