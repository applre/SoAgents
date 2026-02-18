import { useState, useEffect, useCallback, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import EditorToolbar from '../components/EditorToolbar';
import type { ToolbarAction } from '../components/EditorToolbar';
import { globalApiGetJson, globalApiPostJson } from '../api/apiFetch';
import { isTauri } from '../utils/env';

interface Props {
  tabId: string;
  initialFilePath: string | null;
  onTitleChange?: (tabId: string, title: string, filePath: string) => void;
}

const cmTheme = EditorView.theme({
  '&': { fontSize: '15px', height: '100%' },
  '.cm-scroller': { fontFamily: "'SF Mono', 'Menlo', monospace", lineHeight: '1.7', overflow: 'auto' },
  '.cm-content': { padding: '16px 24px', minHeight: '100%' },
  '.cm-focused': { outline: 'none' },
  '.cm-line': { padding: '0' },
});

export default function Editor({ tabId, initialFilePath, onTitleChange }: Props) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [filePath, setFilePath] = useState<string | null>(initialFilePath);
  const [isSaving, setIsSaving] = useState(false);
  const editorViewRef = useRef<EditorView | null>(null);

  const fileName = filePath ? filePath.split('/').pop() ?? 'untitled.md' : 'untitled.md';

  // 加载文件内容
  useEffect(() => {
    if (!initialFilePath) return;
    globalApiGetJson<{ content: string }>(`/api/file-read?path=${encodeURIComponent(initialFilePath)}`)
      .then((res) => setContent(res.content))
      .catch(console.error);
  }, [initialFilePath]);

  const saveToPath = useCallback(async (path: string, text: string) => {
    setIsSaving(true);
    try {
      await globalApiPostJson('/api/file-write', { path, content: text });
      setFilePath(path);
      const title = path.split('/').pop() ?? 'untitled.md';
      onTitleChange?.(tabId, title, path);
    } finally {
      setIsSaving(false);
    }
  }, [tabId, onTitleChange]);

  // Cmd+S 保存
  useEffect(() => {
    const onKeydown = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
      e.preventDefault();
      if (filePath) {
        await saveToPath(filePath, content);
      } else if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const chosen = await save({ filters: [{ name: 'Markdown', extensions: ['md'] }], defaultPath: 'untitled.md' });
        if (chosen) await saveToPath(chosen, content);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [filePath, content, saveToPath]);

  // 工具栏操作 — 在 CodeMirror 光标处插入 / 包裹文本
  const handleAction = useCallback((action: ToolbarAction) => {
    const view = editorViewRef.current;
    if (!view) return;
    const { state } = view;
    const { from, to } = state.selection.main;
    const selected = state.doc.sliceString(from, to);

    let insert = '';
    let cursorOffset = 0;

    switch (action) {
      case 'bold':
        insert = selected ? `**${selected}**` : '**粗体**';
        cursorOffset = selected ? 0 : -3;
        break;
      case 'italic':
        insert = selected ? `*${selected}*` : '*斜体*';
        cursorOffset = selected ? 0 : -2;
        break;
      case 'h1':
        insert = `\n# ${selected || '标题'}`;
        cursorOffset = selected ? 0 : 0;
        break;
      case 'h2':
        insert = `\n## ${selected || '标题'}`;
        cursorOffset = selected ? 0 : 0;
        break;
      case 'code':
        insert = selected ? `\`${selected}\`` : '`代码`';
        cursorOffset = selected ? 0 : -2;
        break;
      case 'codeblock':
        insert = `\n\`\`\`\n${selected || ''}\n\`\`\`\n`;
        cursorOffset = 0;
        break;
      case 'link':
        insert = selected ? `[${selected}](url)` : '[链接文字](url)';
        cursorOffset = selected ? -1 : -18;
        break;
      case 'divider':
        insert = '\n---\n';
        cursorOffset = 0;
        break;
    }

    const newFrom = from;
    const newTo = from + insert.length + cursorOffset;
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(newTo < newFrom ? newFrom + insert.length : newTo),
    });
    view.focus();
  }, []);

  return (
    <div className="flex h-full flex-col bg-[var(--paper)] overflow-hidden">
      <EditorToolbar
        mode={mode}
        onModeChange={setMode}
        onAction={handleAction}
        fileName={isSaving ? `${fileName} 保存中…` : fileName}
      />

      <div className="flex-1 overflow-hidden">
        {mode === 'edit' ? (
          <CodeMirror
            value={content}
            extensions={[markdown(), cmTheme]}
            onChange={setContent}
            onCreateEditor={(view) => { editorViewRef.current = view; }}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              autocompletion: false,
            }}
            style={{ height: '100%' }}
          />
        ) : (
          <div className="h-full overflow-y-auto px-8 py-6">
            <div
              className="mx-auto prose prose-sm max-w-3xl text-[var(--ink)]"
              style={{ '--tw-prose-body': 'var(--ink)', '--tw-prose-headings': 'var(--ink)' } as React.CSSProperties}
            >
              {content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    code({ className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      return match ? (
                        <SyntaxHighlighter style={oneLight} language={match[1]} PreTag="div">
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>{children}</code>
                      );
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              ) : (
                <p className="text-[var(--ink-tertiary)] italic">空文档</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
