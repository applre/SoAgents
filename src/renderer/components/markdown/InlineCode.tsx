/**
 * InlineCode - Styled inline code snippets with file path detection.
 *
 * When rendered inside Chat (FileActionContext available), automatically
 * detects file/folder paths and makes them interactive (dashed underline + click menu).
 */
import { useFileAction } from '../../context/FileActionContext';
import { looksLikeFilePath } from '../../utils/pathDetection';

interface InlineCodeProps {
  children: React.ReactNode;
  className?: string;
}

const BASE_CLASS = 'rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--ink)]';
const INTERACTIVE_CLASS = `${BASE_CLASS} border-b border-dashed border-[var(--ink-tertiary)] cursor-pointer hover:bg-[var(--hover)] transition-colors`;

/** Extract plain text from React children (handles string / number / nested spans). */
function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return '';
}

export default function InlineCode({ children, className }: InlineCodeProps) {
  const fileAction = useFileAction(); // null outside Chat
  const text = extractText(children);

  // Fast path: no context or not a path candidate → plain code
  if (!fileAction || !looksLikeFilePath(text)) {
    return <code className={className ?? BASE_CLASS}>{children}</code>;
  }

  // Ask context for cached result (may trigger a batched backend request)
  const pathInfo = fileAction.checkPath(text);

  if (!pathInfo?.exists) {
    // Not yet resolved or does not exist → plain code
    return <code className={className ?? BASE_CLASS}>{children}</code>;
  }

  // Path exists — render interactive
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    fileAction.openFileMenu(rect.left, rect.bottom + 4, text, pathInfo.type);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileAction.openFileMenu(e.clientX, e.clientY, text, pathInfo.type);
  };

  return (
    <code
      className={INTERACTIVE_CLASS}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={pathInfo.type === 'dir' ? `文件夹: ${text}` : `文件: ${text}`}
    >
      {children}
    </code>
  );
}
