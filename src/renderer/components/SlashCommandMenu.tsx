import { useState, useEffect, useRef } from 'react';

const BUILTIN_COMMANDS = [
  { name: 'clear', description: '清空对话历史', source: 'builtin' as const },
  { name: 'reset', description: '重置当前会话', source: 'builtin' as const },
];

export interface CommandItem {
  name: string;
  description: string;
  source: 'builtin' | 'custom' | 'skill';
  scope?: 'user' | 'project';
}

interface Props {
  query: string;
  onSelect: (cmd: string) => void;
  onClose: () => void;
  skillCommands?: CommandItem[];
}

export default function SlashCommandMenu({ query, onSelect, onClose, skillCommands }: Props) {
  const allCommands: CommandItem[] = [
    ...BUILTIN_COMMANDS,
    ...(skillCommands || []),
  ];
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = allCommands.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setActiveIdx(0);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIdx]) onSelect(filtered[activeIdx].name);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, activeIdx, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full mb-1 left-0 right-0 z-40 max-h-48 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--paper)] shadow-md"
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          className={[
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
            i === activeIdx ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink)] hover:bg-[var(--hover)]',
          ].join(' ')}
          onClick={() => onSelect(cmd.name)}
          onMouseEnter={() => setActiveIdx(i)}
        >
          <span className="font-mono font-medium">/{cmd.name}</span>
          <span className={`text-xs ${i === activeIdx ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
            {cmd.description}
          </span>
          {cmd.source === 'builtin' && (
            <span className={`ml-auto text-xs px-1 rounded ${i === activeIdx ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
              [内置]
            </span>
          )}
          {cmd.source === 'custom' && cmd.scope === 'user' && (
            <span className={`ml-auto text-xs px-1 rounded ${i === activeIdx ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
              [全局]
            </span>
          )}
          {cmd.source === 'custom' && cmd.scope === 'project' && (
            <span className={`ml-auto text-xs px-1 rounded ${i === activeIdx ? 'text-white/70' : 'text-[var(--accent)]'}`}>
              [项目]
            </span>
          )}
          {cmd.source === 'skill' && (
            <span className={`ml-auto text-xs px-1 rounded ${i === activeIdx ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
              [技能]
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
