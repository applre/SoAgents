import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, Puzzle, Undo2, RotateCcw, GitBranch } from 'lucide-react';
import type { Message, TurnMeta, ContentBlock } from '../types/chat';
import BlockGroup from './BlockGroup';
import Markdown from './Markdown';
import { formatTokens, formatDuration } from '../utils/formatTokens';

interface Props {
  message: Message;
  isStreaming?: boolean;
  /** Rewind to a user message (truncate chat + roll back files). Disabled when
   *  the message has no sdkUuid or while the assistant is streaming. */
  onRewind?: (messageId: string) => void;
  /** Retry an assistant message — rewind to the preceding user message and resend. */
  onRetry?: (assistantMessageId: string) => void;
  /** Fork a new session from an assistant message. Disabled without sdkUuid. */
  onFork?: (assistantMessageId: string) => void;
}

/** Lightweight CSS-only tooltip */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ink)]/90 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover/tip:opacity-100">
        {label}
      </span>
    </span>
  );
}

function MessageItemInner({ message, isStreaming, onRewind, onRetry, onFork }: Props) {
  const isUser = message.role === 'user';
  const hasSdkUuid = !!message.sdkUuid;
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Delay action buttons 350ms after streaming ends to prevent layout shift
  const [showActions, setShowActions] = useState(!isStreaming);
  useEffect(() => {
    if (!isStreaming) {
      const timer = setTimeout(() => setShowActions(true), 350);
      return () => clearTimeout(timer);
    }
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
    return message.blocks
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n\n');
  };

  // Copy action button
  const copyButton = (
    <Tip label={copied ? '已复制' : '复制'}>
      <button
        type="button"
        onClick={() => handleCopy(getCopyText())}
        className="rounded-lg p-1 text-[var(--ink-tertiary)] transition-all hover:bg-[var(--surface)] hover:text-[var(--ink-secondary)]"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </Tip>
  );

  if (isUser) {
    return (
      <div
        className="group/user relative flex justify-end select-none"
        data-chat-search-scope
        data-role="user"
        data-message-id={message.id}
      >
        <div className="flex w-full flex-col items-end">
          <article className="relative w-fit max-w-[66%] rounded-2xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3 text-sm leading-relaxed text-[var(--ink)] shadow-md select-text">
            {message.blocks.map((block, i) => {
              if (block.type === 'skill') {
                return (
                  <div key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-1.5 text-xs font-medium bg-[var(--surface)] text-[var(--ink-secondary)] border border-[var(--border)]">
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
                <div key={i} className="text-[var(--ink)]">
                  <Markdown preserveNewlines>{block.text}</Markdown>
                </div>
              );
            })}
          </article>
          {/* Hover action menu */}
          <div className="flex items-center gap-0.5 mt-1 opacity-0 transition-opacity group-hover/user:opacity-100">
            {copyButton}
            {onRewind && (
              <Tip label={hasSdkUuid ? '回溯到此条（撤销之后对话 + 工作区文件改动）' : '此消息无 SDK 追踪信息，无法回溯'}>
                <button
                  type="button"
                  onClick={() => hasSdkUuid && !isStreaming && onRewind(message.id)}
                  disabled={!hasSdkUuid || isStreaming}
                  className="rounded-lg p-1 text-[var(--ink-tertiary)] transition-all hover:bg-[var(--surface)] hover:text-[var(--ink-secondary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Undo2 className="size-3.5" />
                </button>
              </Tip>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  const groupedBlocks = groupBlocks(message.blocks);

  // Only the last BlockGroup is the "active section" during streaming
  const lastBlockGroupIndex = groupedBlocks.findLastIndex((item) => Array.isArray(item));

  // Check if any block is still incomplete (running)
  const hasIncompleteBlocks = message.blocks.some((block) => {
    if (block.type === 'tool_use') return block.status === 'running';
    return false;
  });
  const isAssistantStreaming = !!isStreaming && hasIncompleteBlocks;

  return (
    <div
      className="group/assistant flex flex-col items-start select-none"
      data-chat-search-scope
      data-role="assistant"
      data-message-id={message.id}
    >
      <article className="w-full px-3 py-2">
        <div className="space-y-3">
          {groupedBlocks.map((group, gi) => {
            if (Array.isArray(group)) {
              return (
                <BlockGroup
                  key={`g${gi}`}
                  blocks={group}
                  isLatestActiveSection={gi === lastBlockGroupIndex}
                  isStreaming={isAssistantStreaming || !!isStreaming}
                />
              );
            }
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
              <div key={`b${gi}`} className="w-full max-w-none text-[var(--ink)] select-text">
                <Markdown>{block.text}</Markdown>
              </div>
            );
          })}
        </div>
      </article>
      {/* Turn meta + hover action menu */}
      {showActions && (
        <div className="flex items-center gap-2 mt-1 px-4">
          {message.turnMeta && <TurnMetaDisplay meta={message.turnMeta} />}
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/assistant:opacity-100">
            {copyButton}
            {onRetry && (
              <Tip label="重新生成（从上一条用户消息重新请求）">
                <button
                  type="button"
                  onClick={() => !isStreaming && onRetry(message.id)}
                  disabled={isStreaming}
                  className="rounded-lg p-1 text-[var(--ink-tertiary)] transition-all hover:bg-[var(--surface)] hover:text-[var(--ink-secondary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              </Tip>
            )}
            {onFork && (
              <Tip label={hasSdkUuid ? '从此处分叉新对话（源对话不变）' : '此消息无 SDK 追踪信息，无法分叉'}>
                <button
                  type="button"
                  onClick={() => hasSdkUuid && onFork(message.id)}
                  disabled={!hasSdkUuid}
                  className="rounded-lg p-1 text-[var(--ink-tertiary)] transition-all hover:bg-[var(--surface)] hover:text-[var(--ink-secondary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <GitBranch className="size-3.5" />
                </button>
              </Tip>
            )}
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
 * Group consecutive thinking/tool_use blocks together, merge adjacent text blocks.
 * Text merging prevents split rendering during streaming.
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
    } else if (block.type === 'text') {
      flushGroup();
      // Merge consecutive text blocks into one
      const prev = result[result.length - 1];
      if (prev && !Array.isArray(prev) && prev.type === 'text') {
        result[result.length - 1] = {
          ...prev,
          text: (prev.text || '') + '\n\n' + (block.text || '')
        };
      } else {
        result.push(block);
      }
    } else {
      flushGroup();
      result.push(block);
    }
  }
  flushGroup();

  return result;
}

function areMessagesEqual(prev: Props, next: Props): boolean {
  if (prev.isStreaming !== next.isStreaming) return false;
  if (prev.message === next.message) return true;
  if (prev.message.id !== next.message.id) return false;
  return prev.message.blocks === next.message.blocks;
}

const MessageItem = React.memo(MessageItemInner, areMessagesEqual);
export default MessageItem;
