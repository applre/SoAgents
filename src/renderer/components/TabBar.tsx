import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Plus, Settings } from 'lucide-react';
import type { Tab } from '../types/tab';
import SortableTabItem from './SortableTabItem';

interface Props {
  tabs: Tab[];
  activeTabId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onReorder: (tabs: Tab[]) => void;
  onOpenSettings: () => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onNew,
  onReorder,
  onOpenSettings,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tabs.findIndex((t) => t.id === active.id);
    const newIndex = tabs.findIndex((t) => t.id === over.id);
    onReorder(arrayMove(tabs, oldIndex, newIndex));
  }

  return (
    <div className="flex flex-1 items-stretch overflow-hidden" data-tauri-drag-region>
      {/* 可滚动的 Tab 列表 */}
      <div className="flex flex-1 items-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
            {tabs.map((tab) => (
              <SortableTabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivate={onActivate}
                onClose={onClose}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* 右侧操作按钮 */}
      <div className="flex shrink-0 items-center border-l border-[var(--border)] px-1 gap-0.5">
        <button
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--ink-secondary)] hover:bg-[var(--paper)] hover:text-[var(--ink)] transition-colors"
          onClick={onNew}
          title="新建 Tab (⌘T)"
        >
          <Plus size={16} />
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--ink-secondary)] hover:bg-[var(--paper)] hover:text-[var(--ink)] transition-colors"
          onClick={onOpenSettings}
          title="设置"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
