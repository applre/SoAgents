import { useState, useRef, useEffect, useCallback } from 'react';
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

export default function FileSearchMenu({ agentDir, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [dirFiles, setDirFiles] = useState<FileSearchResult[]>([]);
  const [dirPath, setDirPath] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load root directory on mount
  useEffect(() => {
    if (!agentDir) return;
    loadDir(agentDir);
  }, [agentDir]);

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const loadDir = useCallback(async (path: string) => {
    try {
      const files = await globalApiGetJson<FileSearchResult[]>(
        `/api/dir-files?path=${encodeURIComponent(path)}`
      );
      setDirFiles(files);
      setDirPath(path);
    } catch {
      setDirFiles([]);
    }
  }, []);

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
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [agentDir]);

  // Update right panel when selection changes
  useEffect(() => {
    if (query && results.length > 0 && selectedIndex < results.length) {
      const selected = results[selectedIndex];
      const parentDir = selected.type === 'dir'
        ? selected.path
        : selected.path.substring(0, selected.path.lastIndexOf('/')) || agentDir;
      loadDir(parentDir);
    }
  }, [selectedIndex, results, query, agentDir, loadDir]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length === 0) {
      setResults([]);
      setIsSearching(false);
      loadDir(agentDir);
      return;
    }
    timerRef.current = setTimeout(() => searchFiles(val), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = query ? results : dirFiles;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items.length > 0) {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item) {
        if (!query && item.type === 'dir') {
          // In browse mode, enter directory
          loadDir(item.path);
          setSelectedIndex(0);
        } else {
          onSelect(item);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Backspace' && query === '' && dirPath !== agentDir) {
      // Navigate up in browse mode
      e.preventDefault();
      const parentPath = dirPath.substring(0, dirPath.lastIndexOf('/')) || agentDir;
      loadDir(parentPath);
      setSelectedIndex(0);
    }
  };

  // Relative path display helper
  const relativePath = (fullPath: string) => {
    if (fullPath.startsWith(agentDir)) {
      const rel = fullPath.slice(agentDir.length);
      return rel.startsWith('/') ? rel.slice(1) : rel;
    }
    return fullPath;
  };

  const relDirPath = relativePath(dirPath) || '.';

  const leftItems = query ? results : dirFiles;

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

      {/* Two-panel body */}
      <div className="flex" style={{ height: '280px' }}>
        {/* Left panel: search results or directory listing */}
        <div ref={listRef} className="w-[55%] overflow-y-auto border-r border-[var(--border)]">
          {query.length === 0 && dirFiles.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--ink-tertiary)]">加载中...</div>
          ) : isSearching ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--ink-tertiary)]">搜索中...</div>
          ) : query && results.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--ink-tertiary)]">未找到文件</div>
          ) : (
            <>
              {/* Breadcrumb for browse mode */}
              {!query && dirPath !== agentDir && (
                <button
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-[var(--ink-tertiary)] hover:bg-[var(--paper-dark)]"
                  onClick={() => {
                    const parentPath = dirPath.substring(0, dirPath.lastIndexOf('/')) || agentDir;
                    loadDir(parentPath);
                    setSelectedIndex(0);
                  }}
                >
                  <ChevronRight size={10} className="rotate-180" />
                  <span>.. 返回上级</span>
                </button>
              )}
              {leftItems.map((file, i) => (
                <button
                  key={file.path}
                  ref={i === selectedIndex ? selectedRef : null}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                    i === selectedIndex
                      ? 'bg-[var(--accent-warm)] text-white'
                      : 'text-[var(--ink)] hover:bg-[var(--paper-dark)]',
                  ].join(' ')}
                  onClick={() => {
                    if (!query && file.type === 'dir') {
                      loadDir(file.path);
                      setSelectedIndex(0);
                    } else {
                      onSelect(file);
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  {file.type === 'dir'
                    ? <Folder size={14} className="shrink-0 opacity-60" />
                    : <FileText size={14} className="shrink-0 opacity-60" />
                  }
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{file.name}</div>
                    {query && (
                      <div className={`truncate text-[10px] ${i === selectedIndex ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}`}>
                        {relativePath(file.path)}
                      </div>
                    )}
                  </div>
                  {!query && file.type === 'dir' && (
                    <ChevronRight size={12} className="shrink-0 opacity-40" />
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Right panel: directory preview */}
        <div className="w-[45%] overflow-y-auto bg-[var(--paper-dark)]/30">
          <div className="sticky top-0 bg-[var(--paper-dark)]/60 px-3 py-1.5 text-[10px] font-medium text-[var(--ink-tertiary)] backdrop-blur-sm">
            {relDirPath}
          </div>
          {dirFiles.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-[var(--ink-tertiary)]">空目录</div>
          ) : (
            dirFiles.map((file) => {
              const isHighlighted = query && results[selectedIndex]?.path === file.path;
              return (
                <button
                  key={file.path}
                  className={[
                    'flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs',
                    isHighlighted
                      ? 'bg-[var(--accent-warm)]/15 text-[var(--accent-warm)] font-medium'
                      : 'text-[var(--ink-secondary)] hover:bg-[var(--paper-dark)]',
                  ].join(' ')}
                  onClick={() => {
                    if (file.type === 'dir') {
                      loadDir(file.path);
                      setSelectedIndex(0);
                      setQuery('');
                      setResults([]);
                    } else {
                      onSelect(file);
                    }
                  }}
                >
                  {file.type === 'dir'
                    ? <Folder size={12} className="shrink-0 opacity-50" />
                    : <FileText size={12} className="shrink-0 opacity-50" />
                  }
                  <span className="truncate">{file.name}</span>
                </button>
              );
            })
          )}
        </div>
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
