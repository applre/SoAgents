import { useState } from 'react';

interface SearchResult {
  title: string;
  url: string;
}

const COLLAPSED_COUNT = 5;

/** 从 WebSearch 工具的 result 中解析搜索结果列表 */
function parseSearchResults(resultStr: string): SearchResult[] {
  const results: SearchResult[] = [];
  try {
    const parsed = JSON.parse(resultStr);

    // 格式 1: { results: [ "text", { content: [{ title, url }] }, ... ] }
    if (parsed.results && Array.isArray(parsed.results)) {
      for (const item of parsed.results) {
        if (typeof item === 'string') continue;
        if (item && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.title && c.url) results.push({ title: c.title, url: c.url });
          }
        }
        // 格式 2: { results: [{ title, url }] }
        if (typeof item === 'object' && item.title && item.url) {
          results.push({ title: item.title, url: item.url });
        }
      }
    }

    // 格式 3: [{ title, url }]
    if (results.length === 0 && Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.title && item.url) results.push({ title: item.title, url: item.url });
      }
    }
  } catch { /* ignore parse error */ }
  return results;
}

interface Props { input: Record<string, unknown>; result?: string }

export default function WebSearchTool({ input, result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const query = String(input.query ?? '');
  const results = result ? parseSearchResults(result) : [];
  const hasMore = results.length > COLLAPSED_COUNT;
  const visibleResults = expanded ? results : results.slice(0, COLLAPSED_COUNT);

  return (
    <div className="space-y-1">
      {/* 搜索关键词 */}
      <div className="font-mono text-[var(--ink-secondary)]">
        <span className="text-[var(--ink-tertiary)]">搜索: </span>{query}
      </div>

      {/* 搜索结果列表 */}
      {visibleResults.length > 0 && (
        <div className="flex flex-col">
          {visibleResults.map((item, i) => (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-[var(--paper-light)] group"
            >
              <span className="shrink-0 text-[var(--ink-tertiary)]">🌐</span>
              <span className="flex-1 truncate text-[var(--ink-secondary)] group-hover:text-[var(--accent)]">
                {item.title}
              </span>
              <span className="shrink-0 text-[var(--ink-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
            </a>
          ))}
          {hasMore && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="px-1.5 py-1 text-left text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors"
            >
              ▾ 展开剩余 {results.length - COLLAPSED_COUNT} 条
            </button>
          )}
        </div>
      )}

      {/* result 存在但解析不出结构化结果时 fallback */}
      {result && results.length === 0 && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {result}
        </pre>
      )}
    </div>
  );
}
