import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Puzzle } from 'lucide-react';
import type { Message } from '../types/chat';
import ToolUse from './tools/ToolUse';
import CodeBlock from './markdown/CodeBlock';

interface Props {
  message: Message;
  onOpenUrl?: (url: string) => void;
}

export default function MessageItem({ message, onOpenUrl }: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  // Build copyable text content
  const getCopyText = (): string => {
    if (isUser) {
      const textBlocks = message.blocks.filter((b) => b.type === 'text');
      return textBlocks.map((b) => (b as { text: string }).text).join('\n');
    }
    // Assistant: join text blocks, skip thinking/tool_use
    return message.blocks
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n\n');
  };

  // Copy action button (shared between user and assistant)
  const copyButton = (
    <div className="group/copy relative">
      <button
        type="button"
        onClick={() => handleCopy(getCopyText())}
        className="rounded-lg p-1.5 text-[var(--ink-tertiary)] transition-all hover:bg-[var(--hover)] hover:text-[var(--ink-secondary)] hover:shadow-sm"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      <span className="pointer-events-none absolute right-full top-1/2 mr-1 -translate-y-1/2 whitespace-nowrap rounded-md bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--ink-tertiary)] shadow-md border border-[var(--border)] opacity-0 transition-opacity group-hover/copy:opacity-100">
        {copied ? '已复制' : '复制'}
      </span>
    </div>
  );

  if (isUser) {
    return (
      <div className="group/user relative flex flex-col items-end">
        <div
          className={[
            'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
            'bg-[var(--accent)] text-white [--tw-prose-body:theme(colors.white)] [--tw-prose-headings:theme(colors.white)] [--tw-prose-code:theme(colors.white)] [--tw-prose-bold:theme(colors.white)] [--tw-prose-links:theme(colors.white)]',
          ].join(' ')}
        >
          {message.blocks.map((block, i) => {
            if (block.type === 'skill') {
              return (
                <div key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-1.5 text-xs font-medium bg-white/15 text-white">
                  <Puzzle size={12} className="shrink-0" />
                  <span>{block.name}</span>
                </div>
              );
            }
            if (block.type === 'image') {
              return (
                <div key={i} className="mb-2">
                  <img src={block.base64} alt={block.name} className="max-w-full max-h-64 rounded-lg" />
                </div>
              );
            }
            if (block.type !== 'text') return null;
            return (
              <div key={i} className="prose prose-sm max-w-none [&_*]:!text-white [&_*]:!bg-transparent [&_code]:!bg-white/20 [&_pre]:!bg-white/10 [&_a]:!text-white/90">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      if (match) {
                        return (
                          <CodeBlock language={match[1]} darkTheme>
                            {String(children).replace(/\n$/, '')}
                          </CodeBlock>
                        );
                      }
                      return <code className={className} {...props}>{children}</code>;
                    },
                    pre({ children }) {
                      return <>{children}</>;
                    },
                    a({ href, children }) {
                      if (href?.startsWith('http') && onOpenUrl) {
                        return (
                          <a href={href} onClick={(e) => { e.preventDefault(); onOpenUrl(href); }} title={href}>
                            {children}
                          </a>
                        );
                      }
                      return <a href={href}>{children}</a>;
                    },
                  }}
                >
                  {block.text}
                </ReactMarkdown>
              </div>
            );
          })}
        </div>
        {/* Hover action menu */}
        <div className="flex items-center gap-0.5 mt-1 opacity-0 transition-opacity group-hover/user:opacity-100">
          {copyButton}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="group/assistant flex flex-col items-start">
      <div
        className={[
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
          'bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)]',
        ].join(' ')}
      >
        {message.blocks.map((block, i) => {
          if (block.type === 'thinking') {
            return <ThinkingBlock key={i} text={block.thinking} />;
          }
          if (block.type === 'tool_use') {
            return <ToolUse key={i} block={block} />;
          }
          if (block.type === 'skill') {
            return (
              <div key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-1.5 text-xs font-medium bg-[var(--hover)] text-[var(--ink-secondary)] border border-[var(--border)]">
                <Puzzle size={12} className="shrink-0" />
                <span>{block.name}</span>
              </div>
            );
          }
          if (block.type === 'image') {
            return (
              <div key={i} className="mb-2">
                <img src={block.base64} alt={block.name} className="max-w-full max-h-64 rounded-lg" />
              </div>
            );
          }
          return (
            <div key={i} className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (match) {
                      return (
                        <CodeBlock language={match[1]}>
                          {String(children).replace(/\n$/, '')}
                        </CodeBlock>
                      );
                    }
                    return <code className={className} {...props}>{children}</code>;
                  },
                  pre({ children }) {
                    return <>{children}</>;
                  },
                  a({ href, children }) {
                    if (href?.startsWith('http') && onOpenUrl) {
                      return (
                        <a href={href} onClick={(e) => { e.preventDefault(); onOpenUrl(href); }} title={href}>
                          {children}
                        </a>
                      );
                    }
                    return <a href={href}>{children}</a>;
                  },
                }}
              >
                {block.text}
              </ReactMarkdown>
            </div>
          );
        })}
      </div>
      {/* Hover action menu */}
      <div className="flex items-center gap-0.5 mt-1 opacity-0 transition-opacity group-hover/assistant:opacity-100">
        {copyButton}
      </div>
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 text-xs">
      <button
        className="text-[var(--ink-tertiary)] italic hover:text-[var(--ink-secondary)] flex items-center gap-1"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾' : '▸'} 思考过程
      </button>
      {open && (
        <div className="mt-1 pl-3 border-l border-[var(--border)] text-[var(--ink-tertiary)] italic whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}
