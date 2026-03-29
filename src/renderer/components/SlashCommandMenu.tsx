import { useEffect, useRef, useMemo } from 'react';

export interface CommandItem {
  name: string;
  description: string;
  source: 'builtin' | 'custom' | 'skill';
  scope?: 'user' | 'project';
}

interface Props {
  query: string;
  selectedIndex: number;
  onSelect: (cmd: string) => void;
  skillCommands?: CommandItem[];
}

export default function SlashCommandMenu({ query, selectedIndex, onSelect, skillCommands }: Props) {
  const allCommands: CommandItem[] = useMemo(
    () => skillCommands || [],
    [skillCommands],
  );

  const filtered = useMemo(
    () => allCommands.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [allCommands, query],
  );

  const selectedItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full mb-1 left-0 right-0 z-40 max-h-48 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--paper)] shadow-md">
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          ref={i === selectedIndex ? selectedItemRef : null}
          className={[
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
            i === selectedIndex ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink)] hover:bg-[var(--hover)]',
          ].join(' ')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(cmd.name)}
        >
          <span className="font-mono font-medium">/{cmd.name}</span>
          <span className={`text-xs ${i === selectedIndex ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
            {cmd.description}
          </span>
          {cmd.source === 'builtin' && (
            <span className={`ml-auto text-xs px-1 rounded ${i === selectedIndex ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
              [内置]
            </span>
          )}
          {cmd.source === 'custom' && cmd.scope === 'user' && (
            <span className={`ml-auto text-xs px-1 rounded ${i === selectedIndex ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
              [全局]
            </span>
          )}
          {cmd.source === 'custom' && cmd.scope === 'project' && (
            <span className={`ml-auto text-xs px-1 rounded ${i === selectedIndex ? 'text-white/70' : 'text-[var(--accent)]'}`}>
              [项目]
            </span>
          )}
          {cmd.source === 'skill' && (
            <span className={`ml-auto text-xs px-1 rounded ${i === selectedIndex ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
              [技能]
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Helper: compute filtered commands (used by ChatInput for keyboard nav)
export function filterSlashCommands(skillCommands: CommandItem[], query: string): CommandItem[] {
  return (skillCommands || []).filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
}
