import { useState, useCallback, useEffect, useRef, useId } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;

function ensureInit() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    fontFamily: 'Inter, -apple-system, sans-serif',
  });
  mermaidInitialized = true;
}

/** 快速校验：内容看起来像合法 mermaid 语法（≥10 字符且含换行） */
function looksLikeValidMermaid(content: string): boolean {
  return content.length >= 10 && content.includes('\n');
}

/** 带超时的 Promise 包装 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Mermaid render timeout (${ms}ms)`)), ms)
    ),
  ]);
}

interface Props {
  children: string;
}

export default function MermaidDiagram({ children }: Props) {
  const id = useId();
  const renderId = `mermaid-${id.replace(/:/g, '-')}`;

  const [lastValidSvg, setLastValidSvg] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const lastValidContentRef = useRef('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const tryRender = useCallback(async (content: string) => {
    const trimmed = content.trim();
    // 内容没变 → 跳过
    if (trimmed === lastValidContentRef.current) return;
    // 不完整 → 跳过
    if (!looksLikeValidMermaid(trimmed)) return;

    ensureInit();
    setIsRendering(true);
    setParseError(null);

    try {
      const { svg } = await withTimeout(mermaid.render(renderId, trimmed), 15_000);
      lastValidContentRef.current = trimmed;
      setLastValidSvg(svg);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Mermaid 渲染失败');
      // 失败时保留上次成功的 SVG
    } finally {
      setIsRendering(false);
      // 清理 mermaid 失败时留下的孤立 DOM 节点
      document.getElementById(renderId)?.remove();
    }
  }, [renderId]);

  // debounce 300ms — 流式输出时不会每个 chunk 都触发渲染
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (children.trim()) tryRender(children);
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [children, tryRender]);

  if (lastValidSvg) {
    return (
      <div className="my-2 overflow-x-auto rounded-lg border border-[var(--border)] bg-white p-4">
        <div dangerouslySetInnerHTML={{ __html: lastValidSvg }} />
        {parseError && (
          <div className="mt-2 text-[11px] text-[var(--error)]">{parseError}</div>
        )}
      </div>
    );
  }

  if (isRendering) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--ink-tertiary)]">
        渲染图表中…
      </div>
    );
  }

  if (parseError) {
    return (
      <div className="my-2 rounded-lg border border-[var(--error)]/20 bg-[var(--error-bg)] p-4">
        <div className="text-[12px] text-[var(--error)]">Mermaid 语法错误</div>
        <pre className="mt-1 text-[11px] text-[var(--ink-tertiary)] whitespace-pre-wrap">{parseError}</pre>
      </div>
    );
  }

  // 初始状态或内容太短
  return null;
}
