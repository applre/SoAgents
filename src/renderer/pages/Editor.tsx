import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ToolbarAction } from '../components/EditorToolbar';
import { globalApiGetJson, globalApiPostJson } from '../api/apiFetch';
import { isTauri } from '../utils/env';

interface Props {
  filePath: string;
  mode: 'edit' | 'preview';
  onSave?: (filePath: string) => void;
  onActionRef?: (ref: { handleAction: (action: ToolbarAction) => void; save: () => void }) => void;
}

const cmTheme = EditorView.theme({
  '&': { fontSize: '15px', height: '100%' },
  '.cm-scroller': { fontFamily: "'SF Mono', 'Menlo', monospace", lineHeight: '1.7', overflow: 'auto' },
  '.cm-content': { padding: '16px 24px', minHeight: '100%' },
  '.cm-focused': { outline: 'none' },
  '.cm-line': { padding: '0' },
});

// 根据扩展名返回 CodeMirror 语言插件
function getLangExtension(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'js': return javascript();
    case 'jsx': return javascript({ jsx: true });
    case 'ts': return javascript({ typescript: true });
    case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'py': return python();
    case 'rs': return rust();
    case 'css': return css();
    case 'html': case 'htm': return html();
    case 'json': return json();
    case 'md': case 'markdown': return markdown();
    default: return markdown(); // 其他文件用 markdown（无额外高亮但可编辑）
  }
}

// 是否为 Markdown 文件（支持预览模式）
function isMarkdownFile(filePath: string) {
  return /\.(md|markdown)$/i.test(filePath);
}

export default function Editor({ filePath, mode, onSave, onActionRef }: Props) {
  const [content, setContent] = useState('');
  const editorViewRef = useRef<EditorView | null>(null);
  const langExtension = useMemo(() => getLangExtension(filePath), [filePath]);
  const isMarkdown = useMemo(() => isMarkdownFile(filePath), [filePath]);
  // 非 Markdown 文件强制 edit 模式
  const effectiveMode = isMarkdown ? mode : 'edit';

  // 加载文件内容
  useEffect(() => {
    if (!filePath) return;
    globalApiGetJson<{ content: string }>(`/api/file-read?path=${encodeURIComponent(filePath)}`)
      .then((res) => setContent(res.content))
      .catch(console.error);
  }, [filePath]);

  const save = useCallback(async () => {
    if (!filePath) return;
    try {
      await globalApiPostJson('/api/file-write', { path: filePath, content });
      onSave?.(filePath);
    } catch (e) {
      console.error(e);
    }
  }, [filePath, content, onSave]);

  // Cmd+S 保存
  useEffect(() => {
    const onKeydown = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
      e.preventDefault();
      if (filePath) {
        await save();
      } else if (isTauri()) {
        const { save: saveDialog } = await import('@tauri-apps/plugin-dialog');
        const chosen = await saveDialog({ filters: [{ name: 'Markdown', extensions: ['md'] }], defaultPath: 'untitled.md' });
        if (chosen) {
          await globalApiPostJson('/api/file-write', { path: chosen, content });
          onSave?.(chosen);
        }
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [filePath, content, save, onSave]);

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
        break;
      case 'h2':
        insert = `\n## ${selected || '标题'}`;
        break;
      case 'h3':
        insert = `\n### ${selected || '标题'}`;
        break;
      case 'code':
        insert = selected ? `\`${selected}\`` : '`代码`';
        cursorOffset = selected ? 0 : -2;
        break;
      case 'codeblock':
        insert = `\n\`\`\`\n${selected || ''}\n\`\`\`\n`;
        break;
      case 'link':
        insert = selected ? `[${selected}](url)` : '[链接文字](url)';
        cursorOffset = selected ? -1 : -18;
        break;
      case 'divider':
        insert = '\n---\n';
        break;
      case 'ul':
        insert = `\n- ${selected || '列表项'}`;
        break;
      case 'ol':
        insert = `\n1. ${selected || '列表项'}`;
        break;
      case 'quote':
        insert = `\n> ${selected || '引用'}`;
        break;
      case 'table':
        insert = '\n| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |\n';
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

  // 暴露 handleAction 和 save 给父组件
  useEffect(() => {
    onActionRef?.({ handleAction, save });
  }, [handleAction, save, onActionRef]);

  return (
    <div className="flex-1 overflow-hidden">
      {effectiveMode === 'edit' ? (
        <CodeMirror
          value={content}
          extensions={[langExtension, cmTheme]}
          onChange={setContent}
          onCreateEditor={(view) => { editorViewRef.current = view; }}
          basicSetup={{
            lineNumbers: !isMarkdown,
            foldGutter: false,
            highlightActiveLine: true,
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
  );
}
