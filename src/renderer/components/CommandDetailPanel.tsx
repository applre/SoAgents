import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Pencil, Save, X, Trash2, Eye } from 'lucide-react';
import { globalApiGetJson, globalApiPostJson, globalApiPutJson, globalApiDeleteJson } from '../api/apiFetch';
import Markdown from './Markdown';
import { useToast } from './Toast';

// ── Types ──

interface CommandDetail {
  name: string;
  fileName: string;
  description: string;
  source: 'user' | 'project';
  body: string;
  rawContent: string;
  path: string;
  author?: string;
}

export interface CommandDetailPanelRef {
  isEditing: () => boolean;
}

interface Props {
  fileName: string;       // command fileName (empty if isNew)
  scope: 'user' | 'project';
  agentDir: string;
  isNew?: boolean;        // start in edit mode, POST on save
  onBack: () => void;
  onDeleted: () => void;
}

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

// ── Component ──

const CommandDetailPanel = forwardRef<CommandDetailPanelRef, Props>(
  function CommandDetailPanel({ fileName, scope, agentDir, isNew = false, onBack, onDeleted }, ref) {
    const toast = useToast();

    // View state
    const [isEditMode, setIsEditMode] = useState(isNew);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Loaded data
    const [commandDetail, setCommandDetail] = useState<CommandDetail | null>(null);

    // Edit form fields
    const [editName, setEditName] = useState(
      isNew ? '' : fileName.replace(/\.md$/i, '')
    );
    const [editDescription, setEditDescription] = useState('');
    const [editBody, setEditBody] = useState('');

    // Original name for rename detection
    const [originalName, setOriginalName] = useState(
      isNew ? '' : fileName.replace(/\.md$/i, '')
    );

    // Expose isEditing via ref
    useImperativeHandle(ref, () => ({
      isEditing: () => isEditMode,
    }), [isEditMode]);

    // ── Load command data ──
    const loadCommand = useCallback(async () => {
      if (!fileName) return;
      setLoading(true);
      try {
        const data = await globalApiGetJson<CommandDetail>(
          `/api/command-item/${encodeURIComponent(fileName)}?scope=${scope}&agentDir=${encodeURIComponent(agentDir)}`
        );
        setCommandDetail(data);
        const nameWithoutExt = data.name.replace(/\.md$/i, '');
        setEditName(nameWithoutExt);
        setOriginalName(nameWithoutExt);
        setEditDescription(data.description ?? '');
        setEditBody(data.body ?? '');
      } catch {
        toast.error('加载指令失败');
      } finally {
        setLoading(false);
      }
    }, [fileName, scope, agentDir, toast]);

    // ── Initial load ──
    useEffect(() => {
      if (!isNew && fileName) {
        loadCommand();
      }
    }, [isNew, fileName, loadCommand]);

    // ── Enter edit mode ──
    const handleEdit = useCallback(() => {
      if (commandDetail) {
        const nameWithoutExt = commandDetail.name.replace(/\.md$/i, '');
        setEditName(nameWithoutExt);
        setOriginalName(nameWithoutExt);
        setEditDescription(commandDetail.description ?? '');
        setEditBody(commandDetail.body ?? '');
      }
      setIsEditMode(true);
    }, [commandDetail]);

    // ── Cancel edit ──
    const handleCancel = useCallback(() => {
      if (isNew) {
        onBack();
        return;
      }
      // Revert to loaded data
      if (commandDetail) {
        const nameWithoutExt = commandDetail.name.replace(/\.md$/i, '');
        setEditName(nameWithoutExt);
        setOriginalName(nameWithoutExt);
        setEditDescription(commandDetail.description ?? '');
        setEditBody(commandDetail.body ?? '');
      }
      setIsEditMode(false);
    }, [isNew, onBack, commandDetail]);

    // ── Save ──
    const handleSave = useCallback(async () => {
      const trimmedName = editName.trim();
      if (!trimmedName) {
        toast.warning('指令名称不能为空');
        return;
      }

      setSaving(true);
      try {
        if (isNew) {
          await globalApiPostJson('/api/command-item/create', {
            name: trimmedName,
            description: editDescription.trim() || undefined,
            body: editBody,
            scope,
            agentDir,
          });
          toast.success('指令已创建');
          // Load the created command
          const newFileName = `${trimmedName}.md`;
          const data = await globalApiGetJson<CommandDetail>(
            `/api/command-item/${encodeURIComponent(newFileName)}?scope=${scope}&agentDir=${encodeURIComponent(agentDir)}`
          );
          setCommandDetail(data);
          const nameWithoutExt = data.name.replace(/\.md$/i, '');
          setEditName(nameWithoutExt);
          setOriginalName(nameWithoutExt);
          setEditDescription(data.description ?? '');
          setEditBody(data.body ?? '');
          setIsEditMode(false);
        } else {
          // Detect rename
          const nameChanged = trimmedName !== originalName;
          const newFileName = nameChanged ? `${trimmedName}.md` : undefined;

          await globalApiPutJson(`/api/command-item/${encodeURIComponent(fileName)}`, {
            name: trimmedName,
            description: editDescription.trim() || undefined,
            body: editBody,
            scope,
            agentDir,
            ...(newFileName ? { newFileName } : {}),
          });
          toast.success('已保存');
          // Reload from the (possibly renamed) file
          const targetFileName = newFileName ?? fileName;
          const data = await globalApiGetJson<CommandDetail>(
            `/api/command-item/${encodeURIComponent(targetFileName)}?scope=${scope}&agentDir=${encodeURIComponent(agentDir)}`
          );
          setCommandDetail(data);
          const nameWithoutExt = data.name.replace(/\.md$/i, '');
          setEditName(nameWithoutExt);
          setOriginalName(nameWithoutExt);
          setEditDescription(data.description ?? '');
          setEditBody(data.body ?? '');
          setIsEditMode(false);
        }
      } catch {
        toast.error('保存失败');
      } finally {
        setSaving(false);
      }
    }, [editName, editDescription, editBody, scope, agentDir, isNew, fileName, originalName, toast]);

    // ── Delete ──
    const handleDelete = useCallback(async () => {
      const targetFileName = commandDetail?.fileName ?? fileName;
      if (!targetFileName) return;

      setDeleting(true);
      try {
        await globalApiDeleteJson(
          `/api/command-item/${encodeURIComponent(targetFileName)}?scope=${scope}&agentDir=${encodeURIComponent(agentDir)}`
        );
        toast.success('指令已删除');
        onDeleted();
      } catch {
        toast.error('删除失败');
        setDeleting(false);
      }
    }, [commandDetail, fileName, scope, agentDir, toast, onDeleted]);

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
      const nameChanged = editName.trim() !== originalName && !isNew;

      return (
        <div className="flex flex-col h-full -m-6" style={{ height: 'calc(100% + 48px)' }}>
          {/* Form fields */}
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
                placeholder="command-name"
                className="px-3 py-2 text-[14px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)]"
              />
              {nameChanged && (
                <p className="text-[12px] text-[var(--ink-tertiary)]">
                  将重命名文件为 <span className="font-medium text-[var(--ink-secondary)]">{editName.trim()}.md</span>
                </p>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
                描述
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="一句话描述这个指令的功能..."
                rows={2}
                className="px-3 py-2 text-[14px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)] resize-none"
              />
            </div>
          </div>

          {/* Body textarea - fills remaining space */}
          <div className="flex flex-col flex-1 min-h-0 px-6 pt-4 pb-0">
            <label className="text-[12px] font-medium text-[var(--ink-secondary)] uppercase tracking-wide mb-1.5">
              内容 (Markdown)
            </label>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="在这里写指令的 Markdown 内容..."
              className="flex-1 w-full resize-none bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--ink-tertiary)]"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
              spellCheck={false}
            />
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] mt-4">
            {/* Delete button (only for existing commands) */}
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
    const info = commandDetail;

    return (
      <div className="flex flex-col h-full -m-6" style={{ height: 'calc(100% + 48px)' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--border)]">
          <div className="flex flex-col gap-2 flex-1 min-w-0 mr-4">
            <h2 className="text-[18px] font-semibold text-[var(--ink)] truncate">
              {info?.name ?? fileName}
            </h2>
            {info?.description && (
              <p className="text-[14px] text-[var(--ink-secondary)] leading-relaxed">
                {info.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <ScopeBadge source={info?.source ?? scope} />
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
              <span>暂无内容</span>
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

export default CommandDetailPanel;
