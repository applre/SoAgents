import { Eye, PenLine, Copy, MessageSquare, Save, ExternalLink } from 'lucide-react';

export type ToolbarAction =
  | 'bold' | 'italic' | 'h1' | 'h2' | 'h3' | 'code' | 'codeblock'
  | 'link' | 'divider' | 'ul' | 'ol' | 'quote' | 'table';

// ── EditorActionBar：编辑/预览切换 + 右侧操作按钮 ──────────────────
interface ActionBarProps {
  mode: 'edit' | 'preview';
  onModeChange?: (mode: 'edit' | 'preview') => void;
  onSave: () => void;
  onGoToChat: () => void;
  onCopy?: () => void;
  onOpenExternal?: () => void;
}

export function EditorActionBar({ mode, onModeChange, onSave, onGoToChat, onCopy, onOpenExternal }: ActionBarProps) {
  return (
    <div
      className="flex items-center justify-between shrink-0 bg-[var(--paper)]"
      style={{ height: 48, borderBottom: '1px solid var(--border)', padding: '0 24px' }}
    >
      {/* 左：编辑 / 预览（仅 Markdown 文件显示） */}
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5" style={{ visibility: onModeChange ? 'visible' : 'hidden' }}>
        <button
          onClick={() => onModeChange?.('edit')}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] font-medium transition-colors ${
            mode === 'edit'
              ? 'bg-white text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
          }`}
        >
          <PenLine size={12} />编辑
        </button>
        <button
          onClick={() => onModeChange?.('preview')}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] font-medium transition-colors ${
            mode === 'preview'
              ? 'bg-white text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
          }`}
        >
          <Eye size={12} />预览
        </button>
      </div>

      {/* 右：操作按钮 */}
      <div className="flex items-center gap-3">
        {onOpenExternal && (
          <button
            onClick={onOpenExternal}
            className="flex items-center gap-1.5 text-[13px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
          >
            <ExternalLink size={13} />
            <span>Open in Obsidian</span>
          </button>
        )}
        {onCopy && (
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 text-[13px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
          >
            <Copy size={13} />
            <span>复制</span>
          </button>
        )}
        <button
          onClick={onGoToChat}
          className="flex items-center gap-1.5 text-[13px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
        >
          <MessageSquare size={13} />
          <span>去对话</span>
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 text-[13px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
        >
          <Save size={13} />
          <span>保存</span>
        </button>
      </div>
    </div>
  );
}

// ── RichTextToolbar：富文本格式化按钮 ────────────────────────────────
interface RichTextToolbarProps {
  mode: 'edit' | 'preview';
  onAction: (action: ToolbarAction) => void;
}

export function RichTextToolbar({ mode, onAction }: RichTextToolbarProps) {
  if (mode === 'preview') return null;

  const sep = <div className="w-px h-4 bg-[var(--border)] mx-1" />;

  const btn = (label: string, action: ToolbarAction, content: React.ReactNode) => (
    <button
      key={action}
      title={label}
      onClick={() => onAction(action)}
      className="flex h-7 min-w-[26px] items-center justify-center rounded px-1 text-[var(--ink-secondary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors text-[13px]"
    >
      {content}
    </button>
  );

  return (
    <div
      className="flex items-center shrink-0 bg-[var(--paper)] overflow-x-auto"
      style={{ height: 44, borderBottom: '1px solid var(--border)', padding: '0 24px', gap: 2 }}
    >
      {btn('粗体', 'bold', <b>B</b>)}
      {btn('斜体', 'italic', <i>I</i>)}
      {btn('代码', 'code', <code style={{ fontSize: 11 }}>`</code>)}
      {sep}
      {btn('一级标题', 'h1', <span className="font-bold text-[13px]">H1</span>)}
      {btn('二级标题', 'h2', <span className="font-bold text-[13px]">H2</span>)}
      {btn('三级标题', 'h3', <span className="font-bold text-[13px]">H3</span>)}
      {sep}
      {btn('无序列表', 'ul', <span>≡</span>)}
      {btn('有序列表', 'ol', <span>①</span>)}
      {sep}
      {btn('引用', 'quote', <span>"</span>)}
      {btn('代码块', 'codeblock', <code style={{ fontSize: 10 }}>```</code>)}
      {btn('分割线', 'divider', <span>—</span>)}
      {sep}
      {btn('表格', 'table', <span>⊞</span>)}
      {btn('链接', 'link', <span>🔗</span>)}
    </div>
  );
}

// 保留默认导出（向后兼容）
export default function EditorToolbar() { return null; }
