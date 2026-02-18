import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../types/chat';
import ToolUse from './tools/ToolUse';

interface Props {
  message: Message;
}

export default function MessageItem({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'bg-[var(--accent)] text-white [--tw-prose-body:theme(colors.white)] [--tw-prose-headings:theme(colors.white)] [--tw-prose-code:theme(colors.white)] [--tw-prose-bold:theme(colors.white)] [--tw-prose-links:theme(colors.white)]'
            : 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)]',
        ].join(' ')}
      >
        {message.blocks.map((block, i) => {
          if (block.type === 'thinking') {
            return <ThinkingBlock key={i} text={block.thinking} />;
          }
          if (block.type === 'tool_use') {
            return <ToolUse key={i} block={block} />;
          }
          return (
            <div key={i} className={`prose prose-sm max-w-none ${isUser ? '[&_*]:!text-white [&_code]:bg-white/20 [&_a]:text-white/90' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (match) {
                      return (
                        <SyntaxHighlighter
                          language={match[1]}
                          style={oneLight}
                          PreTag="div"
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      );
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {block.text}
              </ReactMarkdown>
            </div>
          );
        })}
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

