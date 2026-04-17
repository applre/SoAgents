/**
 * IntroductionPanel — Manages INTRODUCTION.md for workspace welcome content.
 * Three states: file not found (create CTA), preview, editing.
 * Uses Tauri FS plugin — no Sidecar dependency.
 */
import { Save, Pencil, X, FileText, Loader2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Markdown from './Markdown';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from './Toast';

interface Props {
  agentDir: string;
}

const FILENAME = 'INTRODUCTION.md';

export default function IntroductionPanel({ agentDir }: Props) {
  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [fileExists, setFileExists] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const filePath = useMemo(() => `${agentDir}/${FILENAME}`, [agentDir]);

  // Load file content
  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
      if (await exists(filePath)) {
        const text = await readTextFile(filePath);
        if (!isMountedRef.current) return;
        setContent(text);
        setEditContent(text);
        setFileExists(true);
      } else {
        if (!isMountedRef.current) return;
        setContent('');
        setEditContent('');
        setFileExists(false);
      }
    } catch {
      if (!isMountedRef.current) return;
      setContent('');
      setEditContent('');
      setFileExists(false);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [filePath]);

  useEffect(() => { void loadContent(); }, [loadContent]);

  const handleEdit = useCallback(() => {
    setEditContent(content);
    setIsEditing(true);
  }, [content]);

  const handleCancel = useCallback(() => {
    setEditContent(content);
    setIsEditing(false);
  }, [content]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(filePath, editContent);
      if (!isMountedRef.current) return;
      setContent(editContent);
      setFileExists(true);
      setIsEditing(false);
      toastRef.current.success('使用指南保存成功');
    } catch {
      if (!isMountedRef.current) return;
      toastRef.current.error('保存失败');
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [editContent, filePath]);

  const handleCreate = useCallback(() => {
    const template = '# Agent 名称\n\n在这里编写使用指南，用户打开新对话时将看到此内容。\n';
    setEditContent(template);
    setIsEditing(true);
  }, []);

  const handleDelete = useCallback(async () => {
    try {
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(filePath);
      if (!isMountedRef.current) return;
      setContent('');
      setEditContent('');
      setFileExists(false);
      setIsEditing(false);
      setDeleteConfirm(false);
      toastRef.current.success('使用指南已删除');
    } catch {
      if (!isMountedRef.current) return;
      toastRef.current.error('删除失败');
      setDeleteConfirm(false);
    }
  }, [filePath]);

  return (
    <div className="flex h-full flex-col">
      {/* Action Bar */}
      {!loading && (fileExists || isEditing) && (
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/30 px-6 py-2">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[var(--accent)]" />
            <span className="text-[14px] font-medium text-[var(--ink)]">{FILENAME}</span>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                >
                  <Trash2 size={14} />
                  删除
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)]"
                >
                  <X size={14} />
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSave(); }}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  保存
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                >
                  <Trash2 size={14} />
                  删除
                </button>
                <button
                  type="button"
                  onClick={handleEdit}
                  className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:opacity-90"
                >
                  <Pencil size={14} />
                  编辑
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={32} className="animate-spin text-[var(--ink-tertiary)]" />
          </div>
        ) : !fileExists && !isEditing ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
            <FileText size={64} className="text-[var(--ink-tertiary)] opacity-30" />
            <div className="text-center">
              <p className="text-[14px] font-medium text-[var(--ink-secondary)]">
                暂无使用指南
              </p>
              <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">
                创建 INTRODUCTION.md 为你的 Agent 编写使用说明，用户打开新对话时将看到此内容
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition-colors hover:opacity-90"
            >
              <Pencil size={16} />
              创建使用指南
            </button>
          </div>
        ) : isEditing ? (
          <div className="flex h-full flex-col">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 w-full resize-none bg-transparent px-6 py-4 text-[14px] leading-relaxed text-[var(--ink)] outline-none"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="h-full overflow-auto p-6">
            {content.trim() ? (
              <Markdown>{content}</Markdown>
            ) : (
              <span className="text-[14px] text-[var(--ink-tertiary)] opacity-60">
                （无内容）
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          title="删除使用指南"
          message="确定删除使用指南？删除后，用户打开新对话时将不再看到使用指南内容。文件 INTRODUCTION.md 将从工作区中移除。"
          confirmText="删除"
          danger
          onConfirm={() => { void handleDelete(); }}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
