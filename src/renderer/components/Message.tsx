import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Puzzle } from 'lucide-react';
import type { Message, TurnMeta } from '../types/chat';
import ToolUse from './tools/ToolUse';
import CodeBlock from './markdown/CodeBlock';
import { formatTokens, formatDuration } from '../utils/formatTokens';

interface Props {
  message: Message;
  isStreaming?: boolean;
  onOpenUrl?: (url: string) => void;
}

export default function MessageItem({ message, isStreaming, onOpenUrl }: Props) {
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
        className="w-full text-sm text-[var(--ink)]"
      >
        {message.blocks.map((block, i) => {
          if (block.type === 'thinking') {
            // 流式阶段且该消息只有 thinking block（text 还没来）→ 默认展开
            const hasTextBlock = message.blocks.some((b) => b.type === 'text');
            const isActiveThinking = isStreaming && !hasTextBlock;
            return <ThinkingBlock key={i} text={block.thinking} defaultOpen={isActiveThinking} isActive={isActiveThinking} />;
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
      {/* Turn meta + hover action menu */}
      <div className="flex items-center gap-2 mt-1">
        {message.turnMeta && <TurnMetaDisplay meta={message.turnMeta} />}
        <div className="opacity-0 transition-opacity group-hover/assistant:opacity-100">
          {copyButton}
        </div>
      </div>
    </div>
  );
}

function TurnMetaDisplay({ meta }: { meta: TurnMeta }) {
  const parts: string[] = [];
  if (meta.model) parts.push(meta.model);
  const totalTokens = (meta.inputTokens ?? 0) + (meta.outputTokens ?? 0);
  if (totalTokens > 0) parts.push(`${formatTokens(totalTokens)} tokens`);
  if (meta.durationMs) parts.push(formatDuration(meta.durationMs));
  if (parts.length === 0) return null;
  return (
    <span className="text-[11px] text-[var(--ink-tertiary)]">
      {parts.join(' · ')}
    </span>
  );
}

function ThinkingBlock({ text, defaultOpen, isActive }: { text: string; defaultOpen?: boolean; isActive?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [prevIsActive, setPrevIsActive] = useState(isActive);
  if (prevIsActive !== isActive) {
    setPrevIsActive(isActive);
    if (isActive) {
      // 思考开始 → 自动展开
      setOpen(true);
    } else {
      // 思考结束（text 开始输出）→ 自动折叠
      setOpen(false);
    }
  }

  return (
    <div className="mb-2 text-xs">
      <button
        className="text-[var(--ink-tertiary)] italic hover:text-[var(--ink-secondary)] flex items-center gap-1"
        onClick={() => setOpen((v) => !v)}
      >
        {isActive && <span className="text-[var(--accent)] animate-pulse">●</span>}
        {open ? '▾' : '▸'} {isActive ? '正在思考…' : '思考过程'}
      </button>
      {open && (
        <div
          ref={contentRef}
          className="mt-1 pl-3 border-l border-[var(--border)] text-[var(--ink-tertiary)] italic whitespace-pre-wrap max-h-48 overflow-y-auto"
        >
          {text}
        </div>
      )}
    </div>
  );
}
