import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Pencil, Save, X, Trash2, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { globalApiGetJson, globalApiPostJson, globalApiPutJson, globalApiDeleteJson } from '../api/apiFetch';
import Markdown from './Markdown';
import { useToast } from './Toast';
import CustomSelect from './CustomSelect';

// ── Types ──

interface AgentFrontmatter {
  name: string;
  description?: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  tools?: string;
  disallowedTools?: string;
  permissionMode?: string;
  skills?: string[];
  maxTurns?: number;
}

interface AgentDetail {
  name: string;
  folderName: string;
  description: string;
  model?: string;
  source: 'user' | 'project';
  enabled: boolean;
  body: string;
  rawContent: string;
  path: string;
  frontmatter: AgentFrontmatter;
}

export interface AgentDetailPanelRef {
  isEditing: () => boolean;
}

interface Props {
  folderName: string;   // agent folderName (empty if isNew)
  scope: 'user' | 'project';
  agentDir: string;
  isNew?: boolean;
  onBack: () => void;
  onDeleted: () => void;
}

// ── Constants ──

const MODEL_OPTIONS = [
  { value: 'inherit', label: '继承（跟随主模型）' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
  { value: 'haiku', label: 'Haiku' },
];

// ── Sub-components ──

function ScopeBadge({ source }: { source: 'user' | 'project' }) {
  if (source === 'project') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--accent)] text-white">
        项目
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--hover)] text-[var(--ink-secondary)]">
      全局
    </span>
  );
}

function ModelBadge({ model }: { model?: string }) {
  if (!model || model === 'inherit') return null;
  const label = MODEL_OPTIONS.find(o => o.value === model)?.label ?? model;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--surface)] text-[var(--ink-secondary)] border border-[var(--border)]">
      {label}
    </span>
  );
}

// ── Component ──

