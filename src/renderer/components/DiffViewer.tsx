import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { unifiedMergeView } from '@codemirror/merge';
import { getLangExtension } from '../utils/codemirror';

interface Props {
  before: string;
  after: string;
  filePath: string;
  maxHeight?: number;
}

const diffTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    fontFamily: "'SF Mono', 'Menlo', monospace",
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-focused': { outline: 'none' },
  '.cm-mergeView .cm-changedLine': {
    backgroundColor: 'rgba(46, 160, 67, 0.15) !important',
  },
  '.cm-mergeView .cm-deletedChunk': {
    backgroundColor: 'rgba(248, 81, 73, 0.12) !important',
  },
  '.cm-mergeView .cm-changedText': {
    backgroundColor: 'rgba(46, 160, 67, 0.3) !important',
  },
  '.cm-mergeView .cm-deletedChunk .cm-deletedText': {
    backgroundColor: 'rgba(248, 81, 73, 0.25) !important',
  },
});

export default function DiffViewer({ before, after, filePath, maxHeight = 400 }: Props) {
  return (
    <div
      className="border-t border-[var(--border)] bg-[var(--paper)]"
      style={{ maxHeight, overflow: 'auto' }}
    >
      <CodeMirror
        value={after}
        readOnly={true}
        editable={false}
        extensions={[
          unifiedMergeView({
            original: before,
            highlightChanges: true,
            gutter: true,
            syntaxHighlightDeletions: true,
            mergeControls: false,
          }),
          getLangExtension(filePath),
          diffTheme,
        ]}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
      />
    </div>
  );
}
