import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Copy, Check, Puzzle } from 'lucide-react';
import type { Message, TurnMeta, ContentBlock } from '../types/chat';
import BlockGroup from './BlockGroup';
import CodeBlock from './markdown/CodeBlock';
import MermaidDiagram from './markdown/MermaidDiagram';
import InlineCode from './markdown/InlineCode';
import { formatTokens, formatDuration } from '../utils/formatTokens';
import { preprocessContent } from '../utils/preprocessMarkdown';

interface Props {
  message: Message;
  isStreaming?: boolean;
  onOpenUrl?: (url: string) => void;
}

function MessageItemInner({ message, isStreaming, onOpenUrl }: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 流式结束后延迟 350ms 显示操作按钮，防止布局跳动
  const [showActions, setShowActions] = useState(!isStreaming);
  useEffect(() => {
    if (!isStreaming) {
      const timer = setTimeout(() => setShowActions(true), 350);
      return () => clearTimeout(timer);
    }
    // 流式开始时隐藏
    const timer = setTimeout(() => setShowActions(false), 0);
    return () => clearTimeout(timer);
  }, [isStreaming]);

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
                  remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      if (match) {
                        const codeStr = String(children).replace(/\n$/, '');
                        if (match[1] === 'mermaid') {
                          return <MermaidDiagram>{codeStr}</MermaidDiagram>;
                        }
                        return (
                          <CodeBlock language={match[1]} darkTheme>
                            {codeStr}
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
                  {preprocessContent(block.text)}
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
        {groupBlocks(message.blocks).map((group, gi) => {
          // 分组：ProcessBlock[] → BlockGroup 组件
          if (Array.isArray(group)) {
            return <BlockGroup key={`g${gi}`} blocks={group} isStreaming={isStreaming} />;
          }
          // 单个块：skill / image / text
          const block = group;
          if (block.type === 'skill') {
            return (
              <div key={`b${gi}`} className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-1.5 text-xs font-medium bg-[var(--hover)] text-[var(--ink-secondary)] border border-[var(--border)]">
                <Puzzle size={12} className="shrink-0" />
                <span>{block.name}</span>
              </div>
            );
          }
          if (block.type === 'image') {
            return (
              <div key={`b${gi}`} className="mb-2">
                <img src={block.base64} alt={block.name} className="max-w-full max-h-64 rounded-lg" />
              </div>
            );
          }
          // text block
          if (block.type !== 'text') return null;
          return (
            <div key={`b${gi}`} className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (match) {
                      const codeStr = String(children).replace(/\n$/, '');
                      if (match[1] === 'mermaid') {
                        return <MermaidDiagram>{codeStr}</MermaidDiagram>;
                      }
                      return (
                        <CodeBlock language={match[1]}>
                          {codeStr}
                        </CodeBlock>
                      );
                    }
                    // Inline code → InlineCode with file path detection
                    return <InlineCode className={className} {...props}>{children}</InlineCode>;
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
                {preprocessContent(block.text)}
              </ReactMarkdown>
            </div>
          );
        })}
      </div>
      {/* Turn meta + hover action menu — 流式结束后 350ms 延迟显示 */}
      {showActions && (
        <div className="flex items-center gap-2 mt-1">
          {message.turnMeta && <TurnMetaDisplay meta={message.turnMeta} />}
          <div className="opacity-0 transition-opacity group-hover/assistant:opacity-100">
            {copyButton}
          </div>
        </div>
      )}
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

/**
 * 分组算法：将连续的 thinking/tool_use 块合并为一组，其他块单独放
 * 返回 (ProcessBlock[] | ContentBlock)[]
 */
type ProcessBlock = Extract<ContentBlock, { type: 'thinking' }> | Extract<ContentBlock, { type: 'tool_use' }>;

function groupBlocks(blocks: ContentBlock[]): (ProcessBlock[] | ContentBlock)[] {
  const result: (ProcessBlock[] | ContentBlock)[] = [];
  let currentGroup: ProcessBlock[] = [];

  const flushGroup = () => {
    if (currentGroup.length > 0) {
      result.push(currentGroup);
      currentGroup = [];
    }
  };

  for (const block of blocks) {
    if (block.type === 'thinking' || block.type === 'tool_use') {
      currentGroup.push(block);
    } else {
      flushGroup();
      result.push(block);
    }
  }
  flushGroup();

  return result;
}

// 自定义比较：历史消息同引用直接跳过，只有流式消息走完整比较
function areMessagesEqual(prev: Props, next: Props): boolean {
  if (prev.isStreaming !== next.isStreaming) return false;
  // 同引用 → 内容没变（历史消息快速路径）
  if (prev.message === next.message) return true;
  // 不同引用但同 id → 可能是流式更新中的同一条消息
  if (prev.message.id !== next.message.id) return false;
  return prev.message.blocks === next.message.blocks;
}

const MessageItem = React.memo(MessageItemInner, areMessagesEqual);
export default MessageItem;