const AgentDetailPanel = forwardRef<AgentDetailPanelRef, Props>(
  function AgentDetailPanel({ folderName, scope, agentDir, isNew = false, onBack, onDeleted }, ref) {
    const toast = useToast();

    // View state
    const [isEditMode, setIsEditMode] = useState(isNew);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);

    // Loaded data
    const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);

    // Edit form fields (basic)
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editModel, setEditModel] = useState('inherit');
    const [editBody, setEditBody] = useState('');

    // Advanced fields
    const [editTools, setEditTools] = useState('');
    const [editDisallowedTools, setEditDisallowedTools] = useState('');
    const [editSkills, setEditSkills] = useState('');
    const [editMaxTurns, setEditMaxTurns] = useState('');

    // Expose isEditing via ref
    useImperativeHandle(ref, () => ({
      isEditing: () => isEditMode,
    }), [isEditMode]);

    // ── Populate form from AgentDetail ──
    const populateForm = useCallback((data: AgentDetail) => {
      setEditName(data.name);
      setEditDescription(data.description ?? '');
      setEditModel(data.frontmatter.model ?? 'inherit');
      setEditBody(data.body ?? '');
      setEditTools(data.frontmatter.tools ?? '');
      setEditDisallowedTools(data.frontmatter.disallowedTools ?? '');
      setEditSkills(Array.isArray(data.frontmatter.skills) ? data.frontmatter.skills.join(', ') : '');
      setEditMaxTurns(data.frontmatter.maxTurns != null ? String(data.frontmatter.maxTurns) : '');
    }, []);

    // ── Load agent data ──
    const loadAgent = useCallback(async () => {
      if (!folderName) return;
      setLoading(true);
      try {
        const data = await globalApiGetJson<AgentDetail>(
          `/api/agent/${encodeURIComponent(folderName)}?scope=${scope}&agentDir=${encodeURIComponent(agentDir)}`
        );
        setAgentDetail(data);
        populateForm(data);
      } catch {
        toast.error('加载 Agent 失败');
      } finally {
        setLoading(false);
      }
    }, [folderName, scope, agentDir, toast, populateForm]);

    // ── Initial load ──
    useEffect(() => {
      if (!isNew && folderName) {
        loadAgent();
      }
    }, [isNew, folderName, loadAgent]);

    // ── Enter edit mode ──
    const handleEdit = useCallback(() => {
      if (agentDetail) {
        populateForm(agentDetail);
      }
      setIsEditMode(true);
    }, [agentDetail, populateForm]);

    // ── Cancel edit ──
    const handleCancel = useCallback(() => {
      if (isNew) {
        onBack();
        return;
      }
      if (agentDetail) {
        populateForm(agentDetail);
      }
      setIsEditMode(false);
    }, [isNew, onBack, agentDetail, populateForm]);

    // ── Save ──
    const handleSave = useCallback(async () => {
      const trimmedName = editName.trim();
      if (!trimmedName) {
        toast.warning('Agent 名称不能为空');
        return;
      }

      setSaving(true);
      try {
        const maxTurnsParsed = editMaxTurns.trim() ? parseInt(editMaxTurns.trim(), 10) : undefined;

        if (isNew) {
          await globalApiPostJson('/api/agent/create', {
            name: trimmedName,
            description: editDescription.trim() || undefined,
            model: editModel !== 'inherit' ? editModel : undefined,
            body: editBody,
            scope,
            agentDir,
          });
          toast.success('Agent 已创建');
          // Reload to get full data, then switch to preview
          const data = await globalApiGetJson<AgentDetail>(
            `/api/agent/${encodeURIComponent(trimmedName)}?scope=${scope}&agentDir=${encodeURIComponent(agentDir)}`
          );
          setAgentDetail(data);
          populateForm(data);
          setIsEditMode(false);
        } else {
          await globalApiPutJson(`/api/agent/${encodeURIComponent(folderName)}`, {
            name: trimmedName,
            description: editDescription.trim(),
            model: editModel,
            body: editBody,
            scope,
            agentDir,
            tools: editTools.trim() || undefined,
            disallowedTools: editDisallowedTools.trim() || undefined,
            skills: editSkills.trim()
              ? editSkills.split(',').map(s => s.trim()).filter(Boolean)
              : undefined,
            maxTurns: maxTurnsParsed,
            newFolderName: trimmedName !== agentDetail?.name ? trimmedName : undefined,
          });
          toast.success('已保存');
          // Reload fresh data
          const reloadName = trimmedName !== agentDetail?.name ? trimmedName : folderName;
          const data = await globalApiGetJson<AgentDetail>(
            `/api/agent/${encodeURIComponent(reloadName)}?scope=${scope}&agentDir=${encodeURIComponent(agentDir)}`
          );
          setAgentDetail(data);
          populateForm(data);
          setIsEditMode(false);
        }
      } catch {
        toast.error('保存失败');
      } finally {
        setSaving(false);
      }
    }, [
      editName, editDescription, editModel, editBody,
      editTools, editDisallowedTools, editSkills, editMaxTurns,
      scope, agentDir, isNew, folderName, agentDetail, toast, populateForm,
    ]);

    // ── Delete ──
    const handleDelete = useCallback(async () => {
      const targetFolder = agentDetail?.folderName ?? folderName;
      if (!targetFolder) return;

      setDeleting(true);
      try {
        await globalApiDeleteJson(
          `/api/agent/${encodeURIComponent(targetFolder)}?scope=${scope}&agentDir=${encodeURIComponent(agentDir)}`
        );
        toast.success('Agent 已删除');
        onDeleted();
      } catch {
        toast.error('删除失败');
        setDeleting(false);
      }
    }, [agentDetail, folderName, scope, agentDir, toast, onDeleted]);

    // ── Render: Loading ──
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-[14px] text-[var(--ink-tertiary)]">
          加载中...
        </div>
      );
    }

    // ── Render: Edit mode ──
    if (isEditMode) {
      return (
        <div className="flex flex-col h-full">
          {/* Basic form fields */}
          <div className="flex flex-col gap-4 px-6 pt-6 pb-4 border-b border-[var(--border)]">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
                名称 *
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="agent-name"
                className="px-3 py-2 text-[14px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)]"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
                描述
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="一句话描述这个 Agent 的功能..."
                rows={2}
                className="px-3 py-2 text-[14px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)] resize-none"
              />
            </div>

            {/* Model */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
                模型
              </label>
              <CustomSelect
                value={editModel}
                options={MODEL_OPTIONS}
                onChange={setEditModel}
                className="w-full"
              />
            </div>
          </div>

          {/* System prompt textarea - fills remaining space */}
          <div className="flex flex-col flex-1 min-h-0 px-6 pt-4">
            <label className="text-[12px] font-medium text-[var(--ink-secondary)] uppercase tracking-wide mb-1.5">
              系统提示词
            </label>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="在这里写 Agent 的系统提示词..."
              className="flex-1 w-full resize-none bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)]"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
              spellCheck={false}
            />
          </div>

          {/* Advanced settings (collapsible) */}
          <div className="px-6 pt-3 pb-0">
            <button
              type="button"
              onClick={() => setAdvancedOpen(v => !v)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors"
            >
              {advancedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              高级设置
            </button>

            {advancedOpen && (
              <div className="flex flex-col gap-3 mt-3 pb-2">
                {/* Tools */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--ink-tertiary)] uppercase tracking-wide">
                    允许工具 (逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={editTools}
                    onChange={(e) => setEditTools(e.target.value)}
                    placeholder="Bash, Read, Write, ..."
                    className="px-3 py-1.5 text-[13px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)]"
                  />
                </div>

                {/* Disallowed Tools */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--ink-tertiary)] uppercase tracking-wide">
                    禁止工具 (逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={editDisallowedTools}
                    onChange={(e) => setEditDisallowedTools(e.target.value)}
                    placeholder="Bash, ..."
                    className="px-3 py-1.5 text-[13px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)]"
                  />
                </div>

                {/* Skills */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--ink-tertiary)] uppercase tracking-wide">
                    关联技能 (逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={editSkills}
                    onChange={(e) => setEditSkills(e.target.value)}
                    placeholder="skill-name-1, skill-name-2, ..."
                    className="px-3 py-1.5 text-[13px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)]"
                  />
                </div>

                {/* Max Turns */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--ink-tertiary)] uppercase tracking-wide">
                    最大轮次 (maxTurns)
                  </label>
                  <input
                    type="number"
                    value={editMaxTurns}
                    onChange={(e) => setEditMaxTurns(e.target.value)}
                    placeholder="默认不限制"
                    min={1}
                    className="px-3 py-1.5 text-[13px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)] w-40"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] mt-4">
            {/* Delete button (only for existing agents) */}
            <div>
              {!isNew && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg text-[var(--error)] border border-[var(--error)]/30 hover:bg-[var(--error)]/8 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {deleting ? '删除中...' : '删除'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
              >
                <X size={14} />
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Render: Preview mode ──
    const info = agentDetail;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--border)]">
          <div className="flex flex-col gap-2 flex-1 min-w-0 mr-4">
            <h2 className="text-[18px] font-semibold text-[var(--ink)] truncate">
              {info?.name ?? folderName}
            </h2>
            {info?.description && (
              <p className="text-[14px] text-[var(--ink-secondary)] leading-relaxed">
                {info.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <ScopeBadge source={info?.source ?? scope} />
              <ModelBadge model={info?.frontmatter?.model} />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium rounded-md bg-[var(--hover)] text-[var(--ink)]"
            >
              <Eye size={12} />
              预览
            </button>
            <button
              type="button"
              onClick={handleEdit}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
            >
              <Pencil size={12} />
              编辑
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {info?.body ? (
            <Markdown>{info.body}</Markdown>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--ink-tertiary)] text-[13px] gap-2">
              <span>暂无系统提示词</span>
              <button
                type="button"
                onClick={handleEdit}
                className="text-[var(--accent)] hover:underline text-[13px]"
              >
                开始编辑
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default AgentDetailPanel;
