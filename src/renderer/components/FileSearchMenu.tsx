import { useRef, useEffect } from 'react';
import { FileText, Folder } from 'lucide-react';

export interface FileSearchResult {
  path: string;
  name: string;
  type: 'file' | 'dir';
}

interface Props {
  query: string;
  results: FileSearchResult[];
  selectedIndex: number;
  isSearching: boolean;
  onSelect: (file: FileSearchResult) => void;
}

export default function FileSearchMenu({ query, results, selectedIndex, isSearching, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div
      ref={listRef}
      className="absolute bottom-full mb-1 left-0 right-0 z-40 max-h-48 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--paper)] shadow-md"
    >
      {query.length === 0 ? (
        <div className="px-3 py-2 text-sm text-[var(--ink-tertiary)]">输入文件名搜索...</div>
      ) : isSearching ? (
        <div className="px-3 py-2 text-sm text-[var(--ink-tertiary)]">搜索中...</div>
      ) : results.length === 0 ? (
        <div className="px-3 py-2 text-sm text-[var(--ink-tertiary)]">未找到文件</div>
      ) : (
        results.map((file, i) => (
          <button
            key={file.path}
            ref={i === selectedIndex ? selectedRef : null}
            className={[
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
              i === selectedIndex ? 'bg-[var(--accent-warm)] text-white' : 'text-[var(--ink)] hover:bg-[var(--paper-dark)]',
            ].join(' ')}
            onClick={() => onSelect(file)}
            onMouseEnter={() => {/* handled by parent */}}
          >
            {file.type === 'dir'
              ? <Folder size={14} className="shrink-0" />
              : <FileText size={14} className="shrink-0" />
            }
            <span className="truncate">{file.path}</span>
          </button>
        ))
      )}
    </div>
  );
}
