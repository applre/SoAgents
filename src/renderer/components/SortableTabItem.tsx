import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import type { Tab } from '../types/tab';

interface Props {
  tab: Tab;
  isActive: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}

export default function SortableTabItem({ tab, isActive, onActivate, onClose }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={[
        'group relative flex h-full max-w-[180px] min-w-[100px] cursor-pointer items-center gap-1.5 px-3 text-sm select-none',
        'border-r border-[var(--border)]',
        isActive
          ? 'bg-[var(--paper)] text-[var(--ink)]'
          : 'bg-[var(--paper-dark)] text-[var(--ink-secondary)] hover:bg-[var(--paper)] hover:text-[var(--ink)]',
      ].join(' ')}
      onClick={() => onActivate(tab.id)}
    >
      {/* 活跃指示线 */}
      {isActive && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--accent-warm)]" />
      )}

      {/* Tab 生成中指示点 */}
      {tab.isGenerating && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-warm)] animate-pulse" />
      )}

      {/* Tab 标题 */}
      <span className="flex-1 truncate">{tab.title}</span>

      {/* 关闭按钮 */}
      <button
        className={[
          'shrink-0 rounded p-0.5 opacity-0 transition-opacity',
          'group-hover:opacity-100',
          isActive ? 'opacity-100' : '',
          'hover:bg-[var(--paper-dark)] hover:text-[var(--ink)]',
        ].join(' ')}
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
