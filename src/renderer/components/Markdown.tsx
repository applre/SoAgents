/**
 * Markdown - Enhanced Markdown renderer for AI chat
 *
 * Features:
 * - Syntax highlighted code blocks with copy button
 * - LaTeX math formulas (KaTeX)
 * - Mermaid diagrams
 * - GFM tables, task lists, strikethrough
 * - External links open in system browser
 */

import 'katex/dist/katex.min.css';

import { memo } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import CodeBlock from './markdown/CodeBlock';
import InlineCode from './markdown/InlineCode';
import MermaidDiagram from './markdown/MermaidDiagram';
import { openExternal } from '../utils/openExternal';
import { preprocessContent } from '../utils/preprocessMarkdown';

// Static plugin arrays to avoid recreation on every render
const REMARK_PLUGINS_DEFAULT = [remarkGfm, remarkMath];
const REMARK_PLUGINS_WITH_BREAKS = [remarkGfm, remarkMath, remarkBreaks];
const REHYPE_PLUGINS = [rehypeKatex];

// Custom link component that opens links in system browser
const MarkdownLink: Components['a'] = ({ href, children, ...props }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;
    if (!hasSelection && href) {
      openExternal(href);
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 transition-colors hover:text-[var(--accent)]/80 hover:decoration-[var(--accent)]/60"
      style={{ userSelect: 'text' }}
      {...props}
    >
      {children}
    </a>
  );
};

// Custom code component - handles both inline and block code
const CodeComponent: Components['code'] = ({ className, children, node: _node, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  const extractText = (child: React.ReactNode, depth = 0): string => {
    if (depth > 50) return '';
    if (typeof child === 'string') return child;
    if (typeof child === 'number') return String(child);
    if (Array.isArray(child)) return child.map(c => extractText(c, depth + 1)).join('');
    if (child && typeof child === 'object' && 'props' in child) {
      const element = child as { props?: { children?: React.ReactNode } };
      if (element.props?.children) {
        return extractText(element.props.children, depth + 1);
      }
    }
    return '';
  };

  const codeString = extractText(children).replace(/\n$/, '');

  // Block code: has language annotation OR multiple lines
  const isBlock = match || codeString.includes('\n');

  if (isBlock) {
    if (language === 'mermaid') {
      return <MermaidDiagram>{codeString}</MermaidDiagram>;
    }
    return (
      <CodeBlock language={language} className={className}>
        {codeString}
      </CodeBlock>
    );
  }

  // Inline code
  return <InlineCode {...props}>{children}</InlineCode>;
};

// Custom pre component - wrapper for code blocks
const PreComponent: Components['pre'] = ({ children }) => {
  return <>{children}</>;
};

// Custom table components
const TableComponent: Components['table'] = ({ children }) => (
  <div className="my-4 overflow-x-auto rounded-lg border border-[var(--border)]">
    <table className="min-w-full divide-y divide-[var(--border)]">
      {children}
    </table>
  </div>
);

const TableHeadComponent: Components['thead'] = ({ children }) => (
  <thead className="bg-[var(--surface)]/80">{children}</thead>
);

const TableRowComponent: Components['tr'] = ({ children }) => (
  <tr className="border-b border-[var(--border)]/50 last:border-0">
    {children}
  </tr>
);

const TableCellComponent: Components['td'] = ({ children }) => (
  <td className="px-4 py-2.5 text-sm">{children}</td>
);

const TableHeaderComponent: Components['th'] = ({ children }) => (
  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ink-secondary)]">
    {children}
  </th>
);

// Custom blockquote
const BlockquoteComponent: Components['blockquote'] = ({ children }) => (
  <blockquote className="my-4 border-l-4 border-[var(--warning)]/60 bg-[var(--warning-bg)]/50 py-2 pl-4 pr-3 italic text-[var(--ink-secondary)]">
    {children}
  </blockquote>
);

// Custom heading components - H1:22px H2:20px H3:18px H4-H6:16px
const H1Component: Components['h1'] = ({ children }) => (
  <h1 className="mb-4 mt-6 text-[22px] font-bold text-[var(--ink)]">{children}</h1>
);

const H2Component: Components['h2'] = ({ children }) => (
  <h2 className="mb-3 mt-5 text-[20px] font-semibold text-[var(--ink)]">{children}</h2>
);

const H3Component: Components['h3'] = ({ children }) => (
  <h3 className="mb-2 mt-4 text-[18px] font-semibold text-[var(--ink)]">{children}</h3>
);

const H4Component: Components['h4'] = ({ children }) => (
  <h4 className="mb-2 mt-3 text-[16px] font-semibold text-[var(--ink-secondary)]">{children}</h4>
);

const H5Component: Components['h5'] = ({ children }) => (
  <h5 className="mb-2 mt-3 text-[16px] font-medium text-[var(--ink-secondary)]">{children}</h5>
);

const H6Component: Components['h6'] = ({ children }) => (
  <h6 className="mb-2 mt-3 text-[16px] font-medium text-[var(--ink-tertiary)]">{children}</h6>
);

// Custom list components
const UlComponent: Components['ul'] = ({ children }) => (
  <ul className="my-3 ml-6 block list-outside list-disc space-y-1.5 text-[var(--ink)] marker:text-[var(--ink-secondary)]">
    {children}
  </ul>
);

const OlComponent: Components['ol'] = ({ children }) => (
  <ol className="my-3 ml-6 block list-outside list-decimal space-y-1.5 text-[var(--ink)] marker:text-[var(--ink-secondary)]">
    {children}
  </ol>
);

const LiComponent: Components['li'] = ({ children }) => (
  <li className="pl-1" style={{ display: 'list-item' }}>{children}</li>
);

// Paragraph component
const ParagraphComponent: Components['p'] = ({ children }) => (
  <p className="my-2 leading-relaxed">{children}</p>
);

// Horizontal rule
const HrComponent: Components['hr'] = () => (
  <hr className="my-6 border-[var(--border)]" />
);

// Static components object — avoids recreation on every render
const markdownComponents: Components = {
  a: MarkdownLink,
  code: CodeComponent,
  pre: PreComponent,
  table: TableComponent,
  thead: TableHeadComponent,
  tr: TableRowComponent,
  td: TableCellComponent,
  th: TableHeaderComponent,
  blockquote: BlockquoteComponent,
  p: ParagraphComponent,
  hr: HrComponent,
  h1: H1Component,
  h2: H2Component,
  h3: H3Component,
  h4: H4Component,
  h5: H5Component,
  h6: H6Component,
  ul: UlComponent,
  ol: OlComponent,
  li: LiComponent,
};

interface MarkdownProps {
  children: string;
  /** Use compact styling for smaller spaces like thinking blocks */
  compact?: boolean;
  /** Preserve single newlines as line breaks (useful for user messages in chat) */
  preserveNewlines?: boolean;
}

const Markdown = memo(function Markdown({ children, compact = false, preserveNewlines = false }: MarkdownProps) {
  const processedContent = preprocessContent(children);

  return (
    <div className={`break-words ${compact ? 'text-sm' : 'text-base'}`}>
      <ReactMarkdown
        remarkPlugins={preserveNewlines ? REMARK_PLUGINS_WITH_BREAKS : REMARK_PLUGINS_DEFAULT}
        rehypePlugins={REHYPE_PLUGINS}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

export default Markdown;
