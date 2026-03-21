/**
 * FileActionContext — provides inline-code path checking and context menu actions.
 *
 * Used by markdown InlineCode to detect real file/folder paths in AI output
 * and offer quick actions (open, open-in-finder, copy path).
 *
 * Only provided inside Chat; other pages get null from useFileAction().
 */
import { ExternalLink, FolderOpen, Copy } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useTabApi } from './TabContext';
import ContextMenu from '../components/ContextMenu';
import type { ContextMenuItem } from '../components/ContextMenu';

// ---------- Types ----------

interface PathInfo {
  exists: boolean;
  type: 'file' | 'dir';
}

export interface FileActionContextValue {
  /** Synchronous cache lookup. Returns cached result or null (pending / not yet requested). */
  checkPath: (path: string) => PathInfo | null;
  /** Incremented each time the cache is updated, so consumers can re-render. */
  cacheVersion: number;
  /** Open the context menu for a resolved path. */
  openFileMenu: (x: number, y: number, path: string, pathType: 'file' | 'dir') => void;
}

interface FileActionProviderProps {
  children: ReactNode;
  /** When this value changes, the path cache is cleared (e.g. toolCompleteCount). */
  refreshTrigger?: number;
}

// ---------- Context ----------

const FileActionContext = createContext<FileActionContextValue | null>(null);

export function useFileAction(): FileActionContextValue | null {
  return useContext(FileActionContext);
}

// ---------- Provider ----------

const BATCH_DELAY_MS = 50;

export function FileActionProvider({ children, refreshTrigger }: FileActionProviderProps) {
  const { apiPost } = useTabApi();

  // Stabilise callbacks via refs
  const apiPostRef = useRef(apiPost);
  useEffect(() => { apiPostRef.current = apiPost; });

  // Guard against setState after unmount
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // ---------- Path cache ----------
  const pathCacheRef = useRef<Map<string, PathInfo>>(new Map());
  const pendingPathsRef = useRef<Set<string>>(new Set());
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);

  // Clear cache when refreshTrigger changes
  useEffect(() => {
    pathCacheRef.current.clear();
    pendingPathsRef.current.clear();
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    // 延迟触发重渲染，避免在 effect 中同步 setState
    const t = setTimeout(() => setCacheVersion(v => v + 1), 0);
    return () => clearTimeout(t);
  }, [refreshTrigger]);

  // Clean up batch timer on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    };
  }, []);

  // Flush pending paths to the backend
  const flushPendingPaths = useCallback(() => {
    const paths = Array.from(pendingPathsRef.current);
    pendingPathsRef.current.clear();
    batchTimerRef.current = null;

    if (paths.length === 0) return;

    void (async () => {
      try {
        const resp = await apiPostRef.current<{ results: Record<string, PathInfo> }>(
          '/api/check-paths',
          { paths },
        );
        if (!isMountedRef.current) return;
        if (resp?.results) {
          for (const [p, info] of Object.entries(resp.results)) {
            pathCacheRef.current.set(p, info);
          }
          setCacheVersion(v => v + 1);
        }
      } catch {
        // Silently ignore — paths will stay un-cached and remain as plain <code>
      }
    })();
  }, []);

  const checkPath = useCallback((path: string): PathInfo | null => {
    const cached = pathCacheRef.current.get(path);
    if (cached) return cached;

    // Already queued
    if (pendingPathsRef.current.has(path)) return null;

    // Enqueue
    pendingPathsRef.current.add(path);
    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(flushPendingPaths, BATCH_DELAY_MS);
    }
    return null;
  }, [flushPendingPaths]);

  // ---------- Context menu ----------
  const [menuState, setMenuState] = useState<{
    x: number;
    y: number;
    path: string;
    pathType: 'file' | 'dir';
  } | null>(null);

  const openFileMenu = useCallback((x: number, y: number, path: string, pathType: 'file' | 'dir') => {
    setMenuState({ x, y, path, pathType });
  }, []);

  const closeMenu = useCallback(() => setMenuState(null), []);

  // Build menu items — apiPost used directly via stable ref
  const menuItems = useMemo((): ContextMenuItem[] => {
    if (!menuState) return [];
    const { path, pathType } = menuState;
    const items: ContextMenuItem[] = [];

    items.push({
      label: pathType === 'dir' ? '打开文件夹' : '打开',
      icon: <ExternalLink className="h-4 w-4" />,
      onClick: () => { void apiPost('/api/open-file', { path }); },
    });

    if (pathType === 'file') {
      items.push({
        label: '打开所在文件夹',
        icon: <FolderOpen className="h-4 w-4" />,
        onClick: () => { void apiPost('/api/open-in-finder', { path }); },
      });
    }

    items.push({
      label: '复制路径',
      icon: <Copy className="h-4 w-4" />,
      onClick: () => { navigator.clipboard.writeText(path).catch(() => {}); },
    });

    return items;
  }, [menuState, apiPost]);

  // ---------- Context value ----------
  const contextValue = useMemo<FileActionContextValue>(() => ({
    checkPath,
    cacheVersion,
    openFileMenu,
  }), [checkPath, cacheVersion, openFileMenu]);

  return (
    <FileActionContext.Provider value={contextValue}>
      {children}

      {/* Context menu */}
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={menuItems}
          onClose={closeMenu}
        />
      )}
    </FileActionContext.Provider>
  );
}
