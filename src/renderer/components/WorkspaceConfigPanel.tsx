import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import WorkspaceGeneralTab from './WorkspaceGeneralTab';
import SystemPromptsPanel from './SystemPromptsPanel';
import IntroductionPanel from './IntroductionPanel';
import SkillsCommandsTab from './SkillsCommandsTab';
import SkillDetailPanel from './SkillDetailPanel';
import CommandDetailPanel from './CommandDetailPanel';
import AgentDetailPanel from './AgentDetailPanel';

type Tab = 'general' | 'system-prompts' | 'introduction' | 'skills';
type DetailView =
  | { type: 'none' }
  | { type: 'skill'; name: string; scope: 'user' | 'project'; isNew?: boolean }
  | { type: 'command'; name: string; scope: 'user' | 'project'; isNew?: boolean }
  | { type: 'agent'; name: string; scope: 'user' | 'project'; isNew?: boolean };

const TAB_ITEMS: { key: Tab; label: string }[] = [
  { key: 'general', label: '通用' },
  { key: 'system-prompts', label: '系统提示词' },
  { key: 'introduction', label: '使用指南' },
  { key: 'skills', label: '技能 Skills' },
];

interface Props {
  agentDir: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkspaceConfigPanel({ agentDir, isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [detailView, setDetailView] = useState<DetailView>({ type: 'none' });

  const isDetail = detailView.type !== 'none';

  const handleBack = useCallback(() => {
    setDetailView({ type: 'none' });
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setDetailView({ type: 'none' });
  }, []);

  // Escape key handler: detail -> back; list -> close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (isDetail) {
          handleBack();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDetail, handleBack, onClose]);

  // Prevent background scroll
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col bg-[var(--paper)] rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: '90vw', height: '90vh', maxWidth: '64rem' }}
      >
        {/* Header — left (icon+title), tabs, right (close) */}
        <div
          className="flex items-center shrink-0 border-b border-[var(--border)] px-6 py-3"
          style={{ background: 'linear-gradient(to right, var(--surface), var(--paper))' }}
        >
          {/* Left zone: back button / icon + title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {isDetail && (
              <button
                type="button"
                onClick={handleBack}
                className="mr-1 rounded-lg p-1.5 text-[var(--ink-secondary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                title="返回列表"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ink)] shadow">
              <SlidersHorizontal size={16} className="text-white" />
            </div>
            <h2 className="text-[16px] font-semibold text-[var(--ink)]">Agent 设置</h2>
          </div>

          {/* Tab switcher (only in list view) */}
          {!isDetail && (
            <div className="ml-6 flex items-center gap-1">
              {TAB_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleTabChange(item.key)}
                  className={`relative pb-0.5 text-[14px] font-medium transition-colors ${
                    activeTab === item.key
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
                  } ${item.key !== TAB_ITEMS[0].key ? 'ml-4' : ''}`}
                >
                  {item.label}
                  {activeTab === item.key && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-[var(--ink-secondary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
            title="关闭 (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--paper)]">
          {activeTab === 'general' && !isDetail && (
            <WorkspaceGeneralTab agentDir={agentDir} />
          )}
          {activeTab === 'system-prompts' && !isDetail && (
            <SystemPromptsPanel agentDir={agentDir} />
          )}
          {activeTab === 'introduction' && !isDetail && (
            <IntroductionPanel agentDir={agentDir} />
          )}
          {activeTab === 'skills' && detailView.type === 'none' && (
            <div className="h-full overflow-auto p-6">
              <SkillsCommandsTab
                agentDir={agentDir}
                onOpenSkill={(name, scope) => setDetailView({ type: 'skill', name, scope })}
                onOpenCommand={(name, scope) => setDetailView({ type: 'command', name, scope })}
                onOpenAgent={(name, scope) => setDetailView({ type: 'agent', name, scope })}
                onNewSkill={() => setDetailView({ type: 'skill', name: '', scope: 'project', isNew: true })}
                onNewCommand={() => setDetailView({ type: 'command', name: '', scope: 'project', isNew: true })}
                onNewAgent={() => setDetailView({ type: 'agent', name: '', scope: 'project', isNew: true })}
              />
            </div>
          )}
          {detailView.type === 'skill' && (
            <SkillDetailPanel
              name={detailView.name}
              scope={detailView.scope}
              agentDir={agentDir}
              isNew={detailView.isNew}
              onBack={() => setDetailView({ type: 'none' })}
              onDeleted={() => setDetailView({ type: 'none' })}
            />
          )}
          {detailView.type === 'command' && (
            <CommandDetailPanel
              fileName={detailView.name}
              scope={detailView.scope}
              agentDir={agentDir}
              isNew={detailView.isNew}
              onBack={() => setDetailView({ type: 'none' })}
              onDeleted={() => setDetailView({ type: 'none' })}
            />
          )}
          {detailView.type === 'agent' && (
            <AgentDetailPanel
              folderName={detailView.name}
              scope={detailView.scope}
              agentDir={agentDir}
              isNew={detailView.isNew}
              onBack={() => setDetailView({ type: 'none' })}
              onDeleted={() => setDetailView({ type: 'none' })}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-2">
          <p className="text-center text-[12px] text-[var(--ink-tertiary)]">
            按 Esc 关闭 · 配置修改会立即生效
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
