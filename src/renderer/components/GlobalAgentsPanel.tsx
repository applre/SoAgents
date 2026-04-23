// GlobalAgentsPanel — User-level Sub-Agent management for Settings Skills tab
// User-level Sub-Agent management panel
import { Plus, Bot, Loader2, ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useState, useRef } from 'react';
import { globalApiGetJson, globalApiPostJson } from '../api/apiFetch';
import { useToast } from './Toast';
import AgentDetailPanel from './AgentDetailPanel';
import type { AgentDetailPanelRef } from './AgentDetailPanel';
import type { AgentItem } from '../../shared/types/agent';
import { Tag } from './Tag';
type ViewState =
  | { type: 'list' }
  | { type: 'agent-detail'; folderName: string; isNew?: boolean };

export default function GlobalAgentsPanel({ onDetailChange }: { onDetailChange?: (inDetail: boolean) => void }) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [viewState, setViewState] = useState<ViewState>({ type: 'list' });
  const onDetailChangeRef = useRef(onDetailChange);
  onDetailChangeRef.current = onDetailChange;
  useEffect(() => { onDetailChangeRef.current?.(viewState.type !== 'list'); }, [viewState.type]);

  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const agentDetailRef = useRef<AgentDetailPanelRef>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const isAnyEditing = useCallback(() => {
    if (viewState.type === 'agent-detail' && agentDetailRef.current?.isEditing()) {
      return true;
    }
    return false;
  }, [viewState]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const agentsRes = await globalApiGetJson<AgentItem[]>('/api/agents?scope=user');
      if (!isMountedRef.current) return;
      setAgents(agentsRes);
    } catch {
      if (!isMountedRef.current) return;
      toastRef.current.error('加载失败');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const handleBackToList = useCallback(() => {
    if (isAnyEditing()) {
      toastRef.current.warning('请先保存或取消编辑');
      return;
    }
    setViewState({ type: 'list' });
  }, [isAnyEditing]);

  const handleQuickCreateAgent = useCallback(async () => {
    const tempName = `new-agent-${Date.now()}`;
    try {
      const response = await globalApiPostJson<{ success: boolean; error?: string; folderName?: string }>('/api/agent/create', {
        name: tempName,
        scope: 'user',
        description: '',
      });
      if (response.success) {
        setViewState({ type: 'agent-detail', folderName: response.folderName || tempName, isNew: true });
        setRefreshKey((k) => k + 1);
      } else {
        toastRef.current.error(response.error || '创建失败');
      }
    } catch {
      toastRef.current.error('创建失败');
    }
  }, []);

  const handleItemDeleted = useCallback(() => {
    setViewState({ type: 'list' });
    setRefreshKey((k) => k + 1);
  }, []);

  if (loading && viewState.type === 'list') {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ink-tertiary)]" />
      </div>
    );
  }

  // Agent Detail View
  if (viewState.type === 'agent-detail') {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-1 text-sm text-[var(--ink-secondary)] hover:text-[var(--ink)]"
        >
          <ChevronLeft className="h-4 w-4" />
          返回列表
        </button>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] overflow-hidden" style={{ minHeight: '500px' }}>
          <AgentDetailPanel
            ref={agentDetailRef}
            folderName={viewState.folderName}
            scope="user"
            agentDir=""
            isNew={viewState.isNew}
            onBack={handleBackToList}
            onDeleted={handleItemDeleted}
          />
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[var(--ink-tertiary)]" />
          <h3 className="text-base font-semibold text-[var(--ink)]">用户 Agent</h3>
          <span className="text-xs text-[var(--ink-tertiary)]">({agents.length})</span>
        </div>
        <button
          onClick={() => void handleQuickCreateAgent()}
          className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          新建
        </button>
      </div>

      {agents.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {agents.map((agent) => (
            <div
              key={agent.folderName}
              onClick={() => setViewState({ type: 'agent-detail', folderName: agent.folderName })}
              className="group flex cursor-pointer flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:border-[var(--accent)]/40 hover:shadow-sm"
            >
              <div className="mb-2 flex items-center gap-1.5">
                <h4 className="truncate text-[14px] font-medium text-[var(--ink)]">
                  {agent.name}
                </h4>
                <Bot className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              </div>
              <p className="mb-3 line-clamp-2 flex-1 text-[12px] leading-relaxed text-[var(--ink-secondary)]">
                {agent.description || '暂无描述'}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[var(--ink-tertiary)]">
                <Tag variant="scope">
                  {agent.source === 'user' ? '全局' : '项目'}
                </Tag>
                {agent.model && (
                  <Tag variant="scope">{agent.model}</Tag>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border)] py-8 text-center">
          <Bot className="mx-auto h-8 w-8 text-[var(--ink-tertiary)] opacity-30" />
          <p className="mt-2 text-sm text-[var(--ink-tertiary)]">还没有用户 Agent</p>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            Sub-Agent 可以被 AI 自主委派来处理特定任务
          </p>
        </div>
      )}

      <p className="text-center text-xs text-[var(--ink-tertiary)]">
        用户 Agent 存储在 ~/.soagents/agents/ 目录下，对所有项目生效
      </p>
    </div>
  );
}
