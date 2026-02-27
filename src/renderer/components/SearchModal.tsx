import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, MessageCircle, Clock } from 'lucide-react';
import { globalApiGetJson } from '../api/apiFetch';
import type { SessionMetadata } from '../../shared/types/session';

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

interface SearchMatch {
  id: string;
  role: string;
  preview: string;
}

interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  matches: SearchMatch[];
}

interface Props {
  onSelectSession: (sessionId: string) => void;
  onClose: () => void;
}

export default function SearchModal({ onSelectSession, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // 加载最近对话
    globalApiGetJson<SessionMetadata[]>('/chat/sessions')
      .then((data) => setRecentSessions(data.slice(0, 10)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();

    const q = query.trim();
    if (!q) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await globalApiGetJson<SearchResult[]>(`/chat/search?q=${encodeURIComponent(q)}`);
        if (!controller.signal.aborted) setResults(data);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [query]);

  const handleSelect = useCallback((sessionId: string) => {
    onSelectSession(sessionId);
    onClose();
  }, [onSelectSession, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center"
      style={{ paddingTop: 80, background: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: 560, maxHeight: 480, background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* 搜索输入框 */}
        <div className="flex items-center gap-3 px-4" style={{ height: 52, borderBottom: '1px solid var(--border)' }}>
          <Search size={16} className="shrink-0 text-[var(--ink-tertiary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索对话内容…"
            className="flex-1 bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)]"
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <X size={14} className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors" />
            </button>
          )}
        </div>

        {/* 结果列表 */}
        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-10 text-[13px] text-[var(--ink-tertiary)]">
              搜索中…
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className="flex items-center justify-center py-10 text-[13px] text-[var(--ink-tertiary)]">
              没有找到相关对话
            </div>
          )}
          {!loading && results.map((r) => (
            <div key={r.sessionId}>
              <button
                onClick={() => handleSelect(r.sessionId)}
                className="w-full text-left px-4 py-3 hover:bg-[var(--hover)] transition-colors"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <MessageCircle size={13} className="shrink-0 text-[var(--accent)]" />
                  <span className="text-[13px] font-semibold text-[var(--ink)] truncate">{r.sessionTitle}</span>
                </div>
                {r.matches.map((m) => (
                  <div
                    key={m.id}
                    className="ml-5 text-[12px] text-[var(--ink-tertiary)] truncate"
                    style={{ marginBottom: 2 }}
                  >
                    <span className="text-[var(--ink-secondary)] mr-1">{m.role === 'user' ? '你' : 'AI'}:</span>
                    {m.preview}
                  </div>
                ))}
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
            </div>
          ))}
          {!query.trim() && recentSessions.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1.5 text-[11px] font-medium text-[var(--ink-tertiary)] flex items-center gap-1.5">
                <Clock size={11} />
                最近对话
              </div>
              {recentSessions.map((s) => (
                <div key={s.id}>
                  <button
                    onClick={() => handleSelect(s.id)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MessageCircle size={13} className="shrink-0 text-[var(--accent)]" />
                      <span className="text-[13px] font-semibold text-[var(--ink)] truncate flex-1">{s.title}</span>
                      <span className="text-[11px] text-[var(--ink-tertiary)] shrink-0">
                        {formatRelativeTime(s.lastActiveAt)}
                      </span>
                    </div>
                  </button>
                  <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
                </div>
              ))}
            </>
          )}
          {!query.trim() && recentSessions.length === 0 && (
            <div className="flex items-center justify-center py-10 text-[13px] text-[var(--ink-tertiary)]">
              暂无对话记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
