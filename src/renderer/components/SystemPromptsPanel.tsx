import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { FileText, Plus, FileEdit, Trash2, Eye, Pencil, Save, X } from 'lucide-react';
import { globalApiGetJson, globalApiPostJson, globalApiPutJson, globalApiDeleteJson } from '../api/apiFetch';
import Markdown from './Markdown';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import { useToast } from './Toast';

// ── Types ──

type FileEntry = { type: 'claude-md' } | { type: 'rule'; filename: string };

export interface SystemPromptsPanelRef {
  isEditing: () => boolean;
}

interface Props {
  agentDir: string;
}

// ── Helpers ──

function fileEntryKey(entry: FileEntry): string {
  return entry.type === 'claude-md' ? '__claude_md__' : entry.filename;
}

function fileEntryLabel(entry: FileEntry): string {
  return entry.type === 'claude-md' ? 'CLAUDE.md' : entry.filename;
}

function fileEntryPath(entry: FileEntry): string {
  return entry.type === 'claude-md'
    ? '.claude/CLAUDE.md'
    : `.claude/rules/${entry.filename}`;
}

// ── Component ──

const SystemPromptsPanel = forwardRef<SystemPromptsPanelRef, Props>(
  function SystemPromptsPanel({ agentDir }, ref) {
    const toast = useToast();

    // File list state
    const [ruleFiles, setRuleFiles] = useState<string[]>([]);
    const [selected, setSelected] = useState<FileEntry>({ type: 'claude-md' });

    // Editor state
    const [content, setContent] = useState('');
    const [editContent, setEditContent] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);
    const [loading, setLoading] = useState(false);

    // New file inline input
    const [isAddingFile, setIsAddingFile] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const newFileInputRef = useRef<HTMLInputElement>(null);

    // Rename inline input
    const [renamingFile, setRenamingFile] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Context menu
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; filename: string } | null>(null);

    // Race condition protection
    const loadRequestIdRef = useRef(0);
    // Guard against onBlur+Enter double-trigger on inline inputs
    const addSubmittedRef = useRef(false);
    const renameSubmittedRef = useRef(false);

    // Expose isEditing
    useImperativeHandle(ref, () => ({
      isEditing: () => isEditMode,
    }), [isEditMode]);

    // ── Load file list ──
    const loadFileList = useCallback(async () => {
      try {
        const data = await globalApiGetJson<{ files: string[] }>(
          `/api/rules?agentDir=${encodeURIComponent(agentDir)}`
        );
        setRuleFiles(data.files);
      } catch {
        // Silently fail - list stays as-is
      }
    }, [agentDir]);

    // ── Load file content ──
    const loadContent = useCallback(async (entry: FileEntry) => {
      const requestId = ++loadRequestIdRef.current;
      setLoading(true);

      try {
        let data: { content: string };
        if (entry.type === 'claude-md') {
          data = await globalApiGetJson<{ content: string }>(
            `/api/claude-md?agentDir=${encodeURIComponent(agentDir)}`
          );
        } else {
          data = await globalApiGetJson<{ content: string }>(
            `/api/rules/${encodeURIComponent(entry.filename)}?agentDir=${encodeURIComponent(agentDir)}`
          );
        }
        // Race condition check
        if (loadRequestIdRef.current !== requestId) return;
        setContent(data.content);
        setEditContent(data.content);
        setIsEditMode(false);
      } catch {
        if (loadRequestIdRef.current !== requestId) return;
        setContent('');
        setEditContent('');
      } finally {
        if (loadRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, [agentDir]);

    // ── Initial load ──
    useEffect(() => {
      loadFileList();
      loadContent({ type: 'claude-md' });
      setSelected({ type: 'claude-md' });
    }, [agentDir, loadFileList, loadContent]);

    // ── Select file ──
    const handleSelect = useCallback((entry: FileEntry) => {
      if (isEditMode) {
        toast.warning('有未保存的编辑');
        return;
      }
      setSelected(entry);
      loadContent(entry);
    }, [isEditMode, loadContent, toast]);

    // ── Save ──
    const handleSave = useCallback(async () => {
      try {
        if (selected.type === 'claude-md') {
          await globalApiPostJson('/api/claude-md', { agentDir, content: editContent });
        } else {
          await globalApiPutJson(
            `/api/rules/${encodeURIComponent(selected.filename)}`,
            { agentDir, content: editContent }
          );
        }
        setContent(editContent);
        setIsEditMode(false);
        toast.success('已保存');
      } catch {
        toast.error('保存失败');
      }
    }, [selected, agentDir, editContent, toast]);

    // ── Cancel edit ──
    const handleCancel = useCallback(() => {
      setEditContent(content);
      setIsEditMode(false);
    }, [content]);

    // ── Add new rule file ──
    const handleAddFile = useCallback(() => {
      setIsAddingFile(true);
      setNewFileName('');
      setTimeout(() => newFileInputRef.current?.focus(), 0);
    }, []);

    const handleConfirmAdd = useCallback(async () => {
      if (addSubmittedRef.current) return;
      let name = newFileName.trim();
      if (!name) {
        setIsAddingFile(false);
        return;
      }
      if (!name.endsWith('.md')) {
        name += '.md';
      }
      if (ruleFiles.includes(name)) {
        toast.warning('文件已存在');
        return;
      }
      addSubmittedRef.current = true;
      try {
        await globalApiPostJson('/api/rules', { agentDir, filename: name, content: '' });
        setIsAddingFile(false);
        setNewFileName('');
        await loadFileList();
        const newEntry: FileEntry = { type: 'rule', filename: name };
        setSelected(newEntry);
        loadContent(newEntry);
      } catch {
        toast.error('创建失败');
      } finally {
        addSubmittedRef.current = false;
      }
    }, [newFileName, ruleFiles, agentDir, loadFileList, loadContent, toast]);

    const handleCancelAdd = useCallback(() => {
      setIsAddingFile(false);
      setNewFileName('');
    }, []);

    // ── Delete rule ──
    const handleDelete = useCallback(async (filename: string) => {
      try {
        await globalApiDeleteJson(`/api/rules/${encodeURIComponent(filename)}?agentDir=${encodeURIComponent(agentDir)}`);
        toast.success('已删除');
        await loadFileList();
        // If deleted file was selected, switch to CLAUDE.md
        if (selected.type === 'rule' && selected.filename === filename) {
          const entry: FileEntry = { type: 'claude-md' };
          setSelected(entry);
          loadContent(entry);
        }
      } catch {
        toast.error('删除失败');
      }
    }, [agentDir, selected, loadFileList, loadContent, toast]);

    // ── Rename rule ──
    const handleStartRename = useCallback((filename: string) => {
      setRenamingFile(filename);
      setRenameValue(filename);
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }, []);

    const handleConfirmRename = useCallback(async () => {
      if (renameSubmittedRef.current) return;
      if (!renamingFile) return;
      let newName = renameValue.trim();
      if (!newName || newName === renamingFile) {
        setRenamingFile(null);
        return;
      }
      if (!newName.endsWith('.md')) {
        newName += '.md';
      }
      if (ruleFiles.includes(newName)) {
        toast.warning('文件名已存在');
        return;
      }
      renameSubmittedRef.current = true;
      try {
        await globalApiPutJson(
          `/api/rules/${encodeURIComponent(renamingFile)}/rename`,
          { agentDir, newFilename: newName }
        );
        toast.success('已重命名');
        setRenamingFile(null);
        await loadFileList();
        if (selected.type === 'rule' && selected.filename === renamingFile) {
          const entry: FileEntry = { type: 'rule', filename: newName };
          setSelected(entry);
          loadContent(entry);
        }
      } catch {
        toast.error('重命名失败');
      } finally {
        renameSubmittedRef.current = false;
      }
    }, [renamingFile, renameValue, ruleFiles, agentDir, selected, loadFileList, loadContent, toast]);

    const handleCancelRename = useCallback(() => {
      setRenamingFile(null);
    }, []);

    // ── Context menu items ──
    const contextMenuItems: ContextMenuItem[] = contextMenu
      ? [
          {
            label: '重命名',
            icon: <FileEdit size={14} />,
            onClick: () => handleStartRename(contextMenu.filename),
          },
          { separator: true as const },
          {
            label: '删除',
            icon: <Trash2 size={14} />,
            danger: true,
            onClick: () => handleDelete(contextMenu.filename),
          },
        ]
      : [];

    // ── Build file entries ──
    const allEntries: FileEntry[] = [
      { type: 'claude-md' },
      ...ruleFiles.map((f): FileEntry => ({ type: 'rule', filename: f })),
    ];

    return (
      <div className="flex h-full -m-6" style={{ height: 'calc(100% + 48px)' }}>
        {/* Left: File list */}
        <div
          className="flex flex-col border-r border-[var(--border)] bg-[var(--surface)]/50"
          style={{ width: 280, minWidth: 280 }}
        >
          <div className="px-3 py-2.5 text-[12px] font-medium text-[var(--ink-tertiary)] uppercase tracking-wide">
            文件列表
          </div>
          <div className="flex-1 overflow-y-auto px-1.5">
            {allEntries.map((entry) => {
              const key = fileEntryKey(entry);
              const isSelected = fileEntryKey(selected) === key;
              const isRule = entry.type === 'rule';
              const isRenaming = isRule && renamingFile === entry.filename;

              return (
                <div key={key}>
                  {isRenaming ? (
                    <div className="flex items-center gap-1 px-2 py-1.5 mx-0.5 rounded-lg">
                      <FileText size={14} className="text-[var(--ink-tertiary)] flex-shrink-0" />
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmRename();
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                        onBlur={handleConfirmRename}
                        className="flex-1 min-w-0 px-1.5 py-0.5 text-[13px] rounded bg-[var(--paper)] border border-[var(--accent)] outline-none text-[var(--ink)]"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelect(entry)}
                      onContextMenu={(e) => {
                        if (isRule) {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, filename: entry.filename });
                        }
                      }}
                      className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 mx-0.5 rounded-lg text-[13px] transition-colors ${
                        isSelected
                          ? 'bg-[var(--hover)] text-[var(--ink)] font-medium'
                          : 'text-[var(--ink-secondary)] hover:bg-[var(--hover)]/60 hover:text-[var(--ink)]'
                      }`}
                    >
                      <FileText size={14} className="text-[var(--ink-tertiary)] flex-shrink-0" />
                      <span className="truncate">{fileEntryLabel(entry)}</span>
                    </button>
                  )}
                </div>
              );
            })}

            {/* New file inline input */}
            {isAddingFile && (
              <div className="flex items-center gap-1 px-2 py-1.5 mx-0.5 rounded-lg">
                <FileText size={14} className="text-[var(--ink-tertiary)] flex-shrink-0" />
                <input
                  ref={newFileInputRef}
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmAdd();
                    if (e.key === 'Escape') handleCancelAdd();
                  }}
                  onBlur={handleConfirmAdd}
                  placeholder="filename.md"
                  className="flex-1 min-w-0 px-1.5 py-0.5 text-[13px] rounded bg-[var(--paper)] border border-[var(--accent)] outline-none text-[var(--ink)] placeholder:text-[var(--ink-tertiary)]"
                />
              </div>
            )}
          </div>

          {/* Add button */}
          <div className="px-2 py-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={handleAddFile}
              disabled={isAddingFile}
              className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-[13px] text-[var(--accent)] hover:bg-[var(--hover)] rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus size={14} />
              <span>添加规则文件</span>
            </button>
          </div>
        </div>

        {/* Right: Editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
            <span className="text-[12px] text-[var(--ink-tertiary)] font-mono truncate">
              {fileEntryPath(selected)}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {!isEditMode ? (
                <>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-2 py-1 text-[12px] font-medium rounded-md bg-[var(--hover)] text-[var(--ink)]"
                  >
                    <Eye size={12} />
                    预览
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditContent(content);
                      setIsEditMode(true);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[12px] font-medium rounded-md text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
                  >
                    <Pencil size={12} />
                    编辑
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (editContent !== content) {
                        toast.warning('有未保存的编辑，请先保存或取消');
                        return;
                      }
                      setIsEditMode(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[12px] font-medium rounded-md text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
                  >
                    <Eye size={12} />
                    预览
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-2 py-1 text-[12px] font-medium rounded-md bg-[var(--hover)] text-[var(--ink)]"
                  >
                    <Pencil size={12} />
                    编辑
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full text-[var(--ink-tertiary)] text-[13px]">
                加载中...
              </div>
            ) : isEditMode ? (
              <div className="flex flex-col h-full">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 w-full resize-none bg-transparent px-6 py-4 text-[14px] leading-relaxed text-[var(--ink)] outline-none"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
                  spellCheck={false}
                />
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
                  >
                    <X size={14} />
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-colors"
                  >
                    <Save size={14} />
                    保存
                  </button>
                </div>
              </div>
            ) : content ? (
              <div className="px-6 py-4">
                <Markdown>{content}</Markdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--ink-tertiary)] text-[13px] gap-2">
                <FileText size={24} className="text-[var(--ink-tertiary)]/50" />
                <span>文件为空</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditContent('');
                    setIsEditMode(true);
                  }}
                  className="mt-1 text-[var(--accent)] hover:underline text-[13px]"
                >
                  开始编辑
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Context menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenuItems}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    );
  }
);

export default SystemPromptsPanel;
