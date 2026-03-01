import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';

// 根据扩展名返回 CodeMirror 语言插件
export function getLangExtension(filePath: string) {
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
    default: return markdown();
  }
}
