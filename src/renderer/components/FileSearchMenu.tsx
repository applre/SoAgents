import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileText, Folder, ChevronRight } from 'lucide-react';
import { globalApiGetJson } from '../api/apiFetch';

export interface FileSearchResult {
  path: string;
  name: string;
  type: 'file' | 'dir';
}

interface Props {
  agentDir: string;
  onSelect: (file: FileSearchResult) => void;
  onClose: () => void;
}

interface FlatItem {
  file: FileSearchResult;
  isChild: boolean;
}

export default function FileSearchMenu({ agentDir, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dirFiles, setDirFiles] = useState<FileSearchResult[]>([]);
  const [expandedDir, setExpandedDir] = useState<string | null>(null);
  const [expandedChildren, setExpandedChildren] = useState<FileSearchResult[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const expandedDirRef = useRef<string | null>(null);
  const pendingExpandRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Build flat visible list (browse: root items + inline expanded children; search: flat results)
  const flatItems: FlatItem[] = useMemo(() => {
    if (query) return results.map(file => ({ file, isChild: false }));
    const items: FlatItem[] = [];
    for (const file of dirFiles) {
      items.push({ file, isChild: false });
      if (file.type === 'dir' && file.path === expandedDir) {
        for (const child of expandedChildren) {
          items.push({ file: child, isChild: true });
        }
      }
    }
    return items;
  }, [query, results, dirFiles, expandedDir, expandedChildren]);

  // Derive selectedIndex from selectedPath (stable across expansion changes)
  const selectedIndex = useMemo(() => {
    if (!selectedPath) return 0;
    const idx = flatItems.findIndex(item => item.file.path === selectedPath);
    return idx >= 0 ? idx : 0;
  }, [flatItems, selectedPath]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load root directory on mount
  useEffect(() => {
    if (!agentDir) return;
    (async () => {
      try {
        const files = await globalApiGetJson<FileSearchResult[]>(
          `/api/dir-files?path=${encodeURIComponent(agentDir)}`
        );
        setDirFiles(files);
        if (files.length > 0) {
          setSelectedPath(files[0].path);
          if (files[0].type === 'dir') {
            expandDir(files[0].path);
          }
        }
      } catch {
        setDirFiles([]);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentDir]);

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Click outside to close (use ref to avoid re-registering on every parent render)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const expandDir = useCallback(async (dirPath: string) => {
    if (expandedDirRef.current === dirPath) return;
    expandedDirRef.current = dirPath;
    pendingExpandRef.current = dirPath;
    setExpandedDir(dirPath);
    setExpandedChildren([]);
    try {
      const files = await globalApiGetJson<FileSearchResult[]>(
        `/api/dir-files?path=${encodeURIComponent(dirPath)}`
      );
      if (pendingExpandRef.current === dirPath) {
        setExpandedChildren(files);
      }
    } catch {
      if (pendingExpandRef.current === dirPath) {
        setExpandedDir(null);
        setExpandedChildren([]);
        expandedDirRef.current = null;
      }
    }
  }, []);

  const collapseDir = useCallback(() => {
    expandedDirRef.current = null;
    pendingExpandRef.current = null;
    setExpandedDir(null);
    setExpandedChildren([]);
  }, []);

  // Handle hover/selection: expand dirs inline, collapse when moving to files
  const handleItemFocus = useCallback((item: FlatItem) => {
    setSelectedPath(item.file.path);
    if (query) return;
    if (!item.isChild && item.file.type === 'dir') {
      expandDir(item.file.path);
    } else if (!item.isChild) {
      collapseDir();
    }
    // Children: don't change expansion
  }, [query, expandDir, collapseDir]);

  const searchFiles = useCallback(async (q: string) => {
    if (!agentDir || q.length < 1) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await globalApiGetJson<FileSearchResult[]>(
        `/api/search-files?agentDir=${encodeURIComponent(agentDir)}&q=${encodeURIComponent(q)}`
      );
      setResults(res.slice(0, 20));
      setSelectedPath(res[0]?.path ?? null);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [agentDir]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length === 0) {
      setResults([]);
      setIsSearching(false);
      collapseDir();
      // Reset browse mode selection
      if (dirFiles.length > 0) {
        setSelectedPath(dirFiles[0].path);
        if (dirFiles[0].type === 'dir') {
          expandDir(dirFiles[0].path);
        }
      }
      return;
    }
    collapseDir();
    timerRef.current = setTimeout(() => searchFiles(val), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.min(selectedIndex + 1, flatItems.length - 1);
      const nextItem = flatItems[nextIdx];
      if (nextItem) handleItemFocus(nextItem);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = Math.max(selectedIndex - 1, 0);
      const prevItem = flatItems[prevIdx];
      if (prevItem) handleItemFocus(prevItem);
    } else if (e.key === 'Enter' && flatItems.length > 0) {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) onSelect(item.file);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const relativePath = (fullPath: string) => {
    if (fullPath.startsWith(agentDir)) {
      const rel = fullPath.slice(agentDir.length);
      return rel.startsWith('/') ? rel.slice(1) : rel;
    }
    return fullPath;
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-1 left-0 right-0 z-40 flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--paper)] shadow-lg"
      style={{ maxWidth: '600px', width: '100%' }}
    >
      {/* Search input */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <svg className="h-3.5 w-3.5 shrink-0 text-[var(--ink-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="搜索文件..."
          className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)]"
        />
      </div>

      {/* Single panel file list with inline expansion */}
      <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: '280px' }}>
        {query.length === 0 && dirFiles.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-[var(--ink-tertiary)]">加载中...</div>
        ) : isSearching ? (
          <div className="px-3 py-6 text-center text-xs text-[var(--ink-tertiary)]">搜索中...</div>
        ) : query && results.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-[var(--ink-tertiary)]">未找到文件</div>
        ) : (
          flatItems.map((item, i) => (
            <button
              key={`${item.file.path}-${item.isChild ? 'child' : 'root'}`}
              ref={i === selectedIndex ? selectedRef : null}
              className={[
                'flex w-full items-center gap-2 text-left text-[13px]',
                item.isChild ? 'pl-7 pr-3 py-1.5' : 'px-3 py-1.5',
                i === selectedIndex
                  ? 'bg-[var(--accent-warm)] text-white'
                  : 'text-[var(--ink)] hover:bg-[var(--hover)]',
              ].join(' ')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item.file)}
              onMouseEnter={() => handleItemFocus(item)}
            >
              {item.file.type === 'dir'
                ? <Folder size={14} className="shrink-0 opacity-60" />
                : <FileText size={14} className="shrink-0 opacity-60" />
              }
              <div className="min-w-0 flex-1">
                <div className="truncate">{item.file.name}</div>
                {query && (
                  <div className={`truncate text-[10px] ${i === selectedIndex ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
                    {relativePath(item.file.path)}
                  </div>
                )}
              </div>
              {!query && !item.isChild && item.file.type === 'dir' && (
                <ChevronRight
                  size={12}
                  className={`shrink-0 opacity-40 transition-transform ${expandedDir === item.file.path ? 'rotate-90' : ''}`}
                />
              )}
            </button>
          ))
        )}
      </div>

      {/* Bottom hint bar */}
      <div className="flex items-center gap-3 border-t border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--ink-tertiary)]">
        <span><kbd className="rounded bg-[var(--paper-dark)] px-1 py-0.5 font-mono text-[9px]">↑↓</kbd> 导航</span>
        <span><kbd className="rounded bg-[var(--paper-dark)] px-1 py-0.5 font-mono text-[9px]">Enter</kbd> 选中</span>
        <span><kbd className="rounded bg-[var(--paper-dark)] px-1 py-0.5 font-mono text-[9px]">Esc</kbd> 关闭</span>
      </div>
    </div>
  );
}
