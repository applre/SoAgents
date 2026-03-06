import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
  /** true for user messages (dark theme), false for assistant (light theme) */
  darkTheme?: boolean;
}

export default function CodeBlock({ children, language, className, darkTheme = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const extractedLanguage = language || className?.replace(/language-/, '') || 'text';
  const lineCount = children.split('\n').length;
  const theme = darkTheme ? oneDark : oneLight;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }, [children]);

  return (
    <div className="group/codeblock relative my-3 w-full overflow-hidden rounded-lg">
      {/* Header: language label + copy button */}
      <div className="flex items-center justify-between bg-[#2d2d2d] px-4 py-1.5 text-xs">
        <span className="font-mono text-neutral-400 uppercase tracking-wide">
          {extractedLanguage}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
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

      {/* Code content */}
      <SyntaxHighlighter
        language={extractedLanguage}
        style={theme}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: 13,
          lineHeight: '1.6',
        }}
        showLineNumbers={lineCount > 5}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: darkTheme ? '#4a4a4a' : '#9ca3af',
          userSelect: 'none',
        }}
        wrapLongLines
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  );
}
