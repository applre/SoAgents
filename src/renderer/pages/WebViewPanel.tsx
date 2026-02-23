import { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { isTauri } from '../utils/env';

interface Props {
  url: string;
  visible: boolean;
}

export default function WebViewPanel({ url, visible }: Props) {
  if (isTauri()) {
    return <TauriWebView url={url} visible={visible} />;
  }
  // 浏览器环境 fallback
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <NavBar url={url} onRefresh={() => {}} onOpenExternal={() => window.open(url, '_blank')} />
      <iframe
        src={url}
        className="flex-1 border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        title={url}
        style={{ display: visible ? 'block' : 'none' }}
      />
    </div>
  );
}

// ── Tauri 原生 WebView ──────────────────────────────────────────────

let labelCounter = 0;

function TauriWebView({ url, visible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webviewRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  // 每次 effect 生成唯一 label，避免 StrictMode 下 close 未完成时 label 冲突
  const [refreshKey, setRefreshKey] = useState(0);

  // 创建 WebView
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let wv: any = null;
    const label = `wv-${++labelCounter}`;

    (async () => {
      const { Webview } = await import('@tauri-apps/api/webview');
      const { getCurrentWindow } = await import('@tauri-apps/api/window');

      if (cancelled) return;

      const rect = containerRef.current?.getBoundingClientRect();
      const x = Math.round(rect?.x ?? 0);
      const y = Math.round(rect?.y ?? 0);
      const width = Math.round(rect?.width || 800);
      const height = Math.round(rect?.height || 600);

      wv = new Webview(getCurrentWindow(), label, {
        url,
        x, y, width, height,
      });

      // 等待 tauri://created 或 tauri://error
      await new Promise<void>((resolve, reject) => {
        wv.once('tauri://created', () => resolve());
        wv.once('tauri://error', (e: unknown) => reject(e));
      });

      if (cancelled) { wv.close().catch(() => {}); return; }

      webviewRef.current = wv;
      setReady(true);
    })().catch((err) => {
      console.error('[WebViewPanel] Failed to create webview:', err);
    });

    return () => {
      cancelled = true;
      webviewRef.current = null;
      setReady(false);
      // 延迟 close 确保 Tauri 内部状态一致
      if (wv) {
        wv.close().catch(() => {});
      }
    };
  }, [url, refreshKey]);

  // 位置同步
  useEffect(() => {
    const el = containerRef.current;
    const wv = webviewRef.current;
    if (!el || !wv || !ready) return;

    let positionModule: typeof import('@tauri-apps/api/dpi') | null = null;
    let disposed = false;

    const sync = async () => {
      if (disposed) return;
      if (!positionModule) {
        positionModule = await import('@tauri-apps/api/dpi');
      }
      const { LogicalPosition, LogicalSize } = positionModule;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      try {
        await wv.setPosition(new LogicalPosition(Math.round(rect.x), Math.round(rect.y)));
        await wv.setSize(new LogicalSize(Math.round(rect.width), Math.round(rect.height)));
      } catch { /* webview may be closed */ }
    };

    const ro = new ResizeObserver(() => { sync(); });
    ro.observe(el);
    // 也监听 window scroll（如果内容区有滚动偏移）
    window.addEventListener('resize', sync);
    sync();

    return () => {
      disposed = true;
      ro.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [ready]);

  // 显示/隐藏
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !ready) return;

    (async () => {
      try {
        if (visible) {
          await wv.show();
          // 重新同步位置（切换回来时容器可能已变化）
          const el = containerRef.current;
          if (el) {
            const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi');
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              await wv.setPosition(new LogicalPosition(Math.round(rect.x), Math.round(rect.y)));
              await wv.setSize(new LogicalSize(Math.round(rect.width), Math.round(rect.height)));
            }
          }
        } else {
          await wv.hide();
        }
      } catch { /* webview may be closed */ }
    })();
  }, [visible, ready]);

  // 刷新：销毁重建
  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleOpenExternal = useCallback(async () => {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  }, [url]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <NavBar url={url} onRefresh={handleRefresh} onOpenExternal={handleOpenExternal} />
      {/* 占位 div — WebView 覆盖此区域 */}
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}

// ── 导航栏 ──────────────────────────────────────────────────────────

function NavBar({ url, onRefresh, onOpenExternal }: { url: string; onRefresh: () => void; onOpenExternal: () => void }) {
  return (
    <div
      className="flex items-center gap-2 shrink-0 bg-[var(--surface)] px-3"
      style={{ height: 40, borderBottom: '1px solid var(--border)' }}
    >
      <button
        onClick={onRefresh}
        title="刷新"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
      >
        <RefreshCw size={14} />
      </button>
      <div
        className="flex-1 truncate rounded-md bg-[var(--paper)] px-3 py-1 text-[13px] text-[var(--ink-secondary)] select-all"
        style={{ border: '1px solid var(--border)' }}
        title={url}
      >
        {url}
      </div>
      <button
        onClick={onOpenExternal}
        title="在浏览器中打开"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors"
      >
        <ExternalLink size={14} />
      </button>
    </div>
  );
}
