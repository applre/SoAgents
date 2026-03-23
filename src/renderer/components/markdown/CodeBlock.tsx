/**
 * CodeBlock - Syntax highlighted code block with copy button
 * Supports all major programming languages via react-syntax-highlighter
 */

import { Check, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
}

// Custom theme based on oneDark with warm tones to match app aesthetic
// Uses CSS variable --font-code for consistent font across all code rendering
const customTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'var(--code-bg)',
    borderRadius: '0.5rem',
    padding: '1rem',
    margin: 0,
    fontSize: '13px',
    lineHeight: '1.6',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontSize: '13px',
    lineHeight: '1.6',
    fontFamily: 'var(--font-code)',
  },
};

export default function CodeBlock({ children, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const extractedLanguage = language || className?.replace(/language-/, '') || 'text';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [children]);

  return (
    <div className="group relative my-3 w-full overflow-hidden rounded-lg">
      {/* Header with language label and copy button */}
      <div className="flex items-center justify-between bg-[var(--code-header-bg)] px-4 py-2 text-xs">
        <span className="font-mono text-[var(--code-line-number)] uppercase tracking-wide">
          {extractedLanguage}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[var(--code-line-number)] transition-colors hover:bg-white/10 hover:text-neutral-200"
          title={copied ? '已复制' : '复制代码'}
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              <span>已复制</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>

      {/* Code content with syntax highlighting */}
      <SyntaxHighlighter
        language={extractedLanguage}
        style={customTheme}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
        showLineNumbers={children.split('\n').length > 5}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: 'var(--code-line-number)',
          userSelect: 'none',
        }}
        wrapLongLines={false}
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  );
}
