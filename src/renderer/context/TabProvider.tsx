import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TabContext, type TabState } from './TabContext';
import { ConfigContext } from './ConfigContext';
import { SseConnection } from '../api/SseConnection';
import { startSessionSidecar, stopSessionSidecar, getSessionServerUrl, listRunningSidecars } from '../api/tauriClient';
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
  onRunningSessionsChange?: (runningSessions: Set<string>) => void;
  children: ReactNode;
}

const DRAFT_SESSION_KEY = '__draft__';
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

type SessionScopedPayload = {
  sessionId?: string | null;
};

export function TabProvider({ tabId, agentDir, onRunningSessionsChange, children }: Props) {
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
  const [runningSessions, setRunningSessions] = useState<Set<string>>(new Set());

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

  // Per-session maps for SSE connections and server URLs
  const sseMapRef = useRef<Map<string, SseConnection>>(new Map());
  const serverUrlMapRef = useRef<Map<string, string>>(new Map());
  // Track when each session's sidecar was last active (for idle reclaim)
  const lastActivityRef = useRef<Map<string, number>>(new Map());

  const messagesRef = useRef<Message[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);
  const sessionMessagesRef = useRef<Map<string, Message[]>>(new Map());
  const runningSessionsRef = useRef<Set<string>>(new Set());
  const loadReqSeqRef = useRef(0);

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

  const toSessionKey = useCallback((sid: string | null | undefined) => sid ?? DRAFT_SESSION_KEY, []);

  const resolveEventSessionId = useCallback((data: unknown): string | null => {
    if (data && typeof data === 'object') {
      const sid = (data as SessionScopedPayload).sessionId;
      if (typeof sid === 'string' && sid.length > 0) return sid;
    }
    return activeSessionIdRef.current;
  }, []);

  const setMessagesForSession = useCallback((sid: string | null, next: Message[]) => {
    const key = toSessionKey(sid);
    sessionMessagesRef.current.set(key, next);
    if (activeSessionIdRef.current === sid) {
      messagesRef.current = next;
      setMessages(next);
    }
  }, [toSessionKey]);

  const updateMessagesForSession = useCallback(
    (sid: string | null, updater: (prev: Message[]) => Message[]) => {
      const key = toSessionKey(sid);
      const fallback = activeSessionIdRef.current === sid ? messagesRef.current : [];
      const prev = sessionMessagesRef.current.get(key) ?? fallback;
      const next = updater(prev);
      setMessagesForSession(sid, next);
    },
    [setMessagesForSession, toSessionKey]
  );

  const adoptDraftSession = useCallback((sid: string) => {
    if (activeSessionIdRef.current !== null) return;
    const draftMessages = sessionMessagesRef.current.get(DRAFT_SESSION_KEY) ?? messagesRef.current;
    if (!sessionMessagesRef.current.has(sid)) {
      sessionMessagesRef.current.set(sid, draftMessages);
    }
    sessionMessagesRef.current.delete(DRAFT_SESSION_KEY);
    activeSessionIdRef.current = sid;
    setSessionId(sid);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeSessionIdRef.current = sessionId;
  }, [sessionId]);

  // Helper: get the global sidecar URL for session listing
  const getGlobalUrl = useCallback(async (): Promise<string> => {
    if (!isTauri()) return 'http://localhost:3000';
    return invoke<string>('cmd_get_session_server_url', { sessionId: '__global__' }).catch(() => 'http://localhost:3000');
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const globalUrl = await getGlobalUrl();
      const data = await apiGetJson<SessionMetadata[]>(globalUrl, '/chat/sessions');
      setSessions(data.filter((s) => s.agentDir === agentDir));
      setSessionsFetched(true);
    } catch {
      // global sidecar might not be ready
    }
  }, [agentDir, getGlobalUrl]);

  // ── SSE event handler registration for a session sidecar ──
  const registerSseHandlers = useCallback((sse: SseConnection, forSessionId: string) => {
    sse.on('chat:message-chunk', (data) => {
      const chunk = data as SessionScopedPayload & { text?: string };
      const targetSessionId = resolveEventSessionId(chunk) ?? forSessionId;
      const text = chunk.text;
      if (!text) return;
      adoptDraftSession(targetSessionId);
      lastActivityRef.current.set(forSessionId, Date.now());
      updateMessagesForSession(targetSessionId, (prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          const blocks = [...last.blocks];
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock?.type === 'text') {
            blocks[blocks.length - 1] = { type: 'text', text: lastBlock.text + text };
          } else {
            blocks.push({ type: 'text', text });
          }
          return [...prev.slice(0, -1), { ...last, blocks }];
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            blocks: [{ type: 'text', text }],
            createdAt: Date.now(),
          },
        ];
      });
    });

    sse.on('chat:thinking-chunk', (data) => {
      const chunk = data as SessionScopedPayload & { thinking?: string };
      const targetSessionId = resolveEventSessionId(chunk) ?? forSessionId;
      const thinking = chunk.thinking;
      if (!thinking) return;
      adoptDraftSession(targetSessionId);
      updateMessagesForSession(targetSessionId, (prev) => {
        const last = prev[prev.length - 1];
        if (last?.role !== 'assistant') return prev;
        const blocks = [...last.blocks];
        const thinkingIdx = blocks.findIndex((b): b is ContentBlock & { type: 'thinking' } => b.type === 'thinking');
        if (thinkingIdx >= 0) {
          const tb = blocks[thinkingIdx] as { type: 'thinking'; thinking: string };
          blocks[thinkingIdx] = { type: 'thinking', thinking: tb.thinking + thinking };
        } else {
          blocks.unshift({ type: 'thinking', thinking });
        }
        return [...prev.slice(0, -1), { ...last, blocks }];
      });
    });

    sse.on('chat:tool-use-start', (data) => {
      const tool = data as SessionScopedPayload & { name?: string; id?: string };
      const targetSessionId = resolveEventSessionId(tool) ?? forSessionId;
      const toolName = tool.name;
      const toolId = tool.id;
      if (!toolName || !toolId) return;
      adoptDraftSession(targetSessionId);
      updateMessagesForSession(targetSessionId, (prev) => {
        const last = prev[prev.length - 1];
        if (last?.role !== 'assistant') return prev;
        return [
          ...prev.slice(0, -1),
          { ...last, blocks: [...last.blocks, { type: 'tool_use' as const, name: toolName, id: toolId, status: 'running' as const }] },
        ];
      });
    });

    sse.on('chat:tool-input-delta', (data) => {
      const delta = data as SessionScopedPayload & { id?: string; partial_json?: string };
      const targetSessionId = resolveEventSessionId(delta) ?? forSessionId;
      const toolId = delta.id;
      const partial = delta.partial_json;
      if (!toolId || !partial) return;
      adoptDraftSession(targetSessionId);
      updateMessagesForSession(targetSessionId, (prev) => {
        const last = prev[prev.length - 1];
        if (last?.role !== 'assistant') return prev;
        const blocks = last.blocks.map((b) => {
          if (b.type === 'tool_use' && b.id === toolId) {
            return { ...b, input: (b.input ?? '') + partial };
          }
          return b;
        });
        return [...prev.slice(0, -1), { ...last, blocks }];
      });
    });

    sse.on('chat:tool-result', (data) => {
      const result = data as SessionScopedPayload & { id?: string; content?: string; isError?: boolean };
      const targetSessionId = resolveEventSessionId(result) ?? forSessionId;
      const resultId = result.id;
      if (!resultId) return;
      adoptDraftSession(targetSessionId);
      updateMessagesForSession(targetSessionId, (prev) => {
        return prev.map((msg) => {
          if (msg.role !== 'assistant') return msg;
          const blocks = msg.blocks.map((b) => {
            if (b.type === 'tool_use' && b.id === resultId) {
              return {
                ...b,
                result: result.content ?? '',
                status: result.isError ? 'error' as const : 'done' as const,
                isError: Boolean(result.isError),
              };
            }
            return b;
          });
          return { ...msg, blocks };
        });
      });
    });

    sse.on('permission:request', (data) => {
      const req = data as SessionScopedPayload & { toolName: string; toolUseId: string; toolInput: Record<string, unknown> };
      // 只有当前活跃 session 才展示权限弹窗
      if (activeSessionIdRef.current === forSessionId) {
        setPendingPermission({ toolName: req.toolName, toolUseId: req.toolUseId, toolInput: req.toolInput });
      }
    });

    sse.on('question:request', (data) => {
      const req = data as SessionScopedPayload & {
        toolUseId: string;
        questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }>;
      };
      // 只有当前活跃 session 才展示问题弹窗
      if (activeSessionIdRef.current === forSessionId) {
        setPendingQuestion({ toolUseId: req.toolUseId, questions: req.questions });
      }
    });

    sse.on('chat:message-complete', (data) => {
      const evt = data as SessionScopedPayload | null;
      const completedSessionId = resolveEventSessionId(evt) ?? forSessionId;
      if (completedSessionId) adoptDraftSession(completedSessionId);
      if (completedSessionId) {
        runningSessionsRef.current.delete(completedSessionId);
        setRunningSessions(new Set(runningSessionsRef.current));
        lastActivityRef.current.set(forSessionId, Date.now());
      }
      if (completedSessionId && activeSessionIdRef.current === completedSessionId) {
        setIsLoading(false);
        setSessionState('idle');
      }
      refreshSessions().catch(console.error);
    });

    sse.on('chat:message-error', (data) => {
      const evt = data as SessionScopedPayload | null;
      const erroredSessionId = resolveEventSessionId(evt) ?? forSessionId;
      if (erroredSessionId) adoptDraftSession(erroredSessionId);
      if (erroredSessionId) {
        runningSessionsRef.current.delete(erroredSessionId);
        setRunningSessions(new Set(runningSessionsRef.current));
      }
      if (erroredSessionId && activeSessionIdRef.current === erroredSessionId) {
        setIsLoading(false);
        setSessionState('error');
      }
    });

    // ── 统一日志: 接收 Bun/Rust 层日志 ──
    sse.on('chat:log', (data) => {
      const entry = data as LogEntry;
      if (entry && entry.source && entry.level) {
        appendUnifiedLog(entry);
      }
    });
  }, [resolveEventSessionId, adoptDraftSession, updateMessagesForSession, refreshSessions, appendUnifiedLog]);

  // ── ensureSessionSidecar: 按需启动 sidecar + SSE ──
  const ensureSessionSidecar = useCallback(async (sid: string): Promise<string> => {
    // 已有连接，直接返回
    const existingUrl = serverUrlMapRef.current.get(sid);
    if (existingUrl && sseMapRef.current.has(sid)) {
      lastActivityRef.current.set(sid, Date.now());
      return existingUrl;
    }

    // 启动 sidecar
    await startSessionSidecar(sid, agentDir);
    const url = await getSessionServerUrl(sid);
    serverUrlMapRef.current.set(sid, url);

    // 创建 SSE 连接
    const sse = new SseConnection(sid, url);
    sseMapRef.current.set(sid, sse);
    await sse.connect();

    // 注册事件处理器
    registerSseHandlers(sse, sid);

    lastActivityRef.current.set(sid, Date.now());
    return url;
  }, [agentDir, registerSseHandlers]);

  // ── stopSessionSidecarCleanup: 停止 sidecar 并清理 ──
  const stopSessionSidecarCleanup = useCallback(async (sid: string) => {
    const sse = sseMapRef.current.get(sid);
    if (sse) {
      sse.disconnect();
      sseMapRef.current.delete(sid);
    }
    serverUrlMapRef.current.delete(sid);
    lastActivityRef.current.delete(sid);
    runningSessionsRef.current.delete(sid);
    setRunningSessions(new Set(runningSessionsRef.current));
    await stopSessionSidecar(sid).catch(() => {});
  }, []);

  // ── Tab mount: 只做状态重置，不启动 sidecar ──
  useEffect(() => {
    // 工作区切换时重置状态
    setSidecarReady(true); // Tab 就绪不再等 sidecar
    setMessages([]);
    setSessionId(null);
    setSessions([]);
    setSessionsFetched(false);
    setIsLoading(false);
    setSessionState('idle');
    setRunningSessions(new Set());
    messagesRef.current = [];
    activeSessionIdRef.current = null;
    sessionMessagesRef.current.clear();
    sessionMessagesRef.current.set(DRAFT_SESSION_KEY, []);
    runningSessionsRef.current.clear();
    loadReqSeqRef.current = 0;
    sseMapRef.current.clear();
    serverUrlMapRef.current.clear();
    lastActivityRef.current.clear();

    // 获取 session 列表（通过 global sidecar）
    refreshSessions().catch(console.error);

    // 发现运行中的 sidecar 并重连
    listRunningSidecars().then(async (sidecars) => {
      const matching = sidecars.filter(
        (s) => s.agentDir === agentDir && s.sessionId !== '__global__'
      );
      for (const sc of matching) {
        const url = `http://127.0.0.1:${sc.port}`;
        try {
          // 查询 agent 状态
          const state = await apiGetJson<{ isRunning: boolean }>(url, '/agent/state');
          if (state.isRunning) {
            // 重连 SSE
            serverUrlMapRef.current.set(sc.sessionId, url);
            const sse = new SseConnection(sc.sessionId, url);
            sseMapRef.current.set(sc.sessionId, sse);
            await sse.connect();
            registerSseHandlers(sse, sc.sessionId);
            lastActivityRef.current.set(sc.sessionId, Date.now());
            runningSessionsRef.current.add(sc.sessionId);

            // 恢复 pending 请求
            const pending = await apiGetJson<{
              permission: { toolName: string; toolUseId: string; toolInput: Record<string, unknown> } | null;
              question: { toolUseId: string; questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }> } | null;
            }>(url, '/agent/pending-requests').catch(() => ({ permission: null, question: null }));
            if (pending.permission && activeSessionIdRef.current === sc.sessionId) {
              setPendingPermission(pending.permission);
            }
            if (pending.question && activeSessionIdRef.current === sc.sessionId) {
              setPendingQuestion(pending.question);
            }

            // 拉取最新消息
            const msgs = await apiGetJson<Array<{ id: string; role: string; content: string; createdAt: number }>>(url, '/chat/messages');
            sessionMessagesRef.current.set(sc.sessionId, msgs.map(m => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              blocks: [{ type: 'text' as const, text: m.content }],
              createdAt: m.createdAt,
            })));

            // 如果用户正在查看此 session，更新 UI 状态
            if (activeSessionIdRef.current === sc.sessionId) {
              const cached = sessionMessagesRef.current.get(sc.sessionId);
              if (cached) {
                setMessages(cached);
                messagesRef.current = cached;
              }
              setIsLoading(true);
              setSessionState('running');
            }
          } else {
            // Agent 已完成，记录以便空闲回收
            serverUrlMapRef.current.set(sc.sessionId, url);
            lastActivityRef.current.set(sc.sessionId, Date.now());
          }
        } catch { /* sidecar 可能已经退出 */ }
      }
      setRunningSessions(new Set(runningSessionsRef.current));
    }).catch(console.error);

    return () => {
      // Tab unmount: 只断开 SSE 连接，不停止 sidecar（让 Agent 继续运行）
      for (const sse of sseMapRef.current.values()) {
        sse.disconnect();
      }
      sseMapRef.current.clear();
      serverUrlMapRef.current.clear();
      lastActivityRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, agentDir]);

  // ── 定时任务 session 开始/完成时自动发现 sidecar + 刷新 ──
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    listen<{ sessionId: string; workingDirectory: string }>('scheduler:session-started', (event) => {
      if (event.payload.workingDirectory !== agentDir) return;
      const sid = event.payload.sessionId;
      refreshSessions().catch(console.error);
      // 发现并连接定时任务的 sidecar（它使用 sessionId 作为 sidecar ID）
      (async () => {
        try {
          const sidecars = await listRunningSidecars();
          const sc = sidecars.find((s) => s.sessionId === sid);
          if (!sc || sseMapRef.current.has(sid)) return;
          const url = `http://127.0.0.1:${sc.port}`;
          serverUrlMapRef.current.set(sid, url);
          const sse = new SseConnection(sid, url);
          sseMapRef.current.set(sid, sse);
          await sse.connect();
          registerSseHandlers(sse, sid);
          lastActivityRef.current.set(sid, Date.now());
          runningSessionsRef.current.add(sid);
          setRunningSessions(new Set(runningSessionsRef.current));
        } catch { /* sidecar may not be ready yet */ }
      })();
    }).then(fn => unlisteners.push(fn));
    listen<{ sessionId: string; workingDirectory: string }>('scheduler:session-finished', (event) => {
      if (event.payload.workingDirectory !== agentDir) return;
      const finishedSid = event.payload.sessionId;
      refreshSessions().catch(console.error);
      // 标记不再运行
      runningSessionsRef.current.delete(finishedSid);
      setRunningSessions(new Set(runningSessionsRef.current));
      if (activeSessionIdRef.current === finishedSid) {
        setIsLoading(false);
        setSessionState('idle');
      }
      // 如果当前正在查看该 session，清除缓存并重新加载消息
      if (activeSessionIdRef.current === finishedSid) {
        sessionMessagesRef.current.delete(toSessionKey(finishedSid));
        (async () => {
          try {
            const globalUrl = await getGlobalUrl();
            const msgs = await apiGetJson<Array<{ id: string; role: string; content: string; timestamp: string }>>(globalUrl, `/chat/sessions/${finishedSid}/messages`);
            if (activeSessionIdRef.current !== finishedSid) return;
            const formatted = msgs.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              blocks: [{ type: 'text' as const, text: m.content }],
              createdAt: new Date(m.timestamp).getTime(),
            }));
            sessionMessagesRef.current.set(toSessionKey(finishedSid), formatted);
            setMessages(formatted);
            messagesRef.current = formatted;
          } catch { /* ignore */ }
        })();
      }
    }).then(fn => unlisteners.push(fn));
    return () => { unlisteners.forEach(fn => fn()); };
  }, [agentDir, refreshSessions, toSessionKey, getGlobalUrl, registerSseHandlers]);

  // ── runningSessions 变化时通知父组件 ──
  useEffect(() => {
    onRunningSessionsChange?.(runningSessions);
  }, [runningSessions, onRunningSessionsChange]);

  // ── 空闲回收 useEffect ──
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [sid, lastActive] of lastActivityRef.current.entries()) {
        // 跳过活跃 session
        if (sid === activeSessionIdRef.current) continue;
        // 跳过有 running agent 的 session
        if (runningSessionsRef.current.has(sid)) continue;
        // 超过空闲时间
        if (now - lastActive > IDLE_TIMEOUT_MS) {
          console.log(`[TabProvider] Reclaiming idle sidecar for session ${sid.slice(0, 8)}`);
          stopSessionSidecarCleanup(sid).catch(console.error);
        }
      }
    }, IDLE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [stopSessionSidecarCleanup]);

  const sendMessage = useCallback(async (text: string, permissionMode?: string, skills?: { name: string; content: string }[], images?: ChatImage[]) => {
    let currentSessionId = activeSessionIdRef.current;
    // 同一 session 不能同时发两条消息
    if (currentSessionId && runningSessionsRef.current.has(currentSessionId)) {
      return;
    }

    // ── 前端展示用 blocks（用户 Prompt 优先，skill/图片在后） ──
    const blocks: Message['blocks'] = [];
    if (text) {
      blocks.push({ type: 'text', text });
    }
    if (skills?.length) {
      for (const s of skills) {
        blocks.push({ type: 'skill', name: s.name });
      }
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
    updateMessagesForSession(currentSessionId, (prev) => [...prev, userMsg]);
    setIsLoading(true);
    setSessionState('running');

    // ── 后端实际发送的消息（用户文本优先，skill 内容在后） ──
    const skillContents = skills?.map(s => s.content).filter(Boolean) ?? [];
    const backendMessage = [text, ...skillContents].filter(Boolean).join('\n');

    // Build providerEnv from refs (stable, avoids stale closure)
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
          apiProtocol: provider.apiProtocol,
          timeout: provider.config?.timeout,
          disableNonessential: provider.config?.disableNonessential,
        }
      : undefined;

    try {
      // 如果是新 session（无 sessionId），先通过 global sidecar 创建
      if (!currentSessionId) {
        const globalUrl = await getGlobalUrl();
        const createResp = await apiPostJson<{ sessionId: string }>(globalUrl, '/sessions/create', {
          agentDir,
          title: text.slice(0, 50),
        });
        currentSessionId = createResp.sessionId;
        // 将 draft 消息迁移到新 session
        const draftMessages = sessionMessagesRef.current.get(DRAFT_SESSION_KEY) ?? messagesRef.current;
        sessionMessagesRef.current.set(currentSessionId, draftMessages);
        sessionMessagesRef.current.delete(DRAFT_SESSION_KEY);
        activeSessionIdRef.current = currentSessionId;
        setSessionId(currentSessionId);
        refreshSessions().catch(console.error);
      }

      runningSessionsRef.current.add(currentSessionId);
      setRunningSessions(new Set(runningSessionsRef.current));

      // 确保 session sidecar 运行
      const url = await ensureSessionSidecar(currentSessionId);

      const resp = await apiPostJson<{ ok: boolean; sessionId: string | null }>(url, '/chat/send', {
        sessionId: currentSessionId,
        message: backendMessage,
        agentDir,
        providerEnv,
        model: selectedModel,
        permissionMode,
        mcpEnabledServerIds: ws?.mcpEnabledServers,
        images,
      });
      const assignedSessionId = resp.sessionId;
      if (assignedSessionId && assignedSessionId !== currentSessionId) {
        // Server assigned a different session ID (shouldn't happen normally)
        runningSessionsRef.current.add(assignedSessionId);
        setRunningSessions(new Set(runningSessionsRef.current));
      }
    } catch {
      if (currentSessionId) {
        runningSessionsRef.current.delete(currentSessionId);
        setRunningSessions(new Set(runningSessionsRef.current));
      }
      setIsLoading(false);
      setSessionState('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- provider/config refs are stable
  }, [agentDir, refreshSessions, updateMessagesForSession, ensureSessionSidecar, getGlobalUrl]);

  const stopResponse = useCallback(async () => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    const url = serverUrlMapRef.current.get(sid);
    if (!url) return;
    await apiPostJson(url, '/chat/stop', {});
    runningSessionsRef.current.delete(sid);
    setRunningSessions(new Set(runningSessionsRef.current));
    setIsLoading(false);
    setSessionState('idle');
  }, []);

  const resetSession = useCallback(async () => {
    sessionMessagesRef.current.set(toSessionKey(activeSessionIdRef.current), messagesRef.current);
    sessionMessagesRef.current.set(DRAFT_SESSION_KEY, []);
    activeSessionIdRef.current = null;
    setMessages([]);
    messagesRef.current = [];
    setIsLoading(false);
    setSessionState('idle');
    setSessionId(null);
    setPendingPermission(null);
    setPendingQuestion(null);
    await refreshSessions().catch(() => {});
  }, [refreshSessions, toSessionKey]);

  const loadSession = useCallback(async (sid: string) => {
    // 先缓存当前展示会话
    sessionMessagesRef.current.set(toSessionKey(activeSessionIdRef.current), messagesRef.current);

    activeSessionIdRef.current = sid;
    setSessionId(sid);
    setPendingPermission(null);
    setPendingQuestion(null);

    const cached = sessionMessagesRef.current.get(toSessionKey(sid));
    if (cached) {
      setMessages(cached);
      messagesRef.current = cached;
    } else {
      setMessages([]);
      messagesRef.current = [];
    }

    const running = runningSessionsRef.current.has(sid);
    setIsLoading(running);
    setSessionState(running ? 'running' : 'idle');

    // 如果该 session 已有 sidecar 运行（在 sseMapRef 中），直接使用
    if (sseMapRef.current.has(sid)) {
      // SSE 已连接，从 sidecar 获取最新消息
      const url = serverUrlMapRef.current.get(sid);
      if (url && !cached) {
        const reqSeq = ++loadReqSeqRef.current;
        try {
          const msgs = await apiGetJson<Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: number }>>(url, '/chat/messages');
          if (reqSeq !== loadReqSeqRef.current) return;
          const formatted = msgs.map((m) => ({
            id: m.id,
            role: m.role,
            blocks: [{ type: 'text' as const, text: m.content }],
            createdAt: m.createdAt,
          }));
          sessionMessagesRef.current.set(toSessionKey(sid), formatted);
          if (activeSessionIdRef.current === sid) {
            setMessages(formatted);
            messagesRef.current = formatted;
          }
        } catch { /* sidecar might be shutting down */ }
      }
      return;
    }

    // 没有 sidecar 运行，从 global sidecar 的 SessionStore 读取消息
    if (!cached) {
      const reqSeq = ++loadReqSeqRef.current;
      try {
        const globalUrl = await getGlobalUrl();
        const msgs = await apiGetJson<Array<{ id: string; role: string; content: string; timestamp: string }>>(globalUrl, `/chat/sessions/${sid}/messages`).catch(() => [] as Array<{ id: string; role: string; content: string; timestamp: string }>);
        if (reqSeq !== loadReqSeqRef.current) return;
        if (msgs.length > 0) {
          const formatted = msgs.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            blocks: [{ type: 'text' as const, text: m.content }],
            createdAt: new Date(m.timestamp).getTime(),
          }));
          sessionMessagesRef.current.set(toSessionKey(sid), formatted);
          if (activeSessionIdRef.current === sid) {
            setMessages(formatted);
            messagesRef.current = formatted;
          }
        }
      } catch { /* global sidecar might not be ready */ }
    }
  }, [toSessionKey, getGlobalUrl]);

  const deleteSession = useCallback(async (sessionIdToDelete: string) => {
    // 如果正在运行，先停止 sidecar
    await stopSessionSidecarCleanup(sessionIdToDelete).catch(() => {});

    // 通过 global sidecar 删除
    const globalUrl = await getGlobalUrl();
    if (isTauri()) {
      await invoke('cmd_proxy_http', { method: 'DELETE', url: `${globalUrl}/chat/sessions/${sessionIdToDelete}`, headers: {}, body: undefined });
    } else {
      await fetch(`${globalUrl}/chat/sessions/${sessionIdToDelete}`, { method: 'DELETE' });
    }
    sessionMessagesRef.current.delete(toSessionKey(sessionIdToDelete));
    if (activeSessionIdRef.current === sessionIdToDelete) {
      activeSessionIdRef.current = null;
      setSessionId(null);
      setMessages([]);
      messagesRef.current = [];
      setIsLoading(false);
      setSessionState('idle');
    }
    await refreshSessions();
  }, [refreshSessions, toSessionKey, stopSessionSidecarCleanup, getGlobalUrl]);

  const updateSessionTitle = useCallback(async (sessionIdToUpdate: string, title: string) => {
    const globalUrl = await getGlobalUrl();
    if (isTauri()) {
      await invoke('cmd_proxy_http', { method: 'PUT', url: `${globalUrl}/chat/sessions/${sessionIdToUpdate}/title`, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    } else {
      await fetch(`${globalUrl}/chat/sessions/${sessionIdToUpdate}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    }
    await refreshSessions();
  }, [refreshSessions, getGlobalUrl]);

  const apiGet = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function<T>(path: string): Promise<T> {
      // Use global sidecar for API calls
      return getGlobalUrl().then((url) => apiGetJson<T>(url, path));
    },
    [getGlobalUrl]
  );

  const apiPost = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function<T>(path: string, body: unknown): Promise<T> {
      return getGlobalUrl().then((url) => apiPostJson<T>(url, path, body));
    },
    [getGlobalUrl]
  );

  const respondPermission = useCallback(async (toolUseId: string, allow: boolean) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    const url = serverUrlMapRef.current.get(sid);
    if (!url) return;
    await apiPostJson(url, '/chat/permission-response', { toolUseId, allow });
    setPendingPermission(null);
  }, []);

  const respondQuestion = useCallback(async (toolUseId: string, answers: Record<string, string>) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    const url = serverUrlMapRef.current.get(sid);
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
      runningSessions,
      unifiedLogs,
      clearUnifiedLogs,
    }),
    [tabId, agentDir, sessionId, sidecarReady, messages, isLoading, sessionState, sendMessage, stopResponse, resetSession, apiGet, apiPost, pendingPermission, pendingQuestion, respondPermission, respondQuestion, sessions, sessionsFetched, loadSession, deleteSession, updateSessionTitle, refreshSessions, runningSessions, unifiedLogs, clearUnifiedLogs]
  );

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}
