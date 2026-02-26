import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TabContext, type TabState } from './TabContext';
import { ConfigContext } from './ConfigContext';
import { SseConnection } from '../api/SseConnection';
import { startTabSidecar, stopTabSidecar, getTabServerUrl } from '../api/tauriClient';
import { apiGetJson, apiPostJson } from '../api/apiFetch';
import { isTauri } from '../utils/env';
import type { Message, ContentBlock, ChatImage } from '../types/chat';
import type { SessionMetadata } from '../../shared/types/session';
import type { LogEntry } from '../../shared/types/log';
import { REACT_LOG_EVENT } from '../utils/frontendLogger';
import { useContext } from 'react';

interface Props {
  tabId: string;
  agentDir: string;
  children: ReactNode;
}

export function TabProvider({ tabId, agentDir, children }: Props) {
  const configCtx = useContext(ConfigContext);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionState, setSessionState] = useState<'idle' | 'running' | 'error'>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<{ toolName: string; toolUseId: string; toolInput: Record<string, unknown> } | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<{
    toolUseId: string;
    questions: Array<{
      question: string;
      header: string;
      options: Array<{ label: string; description: string }>;
      multiSelect: boolean;
    }>;
  } | null>(null);
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [sessionsFetched, setSessionsFetched] = useState(false);
  const [sidecarReady, setSidecarReady] = useState(false);
  const [unifiedLogs, setUnifiedLogs] = useState<LogEntry[]>([]);

  // Refs for stable access in sendMessage callback (avoid stale closure)
  const currentProviderRef = useRef(configCtx?.currentProvider);
  currentProviderRef.current = configCtx?.currentProvider;
  const currentModelRef = useRef(configCtx?.currentModel);
  currentModelRef.current = configCtx?.currentModel;
  const apiKeysRef = useRef(configCtx?.config.apiKeys ?? {});
  apiKeysRef.current = configCtx?.config.apiKeys ?? {};
  const allProvidersRef = useRef(configCtx?.allProviders ?? []);
  allProvidersRef.current = configCtx?.allProviders ?? [];
  const workspacesRef = useRef(configCtx?.workspaces ?? []);
  workspacesRef.current = configCtx?.workspaces ?? [];

  const sseRef = useRef<SseConnection | null>(null);
  const serverUrlRef = useRef<string>('');
  const isNewSessionRef = useRef(false);

  // ── Unified Logs: 监听 React 自定义事件 ──
  const appendUnifiedLog = useCallback((entry: LogEntry) => {
    setUnifiedLogs((prev) => {
      const next = [...prev, entry];
      return next.length > 3000 ? next.slice(-3000) : next;
    });
  }, []);

  const clearUnifiedLogs = useCallback(() => {
    setUnifiedLogs([]);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const entry = (e as CustomEvent<LogEntry>).detail;
      appendUnifiedLog(entry);
    };
    window.addEventListener(REACT_LOG_EVENT, handler);
    return () => window.removeEventListener(REACT_LOG_EVENT, handler);
  }, [appendUnifiedLog]);

  // ── Unified Logs: 监听 Rust 层 Tauri 事件 ──
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<LogEntry>('log:rust', (evt) => {
        appendUnifiedLog(evt.payload);
      }).then((fn) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, [appendUnifiedLog]);

  const refreshSessions = useCallback(async () => {
    const url = serverUrlRef.current;
    if (!url) return;
    const data = await apiGetJson<SessionMetadata[]>(url, '/chat/sessions');
    setSessions(data.filter((s) => s.agentDir === agentDir));
    setSessionsFetched(true);
  }, [agentDir]);

  useEffect(() => {
    let cancelled = false;

    // 工作区切换时重置状态，确保 sidecarReady false→true 能触发下游 effect
    setSidecarReady(false);
    setMessages([]);
    setSessionId(null);
    setSessions([]);
    setSessionsFetched(false);

    const setup = async () => {
      await startTabSidecar(tabId, agentDir);
      if (cancelled) return;

      const url = await getTabServerUrl(tabId);
      if (cancelled) return;

      serverUrlRef.current = url;
      setSidecarReady(true);

      const sse = new SseConnection(tabId, url);
      sseRef.current = sse;
      await sse.connect();

      sse.on('chat:message-chunk', (data) => {
        if (isNewSessionRef.current) return;
        const chunk = data as { text: string };
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            const blocks = [...last.blocks];
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock?.type === 'text') {
              blocks[blocks.length - 1] = { type: 'text', text: lastBlock.text + chunk.text };
            } else {
              blocks.push({ type: 'text', text: chunk.text });
            }
            return [...prev.slice(0, -1), { ...last, blocks }];
          } else {
            return [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                blocks: [{ type: 'text', text: chunk.text }],
                createdAt: Date.now(),
              },
            ];
          }
        });
      });

      sse.on('chat:thinking-chunk', (data) => {
        if (isNewSessionRef.current) return;
        const chunk = data as { thinking: string };
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            const blocks = [...last.blocks];
            const thinkingIdx = blocks.findIndex((b): b is ContentBlock & { type: 'thinking' } => b.type === 'thinking');
            if (thinkingIdx >= 0) {
              const tb = blocks[thinkingIdx] as { type: 'thinking'; thinking: string };
              blocks[thinkingIdx] = { type: 'thinking', thinking: tb.thinking + chunk.thinking };
            } else {
              blocks.unshift({ type: 'thinking', thinking: chunk.thinking });
            }
            return [...prev.slice(0, -1), { ...last, blocks }];
          }
          return prev;
        });
      });

      sse.on('chat:tool-use-start', (data) => {
        if (isNewSessionRef.current) return;
        const tool = data as { name: string; id: string };
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, blocks: [...last.blocks, { type: 'tool_use' as const, name: tool.name, id: tool.id, status: 'running' as const }] },
            ];
          }
          return prev;
        });
      });

      sse.on('chat:tool-input-delta', (data) => {
        if (isNewSessionRef.current) return;
        const delta = data as { id: string; partial_json: string };
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role !== 'assistant') return prev;
          const blocks = last.blocks.map((b) => {
            if (b.type === 'tool_use' && b.id === delta.id) {
              return { ...b, input: (b.input ?? '') + delta.partial_json };
            }
            return b;
          });
          return [...prev.slice(0, -1), { ...last, blocks }];
        });
      });

      sse.on('chat:tool-result', (data) => {
        if (isNewSessionRef.current) return;
        const result = data as { id: string; content: string; isError: boolean };
        setMessages((prev) => {
          const updated = prev.map((msg) => {
            if (msg.role !== 'assistant') return msg;
            const blocks = msg.blocks.map((b) => {
              if (b.type === 'tool_use' && b.id === result.id) {
                return { ...b, result: result.content, status: result.isError ? 'error' as const : 'done' as const, isError: result.isError };
              }
              return b;
            });
            return { ...msg, blocks };
          });
          return updated;
        });
      });

      sse.on('permission:request', (data) => {
        const req = data as { toolName: string; toolUseId: string; toolInput: Record<string, unknown> };
        setPendingPermission(req);
      });

      sse.on('question:request', (data) => {
        const req = data as {
          toolUseId: string;
          questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }>;
        };
        setPendingQuestion(req);
      });

      sse.on('chat:message-complete', () => {
        setIsLoading(false);
        setSessionState('idle');
        refreshSessions().catch(console.error);
      });

      sse.on('chat:message-error', () => {
        setIsLoading(false);
        setSessionState('error');
      });

      // ── 统一日志: 接收 Bun/Rust 层日志 ──
      sse.on('chat:log', (data) => {
        const entry = data as LogEntry;
        if (entry && entry.source && entry.level) {
          appendUnifiedLog(entry);
        }
      });
    };

    setup().catch(console.error);

    return () => {
      cancelled = true;
      sseRef.current?.disconnect();
      sseRef.current = null;
      stopTabSidecar(tabId).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, agentDir]);

  const sendMessage = useCallback(async (text: string, permissionMode?: string, skill?: { name: string; content: string }, images?: ChatImage[]) => {
    const url = serverUrlRef.current;
    if (!url) return;

    isNewSessionRef.current = false;

    // ── 前端展示用 blocks（用户 Prompt 优先，skill/图片在后） ──
    const blocks: Message['blocks'] = [];
    if (text) {
      blocks.push({ type: 'text', text });
    }
    if (skill) {
      blocks.push({ type: 'skill', name: skill.name });
    }
    if (images?.length) {
      for (const img of images) {
        blocks.push({ type: 'image', name: img.name, base64: `data:${img.mimeType};base64,${img.data}` });
      }
    }
    if (blocks.length === 0) {
      blocks.push({ type: 'text', text: '' });
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      blocks,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setSessionState('running');

    // ── 后端实际发送的消息（用户文本优先，skill 内容在后） ──
    const backendMessage = skill
      ? [text, skill.content].filter(Boolean).join('\n')
      : text;

    // Build providerEnv from refs (stable, avoids stale closure)
    // Per-workspace overrides
    const ws = workspacesRef.current.find((w) => w.path === agentDir);
    const wsProviderId = ws?.providerId;
    const provider = wsProviderId
      ? (allProvidersRef.current.find((p) => p.id === wsProviderId) ?? currentProviderRef.current)
      : currentProviderRef.current;
    const keys = apiKeysRef.current;
    const wsModelId = ws?.modelId;
    const selectedModel = wsModelId ?? currentModelRef.current?.model ?? provider?.primaryModel;
    const providerEnv = provider && provider.type === 'api'
      ? {
          baseUrl: provider.config?.baseUrl,
          apiKey: keys[provider.id] ?? '',
          authType: provider.authType,
          timeout: provider.config?.timeout,
          disableNonessential: provider.config?.disableNonessential,
        }
      : undefined;

    try {
      await apiPostJson(url, '/chat/send', {
        message: backendMessage,
        agentDir,
        providerEnv,
        model: selectedModel,
        permissionMode,
        mcpEnabledServerIds: ws?.mcpEnabledServers,
        images,
      });
    } catch {
      setIsLoading(false);
      setSessionState('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- currentProviderRef/currentModelRef/apiKeysRef are refs (stable)
  }, [agentDir]);

  const stopResponse = useCallback(async () => {
    const url = serverUrlRef.current;
    if (!url) return;
    await apiPostJson(url, '/chat/stop', {});
    setIsLoading(false);
    setSessionState('idle');
  }, []);

  const resetSession = useCallback(async () => {
    const url = serverUrlRef.current;
    if (!url) return;
    isNewSessionRef.current = true;
    setMessages([]);
    setIsLoading(false);
    setSessionState('idle');
    setSessionId(null);
    try {
      await apiPostJson(url, '/chat/reset', {});
      await refreshSessions();
    } catch {
      // sidecar 可能未就绪，UI 状态已重置，忽略网络错误
    }
  }, [refreshSessions]);

  const loadSession = useCallback(async (sid: string) => {
    const url = serverUrlRef.current;
    if (!url) return;
    isNewSessionRef.current = true;
    setIsLoading(false);
    setSessionState('idle');
    const resp = await apiPostJson<{ ok: boolean; messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: number }> }>(url, '/chat/load-session', { sessionId: sid });
    const msgs = (resp.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      blocks: [{ type: 'text' as const, text: m.content }],
      createdAt: m.createdAt,
    }));
    setMessages(msgs);
    setSessionId(sid);
    isNewSessionRef.current = false;
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    const url = serverUrlRef.current;
    if (!url) return;
    if (isTauri()) {
      await invoke('cmd_proxy_http', { method: 'DELETE', url: `${url}/chat/sessions/${sessionId}`, headers: {}, body: undefined });
    } else {
      await fetch(`${url}/chat/sessions/${sessionId}`, { method: 'DELETE' });
    }
    await refreshSessions();
  }, [refreshSessions]);

  const updateSessionTitle = useCallback(async (sessionId: string, title: string) => {
    const url = serverUrlRef.current;
    if (!url) return;
    if (isTauri()) {
      await invoke('cmd_proxy_http', { method: 'PUT', url: `${url}/chat/sessions/${sessionId}/title`, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    } else {
      await fetch(`${url}/chat/sessions/${sessionId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    }
    await refreshSessions();
  }, [refreshSessions]);

  const apiGet = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function<T>(path: string): Promise<T> {
      return apiGetJson<T>(serverUrlRef.current, path);
    },
    []
  );

  const apiPost = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function<T>(path: string, body: unknown): Promise<T> {
      return apiPostJson<T>(serverUrlRef.current, path, body);
    },
    []
  );

  const respondPermission = useCallback(async (toolUseId: string, allow: boolean) => {
    const url = serverUrlRef.current;
    if (!url) return;
    await apiPostJson(url, '/chat/permission-response', { toolUseId, allow });
    setPendingPermission(null);
  }, []);

  const respondQuestion = useCallback(async (toolUseId: string, answers: Record<string, string>) => {
    const url = serverUrlRef.current;
    if (!url) return;
    await apiPostJson(url, '/question/respond', { toolUseId, answers });
    setPendingQuestion(null);
  }, []);

  const value = useMemo<TabState>(
    () => ({
      tabId,
      agentDir,
      sessionId,
      sidecarReady,
      messages,
      isLoading,
      sessionState,
      sendMessage,
      stopResponse,
      resetSession,
      apiGet,
      apiPost,
      pendingPermission,
      pendingQuestion,
      respondPermission,
      respondQuestion,
      sessions,
      sessionsFetched,
      loadSession,
      deleteSession,
      updateSessionTitle,
      refreshSessions,
      unifiedLogs,
      clearUnifiedLogs,
    }),
    [tabId, agentDir, sessionId, sidecarReady, messages, isLoading, sessionState, sendMessage, stopResponse, resetSession, apiGet, apiPost, pendingPermission, pendingQuestion, respondPermission, respondQuestion, sessions, sessionsFetched, loadSession, deleteSession, updateSessionTitle, refreshSessions, unifiedLogs, clearUnifiedLogs]
  );

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}
