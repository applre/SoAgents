import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft } from 'lucide-react';
import WorkspaceGeneralTab from './WorkspaceGeneralTab';

type Tab = 'general' | 'system-prompts' | 'skills';
type DetailView =
  | { type: 'none' }
  | { type: 'skill'; name: string; scope: 'user' | 'project'; isNew?: boolean }
  | { type: 'command'; name: string; scope: 'user' | 'project'; isNew?: boolean }
  | { type: 'agent'; name: string; scope: 'user' | 'project'; isNew?: boolean };

const TAB_ITEMS: { key: Tab; label: string }[] = [
  { key: 'general', label: '通用' },
  { key: 'system-prompts', label: '系统提示词' },
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          {/* Left region */}
          <div className="w-[120px] flex items-center">
            {isDetail && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1 text-[13px] text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors rounded-lg px-2 py-1 hover:bg-[var(--hover)]"
              >
                <ChevronLeft size={14} />
                <span>返回</span>
              </button>
            )}
          </div>

          {/* Center: Tab switcher (hidden in detail view) */}
          <div className="flex items-center gap-1">
            {!isDetail &&
              TAB_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleTabChange(item.key)}
                  className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                    activeTab === item.key
                      ? 'bg-[var(--hover)] text-[var(--ink)]'
                      : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
          </div>

          {/* Right region */}
          <div className="w-[120px] flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <WorkspaceGeneralTab agentDir={agentDir} />
          )}
          {activeTab === 'system-prompts' && (
            <div className="text-[14px] text-[var(--ink-secondary)]">
              系统提示词配置（即将实现）
            </div>
          )}
          {activeTab === 'skills' && (
            <div className="text-[14px] text-[var(--ink-secondary)]">
              技能管理（即将实现）
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
