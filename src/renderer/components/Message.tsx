import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Puzzle } from 'lucide-react';
import type { Message } from '../types/chat';
import ToolUse from './tools/ToolUse';

interface Props {
  message: Message;
  onOpenUrl?: (url: string) => void;
}

export default function MessageItem({ message, onOpenUrl }: Props) {
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
          if (block.type === 'skill') {
            return (
              <div key={i} className={`flex items-center gap-1.5 rounded-full px-3 py-1 mb-1.5 text-xs font-medium ${
                isUser ? 'bg-white/15 text-white' : 'bg-[var(--hover)] text-[var(--ink-secondary)] border border-[var(--border)]'
              }`}>
                <Puzzle size={12} className="shrink-0" />
                <span>{block.name}</span>
              </div>
            );
          }
          if (block.type === 'image') {
            return (
              <div key={i} className="mb-2">
                <img
                  src={block.base64}
                  alt={block.name}
                  className="max-w-full max-h-64 rounded-lg"
                />
              </div>
            );
          }
          return (
            <div key={i} className={`prose prose-sm max-w-none ${isUser ? '[&_*]:!text-white [&_*]:!bg-transparent [&_code]:!bg-white/20 [&_pre]:!bg-white/10 [&_a]:!text-white/90' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (match) {
                      return (
                        <SyntaxHighlighter
                          language={match[1]}
                          style={isUser ? oneDark : oneLight}
                          PreTag="div"
                          customStyle={{ borderRadius: 8, fontSize: 13 }}
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
                  a({ href, children }) {
                    if (href?.startsWith('http') && onOpenUrl) {
                      return (
                        <a
                          href={href}
                          onClick={(e) => { e.preventDefault(); onOpenUrl(href); }}
                          title={href}
                        >
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

