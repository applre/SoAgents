import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TabContext, TabApiContext, TabActiveContext, type TabState, type TabApiContextValue } from './TabContext';
import { SseConnection } from '../api/SseConnection';
import { startSessionSidecar, stopSessionSidecar, getSessionServerUrl, listRunningSidecars, cancelBackgroundCompletion, startBackgroundCompletion } from '../api/tauriClient';
import { apiGetJson, apiPostJson, apiPutJson } from '../api/apiFetch';
import { isTauri } from '../utils/env';
import type { Message, ContentBlock, ChatImage, TurnMeta } from '../types/chat';
import type { LogEntry } from '../../shared/types/log';
import type { QueuedMessageInfo } from '../../shared/types/queue';
import type { ProviderEnv } from '../../shared/types/config';
import { REACT_LOG_EVENT } from '../utils/frontendLogger';

/** 服务端返回的附件（含 previewUrl） */
interface ServerAttachment {
  id: string;
  name: string;
  mimeType: string;
  path: string;
  previewUrl?: string;
}

/** 将服务端消息（含 attachments）转换为前端 ContentBlock[] */
function buildBlocksFromServer(content: string, attachments?: ServerAttachment[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (content) {
    blocks.push({ type: 'text' as const, text: content });
  }
  if (attachments?.length) {
    for (const att of attachments) {
      if (att.previewUrl && att.mimeType.startsWith('image/')) {
        blocks.push({ type: 'image' as const, name: att.name, base64: att.previewUrl });
      }
    }
  }
  if (blocks.length === 0) {
    blocks.push({ type: 'text' as const, text: '' });
  }
  return blocks;
}

interface Props {
  tabId: string;
  agentDir: string;
  sessionId?: string | null;
  isActive?: boolean;
  onRunningSessionsChange?: (sessionId: string, running: boolean) => void;
  onGeneratingChange?: (isGenerating: boolean) => void;
  onUnreadChange?: (hasUnread: boolean) => void;
  onSessionIdChange?: (sessionId: string) => void;
  children: ReactNode;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
const AUTO_TITLE_MIN_ROUNDS = 1;

interface TitleRound { user: string; assistant: string }

/** Fire-and-forget title generation via session sidecar */
async function generateSessionTitle(
  postJson: <T>(path: string, body: unknown) => Promise<T>,
  sessionId: string,
  rounds: TitleRound[],
  model: string,
  providerEnv?: ProviderEnv,
): Promise<{ success: boolean; title?: string }> {
  try {
    return await postJson<{ success: boolean; title?: string }>(
      '/api/generate-session-title',
      { sessionId, rounds, model, providerEnv },
    );
  } catch {
    return { success: false };
  }
}

export function TabProvider({ tabId, agentDir, sessionId: propSessionId, isActive = true, onRunningSessionsChange, onGeneratingChange, onUnreadChange, onSessionIdChange, children }: Props) {
  // ── Streaming split: history (stable during streaming) + streaming (updates per SSE chunk) ──
  const [historyMessages, setHistoryMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const streamingMessageRef = useRef<Message | null>(null);

  // Wrapper setter that keeps ref in sync (for use in SSE handlers)
  const updateStreamingMessage = useCallback((updater: Message | null | ((prev: Message | null) => Message | null)) => {
    if (typeof updater === 'function') {
      setStreamingMessage((prev) => {
        const next = updater(prev);
        streamingMessageRef.current = next;
        return next;
      });
    } else {
      streamingMessageRef.current = updater;
      setStreamingMessage(updater);
    }
  }, []);

  // Combined messages view (backward compat)
  const messages = useMemo<Message[]>(() => {
    return streamingMessage ? [...historyMessages, streamingMessage] : historyMessages;
  }, [historyMessages, streamingMessage]);

  const [isLoading, setIsLoading] = useState(false);
  const [sessionState, setSessionState] = useState<'idle' | 'running' | 'stopping' | 'error'>('idle');
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
  const [pendingExitPlanMode, setPendingExitPlanMode] = useState<{ requestId: string; plan?: string } | null>(null);
  const [pendingEnterPlanMode, setPendingEnterPlanMode] = useState<{ requestId: string } | null>(null);
  const [sidecarReady, setSidecarReady] = useState(false);
  const [unifiedLogs, setUnifiedLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [, setQueuedMessages] = useState<QueuedMessageInfo[]>([]);
  const queuedMessagesRef = useRef<QueuedMessageInfo[]>([]);
  // Track queueIds that have already started (queue:started arrived before .then() replaced opt-)
  const startedQueueIdsRef = useRef(new Set<string>());

  // 1:1 model — single SSE connection and server URL per TabProvider
  const sseRef = useRef<SseConnection | null>(null);
  const serverUrlRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(0);

  const historyMessagesRef = useRef<Message[]>([]);
  const sessionIdRef = useRef<string | null>(propSessionId ?? null);
  const isRunningRef = useRef(false);
  // Track whether session was created internally (sendMessage) to skip reload on sessionId prop change
  const sessionCreatedInternallyRef = useRef(false);
  const isStreamingRef = useRef(false);

  // ── Auto-title refs ──
  const autoTitleAttemptedRef = useRef(false);
  const titleRoundsRef = useRef<TitleRound[]>([]);
  // FIFO queue: supports queued sends where user sends B before A completes
  const pendingUserMessagesRef = useRef<string[]>([]);
  const lastCompletedTextRef = useRef('');
  const lastModelRef = useRef<string | undefined>(undefined);
  const lastProviderEnvRef = useRef<ProviderEnv | undefined>(undefined);

  // ── Stopping state refs ──
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionId = propSessionId ?? null;

  // Refs for SSE handler closures (avoid stale closures)
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const onUnreadChangeRef = useRef(onUnreadChange);
  onUnreadChangeRef.current = onUnreadChange;
  const onGeneratingChangeRef = useRef(onGeneratingChange);
  onGeneratingChangeRef.current = onGeneratingChange;
  const onRunningSessionsChangeRef = useRef(onRunningSessionsChange);
  onRunningSessionsChangeRef.current = onRunningSessionsChange;

  // Keep refs in sync
  useEffect(() => {
    historyMessagesRef.current = historyMessages;
  }, [historyMessages]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // ── Move streaming message to history ──
  const moveStreamingToHistory = useCallback(() => {
    const current = streamingMessageRef.current;
    if (current) {
      setHistoryMessages((prev) => [...prev, current]);
      streamingMessageRef.current = null;
      setStreamingMessage(null);
    }
  }, []);

  // ── Recover from stuck streaming state (stop timeout / error) ──
  const recoverStreamingUi = useCallback(() => {
    moveStreamingToHistory();
    isStreamingRef.current = false;
    setIsLoading(false);
    setSessionState('idle');
    isRunningRef.current = false;
    setIsRunning(false);
  }, [moveStreamingToHistory]);

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

  // Helper: get the global sidecar URL
  const getGlobalUrl = useCallback(async (): Promise<string> => {
    if (!isTauri()) return 'http://localhost:3000';
    return invoke<string>('cmd_get_session_server_url', { sessionId: '__global__' }).catch(() => 'http://localhost:3000');
  }, []);

  // ── SSE event handler registration ──
  const registerSseHandlers = useCallback((sse: SseConnection) => {
    sse.on('chat:message-chunk', (data) => {
      const chunk = data as { text?: string };
      const text = chunk.text;
      if (!text) return;
      lastActivityRef.current = Date.now();
      isStreamingRef.current = true;
      lastCompletedTextRef.current += text;
      updateStreamingMessage((prev) => {
        if (prev) {
          const blocks = [...prev.blocks];
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock?.type === 'text') {
            blocks[blocks.length - 1] = { type: 'text', text: lastBlock.text + text };
          } else {
            blocks.push({ type: 'text', text });
          }
          return { ...prev, blocks };
        }
        return {
          id: crypto.randomUUID(),
          role: 'assistant',
          blocks: [{ type: 'text', text }],
          createdAt: Date.now(),
        };
      });
    });

    sse.on('chat:thinking-chunk', (data) => {
      const chunk = data as { thinking?: string };
      const thinking = chunk.thinking;
      if (!thinking) return;
      updateStreamingMessage((prev) => {
        if (!prev) return prev;
        const blocks = [...prev.blocks];
        const thinkingIdx = blocks.findIndex((b): b is ContentBlock & { type: 'thinking' } => b.type === 'thinking');
        if (thinkingIdx >= 0) {
          const tb = blocks[thinkingIdx] as { type: 'thinking'; thinking: string };
          blocks[thinkingIdx] = { type: 'thinking', thinking: tb.thinking + thinking };
        } else {
          blocks.unshift({ type: 'thinking', thinking });
        }
        return { ...prev, blocks };
      });
    });

    sse.on('chat:tool-use-start', (data) => {
      const tool = data as { name?: string; id?: string };
      const toolName = tool.name;
      const toolId = tool.id;
      if (!toolName || !toolId) return;
      updateStreamingMessage((prev) => {
        if (!prev) return prev;
        return { ...prev, blocks: [...prev.blocks, { type: 'tool_use' as const, name: toolName, id: toolId, status: 'running' as const }] };
      });
    });

    sse.on('chat:tool-input-delta', (data) => {
      const delta = data as { id?: string; partial_json?: string };
      const toolId = delta.id;
      const partial = delta.partial_json;
      if (!toolId || !partial) return;
      updateStreamingMessage((prev) => {
        if (!prev) return prev;
        const blocks = prev.blocks.map((b) => {
          if (b.type === 'tool_use' && b.id === toolId) {
            return { ...b, input: (b.input ?? '') + partial };
          }
          return b;
        });
        return { ...prev, blocks };
      });
    });

    sse.on('chat:tool-result', (data) => {
      const result = data as { id?: string; content?: string; isError?: boolean };
      const resultId = result.id;
      if (!resultId) return;
      // tool-result can arrive for streaming message or history messages
      // Try streaming first, then fall back to history
      updateStreamingMessage((prev) => {
        if (!prev) return prev;
        const hasToolBlock = prev.blocks.some((b) => b.type === 'tool_use' && b.id === resultId);
        if (!hasToolBlock) return prev; // not in streaming, will update history below
        const blocks = prev.blocks.map((b) => {
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
        return { ...prev, blocks };
      });
      // Also check history (tool result may arrive after message was moved to history)
      setHistoryMessages((prev) => {
        return prev.map((msg) => {
          if (msg.role !== 'assistant') return msg;
          const hasToolBlock = msg.blocks.some((b) => b.type === 'tool_use' && b.id === resultId);
          if (!hasToolBlock) return msg;
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
      const req = data as { toolName: string; toolUseId: string; toolInput: Record<string, unknown> };
      setPendingPermission({ toolName: req.toolName, toolUseId: req.toolUseId, toolInput: req.toolInput });
    });

    sse.on('question:request', (data) => {
      const req = data as {
        toolUseId: string;
        questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }>;
      };
      setPendingQuestion({ toolUseId: req.toolUseId, questions: req.questions });
    });

    sse.on('exit-plan-mode:request', (data) => {
      const req = data as { requestId: string; plan?: string };
      setPendingExitPlanMode({ requestId: req.requestId, plan: req.plan });
    });

    sse.on('enter-plan-mode:request', (data) => {
      const req = data as { requestId: string };
      setPendingEnterPlanMode({ requestId: req.requestId });
    });

    sse.on('chat:message-complete', (data) => {
      const evt = data as {
        model?: string;
        inputTokens?: number;
        outputTokens?: number;
        cacheReadTokens?: number;
        cacheCreationTokens?: number;
        durationMs?: number;
        toolCount?: number;
      } | null;

      // Attach turnMeta to the streaming message before moving to history
      if (evt && (evt.model || evt.inputTokens || evt.durationMs)) {
        const turnMeta: TurnMeta = {
          model: evt.model,
          inputTokens: evt.inputTokens,
          outputTokens: evt.outputTokens,
          cacheReadTokens: evt.cacheReadTokens,
          cacheCreationTokens: evt.cacheCreationTokens,
          durationMs: evt.durationMs,
          toolCount: evt.toolCount,
        };
        // Update streaming message with turnMeta, then move to history
        const current = streamingMessageRef.current;
        if (current) {
          const finalMsg = { ...current, turnMeta };
          streamingMessageRef.current = null;
          setStreamingMessage(null);
          setHistoryMessages((prev) => [...prev, finalMsg]);
        }
      } else {
        // No turnMeta, just move as-is
        moveStreamingToHistory();
      }

      // Auto-title: collect QA round, fire after 3+ rounds
      const completedUserText = pendingUserMessagesRef.current.shift();
      if (!autoTitleAttemptedRef.current && sessionIdRef.current && completedUserText) {
        titleRoundsRef.current.push({
          user: completedUserText.slice(0, 200),
          assistant: lastCompletedTextRef.current.slice(0, 200),
        });
        if (titleRoundsRef.current.length >= AUTO_TITLE_MIN_ROUNDS) {
          autoTitleAttemptedRef.current = true;
          const sid = sessionIdRef.current;
          const rounds = [...titleRoundsRef.current];
          const model = evt?.model || lastModelRef.current || '';
          const pEnv = lastProviderEnvRef.current;
          const url = serverUrlRef.current;
          if (url) {
            const postJson = <T,>(path: string, body: unknown): Promise<T> => apiPostJson<T>(url, path, body);
            generateSessionTitle(postJson, sid, rounds, model, pEnv).catch(() => {});
          }
        }
      }
      lastCompletedTextRef.current = '';

      isStreamingRef.current = false;
      isRunningRef.current = false;
      setIsRunning(false);
      setIsLoading(false);
      setSessionState('idle');
      lastActivityRef.current = Date.now();

      // Clear stop timeout if any
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }

      // 活跃 tab 完成助手回复 → 更新 lastViewedAt，避免任务中心显示蓝点
      if (isActiveRef.current) {
        const sid = sessionIdRef.current;
        const url = serverUrlRef.current;
        if (sid && url) {
          apiPutJson(url, `/chat/sessions/${sid}/viewed`, {}).catch(() => {});
        }
      }

      // 非活跃 tab 收到完成事件 → 标记未读
      if (!isActiveRef.current) {
        onUnreadChangeRef.current?.(true);
      }
    });

    sse.on('chat:message-stopped', () => {
      moveStreamingToHistory();
      lastCompletedTextRef.current = '';
      isStreamingRef.current = false;
      isRunningRef.current = false;
      setIsRunning(false);
      setIsLoading(false);
      setSessionState('idle');
      // Clear stop timeout since we received confirmation
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
    });

    sse.on('chat:message-error', () => {
      // Move whatever streaming content we have to history
      moveStreamingToHistory();
      lastCompletedTextRef.current = '';
      isStreamingRef.current = false;
      isRunningRef.current = false;
      setIsRunning(false);
      setIsLoading(false);
      setSessionState('error');
      // Clear stop timeout on error too
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
    });

    // ── 队列事件 ──
    sse.on('queue:added', (data) => {
      const evt = data as { queueId: string; text: string };
      if (!evt.queueId) return;
      // Deduplicate: already added by optimistic opt- entry or real entry
      const exists = queuedMessagesRef.current.some((q) => q.queueId === evt.queueId);
      if (exists) return;
      // If an opt- entry exists, the .then() will reconcile — skip SSE duplicate
      if (queuedMessagesRef.current.some((q) => q.queueId.startsWith('opt-'))) return;
      const info: QueuedMessageInfo = { queueId: evt.queueId, text: evt.text, timestamp: Date.now() };
      queuedMessagesRef.current = [...queuedMessagesRef.current, info];
      setQueuedMessages(queuedMessagesRef.current);
    });

    sse.on('queue:started', (data) => {
      const evt = data as { queueId: string; text?: string; userMessage?: { id: string; content: string; attachments?: unknown[] }; midTurnBreak?: boolean };
      if (!evt.queueId) return;
      // Track started IDs to prevent .then() from re-adding
      startedQueueIdsRef.current.add(evt.queueId);
      // Remove both real queueId and any opt- entry
      queuedMessagesRef.current = queuedMessagesRef.current.filter((q) => q.queueId !== evt.queueId && !q.queueId.startsWith('opt-'));
      setQueuedMessages(queuedMessagesRef.current);

      // Mid-turn break: finalize current streaming message into history first
      if (evt.midTurnBreak) {
        moveStreamingToHistory();
      }

      const displayText = evt.userMessage?.content ?? evt.text ?? '';
      const userMsg: Message = {
        id: evt.userMessage?.id ?? crypto.randomUUID(),
        role: 'user',
        blocks: [{ type: 'text', text: displayText }],
        createdAt: Date.now(),
      };
      setHistoryMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setSessionState('running');
      // Clean up started tracking after 5s
      setTimeout(() => startedQueueIdsRef.current.delete(evt.queueId), 5000);
    });

    sse.on('queue:cancelled', (data) => {
      const evt = data as { queueId: string };
      if (!evt.queueId) return;
      queuedMessagesRef.current = queuedMessagesRef.current.filter((q) => q.queueId !== evt.queueId);
      setQueuedMessages(queuedMessagesRef.current);
    });

    // ── 统一日志 ──
    sse.on('chat:log', (data) => {
      const entry = data as LogEntry;
      if (entry && entry.source && entry.level) {
        appendUnifiedLog(entry);
      }
    });
  }, [appendUnifiedLog, updateStreamingMessage, moveStreamingToHistory]);

  // ── ensureSessionSidecar: 按需启动 sidecar + SSE ──
  const ensureSessionSidecar = useCallback(async (sid: string): Promise<string> => {
    // 已有连接，直接返回
    if (serverUrlRef.current && sseRef.current) {
      lastActivityRef.current = Date.now();
      return serverUrlRef.current;
    }

    // 启动 sidecar
    await startSessionSidecar(sid, agentDir);
    const url = await getSessionServerUrl(sid);
    serverUrlRef.current = url;

    // 创建 SSE 连接
    const sse = new SseConnection(sid, url);
    sseRef.current = sse;
    await sse.connect();

    // 注册事件处理器
    registerSseHandlers(sse);

    lastActivityRef.current = Date.now();
    return url;
  }, [agentDir, registerSseHandlers]);

  // ── stopSidecarCleanup: 停止 sidecar 并清理 ──
  const stopSidecarCleanup = useCallback(async () => {
    const sid = sessionIdRef.current;
    const wasRunning = isRunningRef.current;
    if (sseRef.current) {
      sseRef.current.disconnect();
      sseRef.current = null;
    }
    serverUrlRef.current = null;
    lastActivityRef.current = 0;
    isRunningRef.current = false;
    setIsRunning(false);
    if (sid) {
      // AI 正在运行时，启动后台完成而非直接停止
      if (wasRunning) {
        await startBackgroundCompletion(sid).catch(() => {});
      }
      await stopSessionSidecar(sid).catch(() => {});
    }
  }, []);

  // ── Tab mount / sessionId 变化: 初始化，如有 sessionId 则加载消息并尝试重连 ──
  useEffect(() => {
    // 如果 sessionId 是由 sendMessage 内部创建的，跳过重置（消息正在 streaming）
    if (sessionCreatedInternallyRef.current) {
      sessionCreatedInternallyRef.current = false;
      return;
    }

    setSidecarReady(true);
    setHistoryMessages([]);
    updateStreamingMessage(null);
    setIsLoading(false);
    setSessionState('idle');
    setIsRunning(false);
    historyMessagesRef.current = [];
    isRunningRef.current = false;
    isStreamingRef.current = false;
    sseRef.current = null;
    serverUrlRef.current = null;
    lastActivityRef.current = 0;
    // Reset auto-title state for new session
    autoTitleAttemptedRef.current = false;
    titleRoundsRef.current = [];
    pendingUserMessagesRef.current = [];
    lastCompletedTextRef.current = '';
    lastModelRef.current = undefined;
    lastProviderEnvRef.current = undefined;

    if (!sessionId) return;

    // 有 sessionId：加载历史消息 + 发现运行中的 sidecar
    (async () => {
      // 1. 从 global sidecar 加载历史消息
      try {
        const globalUrl = await getGlobalUrl();
        const msgs = await apiGetJson<Array<{ id: string; role: string; content: string; timestamp: string; attachments?: ServerAttachment[]; usage?: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number; model?: string }; durationMs?: number; toolCount?: number }>>(globalUrl, `/chat/sessions/${sessionId}/messages`).catch(() => [] as Array<{ id: string; role: string; content: string; timestamp: string; attachments?: ServerAttachment[]; usage?: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number; model?: string }; durationMs?: number; toolCount?: number }>);
        if (sessionIdRef.current !== sessionId) return; // stale
        if (msgs.length > 0) {
          const formatted = msgs.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            blocks: buildBlocksFromServer(m.content, m.attachments),
            createdAt: new Date(m.timestamp).getTime(),
            ...(m.usage || m.durationMs ? { turnMeta: { model: m.usage?.model, inputTokens: m.usage?.inputTokens, outputTokens: m.usage?.outputTokens, cacheReadTokens: m.usage?.cacheReadTokens, cacheCreationTokens: m.usage?.cacheCreationTokens, durationMs: m.durationMs, toolCount: m.toolCount } as TurnMeta } : {}),
          }));
          setHistoryMessages(formatted);
          historyMessagesRef.current = formatted;
        }
      } catch { /* sidecar may not be ready */ }

      // 2. 发现运行中的 sidecar 并重连
      try {
        // 取消后台完成（如果有），因为用户重新打开了这个 session
        await cancelBackgroundCompletion(sessionId).catch(() => {});

        const sidecars = await listRunningSidecars();
        const sc = sidecars.find((s) => s.sessionId === sessionId && s.agentDir === agentDir);
        if (!sc || sessionIdRef.current !== sessionId) return;

        const url = `http://127.0.0.1:${sc.port}`;
        const state = await apiGetJson<{ isRunning: boolean }>(url, '/agent/state');

        serverUrlRef.current = url;
        const sse = new SseConnection(sessionId, url);
        sseRef.current = sse;
        await sse.connect();
        registerSseHandlers(sse);
        lastActivityRef.current = Date.now();

        if (state.isRunning) {
          isRunningRef.current = true;
          setIsRunning(true);
          setIsLoading(true);
          setSessionState('running');

          // 恢复 pending 请求
          const pending = await apiGetJson<{
            permission: { toolName: string; toolUseId: string; toolInput: Record<string, unknown> } | null;
            question: { toolUseId: string; questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }> } | null;
          }>(url, '/agent/pending-requests').catch(() => ({ permission: null, question: null }));
          if (pending.permission) setPendingPermission(pending.permission);
          if (pending.question) setPendingQuestion(pending.question);

          // 从 sidecar 获取最新消息（覆盖 global sidecar 的历史消息）
          const msgs = await apiGetJson<Array<{ id: string; role: string; content: string; createdAt: number; attachments?: ServerAttachment[]; usage?: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number; model?: string }; durationMs?: number; toolCount?: number }>>(url, '/chat/messages');
          if (sessionIdRef.current !== sessionId) return;
          const formatted = msgs.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            blocks: buildBlocksFromServer(m.content, m.attachments),
            createdAt: m.createdAt,
            ...(m.usage || m.durationMs ? { turnMeta: { model: m.usage?.model, inputTokens: m.usage?.inputTokens, outputTokens: m.usage?.outputTokens, cacheReadTokens: m.usage?.cacheReadTokens, cacheCreationTokens: m.usage?.cacheCreationTokens, durationMs: m.durationMs, toolCount: m.toolCount } as TurnMeta } : {}),
          }));
          setHistoryMessages(formatted);
          historyMessagesRef.current = formatted;
        }
      } catch { /* sidecar 可能已退出 */ }
    })();

    return () => {
      // Tab unmount: 只断开 SSE，不停止 sidecar（让 Agent 继续运行）
      if (sseRef.current) {
        sseRef.current.disconnect();
        sseRef.current = null;
      }
      serverUrlRef.current = null;
      lastActivityRef.current = 0;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, agentDir, sessionId]);

  // ── 定时任务 session 开始/完成时发现 sidecar ──
  useEffect(() => {
    if (!sessionId) return;
    const unlisteners: Array<() => void> = [];
    listen<{ sessionId: string; workingDirectory: string }>('scheduled-task:session-started', (event) => {
      if (event.payload.sessionId !== sessionId) return;
      // 发现并连接定时任务的 sidecar
      (async () => {
        try {
          if (sseRef.current) return; // 已连接
          const sidecars = await listRunningSidecars();
          const sc = sidecars.find((s) => s.sessionId === sessionId);
          if (!sc) return;
          const url = `http://127.0.0.1:${sc.port}`;
          serverUrlRef.current = url;
          const sse = new SseConnection(sessionId, url);
          sseRef.current = sse;
          await sse.connect();
          registerSseHandlers(sse);
          lastActivityRef.current = Date.now();
          isRunningRef.current = true;
          setIsRunning(true);
          setIsLoading(true);
          setSessionState('running');
        } catch { /* sidecar may not be ready yet */ }
      })();
    }).then(fn => unlisteners.push(fn));
    listen<{ sessionId: string; workingDirectory: string }>('scheduled-task:session-finished', (event) => {
      if (event.payload.sessionId !== sessionId) return;
      isRunningRef.current = false;
      setIsRunning(false);
      setIsLoading(false);
      setSessionState('idle');
      // 重新加载消息
      (async () => {
        try {
          const globalUrl = await getGlobalUrl();
          const msgs = await apiGetJson<Array<{ id: string; role: string; content: string; timestamp: string; attachments?: ServerAttachment[]; usage?: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number; model?: string }; durationMs?: number; toolCount?: number }>>(globalUrl, `/chat/sessions/${sessionId}/messages`);
          if (sessionIdRef.current !== sessionId) return;
          const formatted = msgs.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            blocks: buildBlocksFromServer(m.content, m.attachments),
            createdAt: new Date(m.timestamp).getTime(),
            ...(m.usage || m.durationMs ? { turnMeta: { model: m.usage?.model, inputTokens: m.usage?.inputTokens, outputTokens: m.usage?.outputTokens, cacheReadTokens: m.usage?.cacheReadTokens, cacheCreationTokens: m.usage?.cacheCreationTokens, durationMs: m.durationMs, toolCount: m.toolCount } as TurnMeta } : {}),
          }));
          setHistoryMessages(formatted);
          historyMessagesRef.current = formatted;
        } catch { /* ignore */ }
      })();
    }).then(fn => unlisteners.push(fn));
    return () => { unlisteners.forEach(fn => fn()); };
  }, [sessionId, getGlobalUrl, registerSseHandlers]);

  // ── isRunning 变化时通知父组件 ──
  useEffect(() => {
    if (sessionId) {
      onRunningSessionsChangeRef.current?.(sessionId, isRunning);
    }
    onGeneratingChangeRef.current?.(isRunning);
  }, [isRunning, sessionId]);

  // ── 空闲回收 ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (!sessionIdRef.current) return;
      if (isRunningRef.current) return;
      if (!serverUrlRef.current) return;
      const idle = Date.now() - lastActivityRef.current;
      if (idle > IDLE_TIMEOUT_MS) {
        console.log(`[TabProvider] Reclaiming idle sidecar for session ${sessionIdRef.current.slice(0, 8)}`);
        stopSidecarCleanup().catch(console.error);
      }
    }, IDLE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [stopSidecarCleanup]);

  const sendMessage = useCallback(async (text: string, permissionMode?: string, skills?: { name: string; content: string }[], images?: ChatImage[], model?: string, providerEnv?: ProviderEnv, mcpEnabledServerIds?: string[]): Promise<boolean> => {
    let currentSessionId = sessionIdRef.current;
    const wasRunning = isRunningRef.current;

    // ── 前端展示用 blocks ──
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

    // Track user message for auto-title generation (FIFO queue for queued sends)
    if (!autoTitleAttemptedRef.current && text) {
      pendingUserMessagesRef.current.push(text);
    }
    lastModelRef.current = model;
    lastProviderEnvRef.current = providerEnv;

    // Optimistic queue entry: show immediately when AI is busy
    const localQueueId = wasRunning ? `opt-${crypto.randomUUID()}` : null;
    if (localQueueId) {
      const optInfo: QueuedMessageInfo = {
        queueId: localQueueId,
        text,
        images: images?.map((img) => ({
          id: crypto.randomUUID(),
          name: img.name ?? 'image',
          preview: `data:${img.mimeType};base64,${img.data}`,
        })),
        timestamp: Date.now(),
      };
      queuedMessagesRef.current = [...queuedMessagesRef.current, optInfo];
      setQueuedMessages(queuedMessagesRef.current);
    }

    // 非排队时立即显示用户消息（添加到 history，不是 streaming）
    if (!wasRunning) {
      setHistoryMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setSessionState('running');
    }

    // ── 后端实际发送的消息 ──
    const skillContents = skills?.map(s => s.content).filter(Boolean) ?? [];
    const backendMessage = [text, ...skillContents].filter(Boolean).join('\n');

    try {
      // 新 session：先通过 global sidecar 创建
      if (!currentSessionId) {
        const globalUrl = await getGlobalUrl();
        const createResp = await apiPostJson<{ sessionId: string }>(globalUrl, '/sessions/create', {
          agentDir,
          title: text.slice(0, 50),
        });
        currentSessionId = createResp.sessionId;
        sessionIdRef.current = currentSessionId;
        // 标记内部创建，防止 prop 变化时 effect 重置消息
        sessionCreatedInternallyRef.current = true;
        // 通知父组件新 sessionId
        onSessionIdChange?.(currentSessionId);
      }

      if (!wasRunning) {
        isRunningRef.current = true;
        setIsRunning(true);
      }

      // 确保 session sidecar 运行
      const url = await ensureSessionSidecar(currentSessionId);

      const resp = await apiPostJson<{ ok: boolean; sessionId: string | null; queued?: boolean; queueId?: string; error?: string }>(url, '/chat/send', {
        sessionId: currentSessionId,
        message: backendMessage,
        agentDir,
        providerEnv,
        model,
        permissionMode,
        mcpEnabledServerIds,
        images,
      });

      // Backend rejected (queue full, etc.)
      if (!resp.ok) {
        if (localQueueId) {
          queuedMessagesRef.current = queuedMessagesRef.current.filter((q) => q.queueId !== localQueueId);
          setQueuedMessages(queuedMessagesRef.current);
        }
        return false;
      }

      // 排队消息：reconcile optimistic entry with real queueId
      if (resp.queued && resp.queueId) {
        const realQueueId = resp.queueId;
        // Race: queue:started SSE arrived before this .then()
        if (startedQueueIdsRef.current.has(realQueueId)) {
          startedQueueIdsRef.current.delete(realQueueId);
          if (localQueueId) {
            queuedMessagesRef.current = queuedMessagesRef.current.filter((q) => q.queueId !== localQueueId);
            setQueuedMessages(queuedMessagesRef.current);
          }
        } else if (localQueueId) {
          // Replace opt- entry with real queueId + enrich with images
          queuedMessagesRef.current = queuedMessagesRef.current.map((q) =>
            q.queueId === localQueueId ? { ...q, queueId: realQueueId } : q,
          );
          setQueuedMessages(queuedMessagesRef.current);
        } else {
          // No optimistic entry — add real entry (shouldn't normally happen)
          const queuedInfo: QueuedMessageInfo = {
            queueId: realQueueId,
            text,
            images: images?.map((img) => ({
              id: crypto.randomUUID(),
              name: img.name ?? 'image',
              preview: `data:${img.mimeType};base64,${img.data}`,
            })),
            timestamp: Date.now(),
          };
          queuedMessagesRef.current = [...queuedMessagesRef.current, queuedInfo];
          setQueuedMessages(queuedMessagesRef.current);
        }
      } else if (localQueueId) {
        // Message wasn't queued (went through immediately) — remove optimistic entry
        queuedMessagesRef.current = queuedMessagesRef.current.filter((q) => q.queueId !== localQueueId);
        setQueuedMessages(queuedMessagesRef.current);
      }

      return true;
    } catch {
      // Remove optimistic entry on error
      if (localQueueId) {
        queuedMessagesRef.current = queuedMessagesRef.current.filter((q) => q.queueId !== localQueueId);
        setQueuedMessages(queuedMessagesRef.current);
      }
      if (!wasRunning) {
        isRunningRef.current = false;
        setIsRunning(false);
        setIsLoading(false);
        setSessionState('error');
      }
      return false;
    }
  }, [agentDir, ensureSessionSidecar, getGlobalUrl, onSessionIdChange]);

  const stopResponse = useCallback(async () => {
    // Clear any existing stop timeout
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    // Immediately show "stopping" state for instant user feedback
    setSessionState('stopping');

    const url = serverUrlRef.current;
    if (!url) {
      recoverStreamingUi();
      return;
    }

    try {
      const response = await apiPostJson<{ success: boolean; alreadyStopped?: boolean }>(url, '/chat/stop', {});
      if (response.success && response.alreadyStopped) {
        // Nothing was active — restore UI immediately
        isStreamingRef.current = false;
        setIsLoading(false);
        setSessionState(prev => prev === 'stopping' ? 'idle' : prev);
        return;
      }
      // Set 5-second timeout: if SSE confirmation never arrives, force recover
      stopTimeoutRef.current = setTimeout(() => {
        if (isStreamingRef.current) {
          console.warn(`[TabProvider ${tabId}] Stop timeout - forcing UI recovery`);
          recoverStreamingUi();
        }
        setSessionState(prev => prev === 'stopping' ? 'idle' : prev);
        stopTimeoutRef.current = null;
      }, 5000);
    } catch (error) {
      console.error(`[TabProvider ${tabId}] Stop response failed:`, error);
      recoverStreamingUi();
    }
  }, [tabId, recoverStreamingUi]);

  const resetSession = useCallback(async () => {
    setHistoryMessages([]);
    updateStreamingMessage(null);
    historyMessagesRef.current = [];
    setIsLoading(false);
    setSessionState('idle');
    isRunningRef.current = false;
    isStreamingRef.current = false;
    setIsRunning(false);
    setPendingPermission(null);
    setPendingQuestion(null);
    queuedMessagesRef.current = [];
    setQueuedMessages([]);
    // Reset auto-title state
    autoTitleAttemptedRef.current = false;
    titleRoundsRef.current = [];
    pendingUserMessagesRef.current = [];
    lastCompletedTextRef.current = '';
    lastModelRef.current = undefined;
    lastProviderEnvRef.current = undefined;
  }, [updateStreamingMessage]);

  const deleteSession = useCallback(async (sessionIdToDelete: string) => {
    // 停止 sidecar
    if (sessionIdToDelete === sessionIdRef.current) {
      await stopSidecarCleanup().catch(() => {});
    }

    // 通过 global sidecar 删除
    const globalUrl = await getGlobalUrl();
    if (isTauri()) {
      await invoke('cmd_proxy_http', { method: 'DELETE', url: `${globalUrl}/chat/sessions/${sessionIdToDelete}`, headers: {}, body: undefined });
    } else {
      await fetch(`${globalUrl}/chat/sessions/${sessionIdToDelete}`, { method: 'DELETE' });
    }
    if (sessionIdRef.current === sessionIdToDelete) {
      setHistoryMessages([]);
      updateStreamingMessage(null);
      historyMessagesRef.current = [];
      setIsLoading(false);
      setSessionState('idle');
    }
  }, [stopSidecarCleanup, getGlobalUrl, updateStreamingMessage]);

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
  }, [getGlobalUrl]);

  const apiGet = useCallback(
    function<T>(path: string): Promise<T> {
      return getGlobalUrl().then((url) => apiGetJson<T>(url, path));
    },
    [getGlobalUrl]
  );

  const apiPost = useCallback(
    function<T>(path: string, body: unknown): Promise<T> {
      return getGlobalUrl().then((url) => apiPostJson<T>(url, path, body));
    },
    [getGlobalUrl]
  );


  const respondPermission = useCallback(async (toolUseId: string, decision: 'deny' | 'allow_once' | 'always_allow') => {
    const url = serverUrlRef.current;
    if (!url) return;
    await apiPostJson(url, '/chat/permission-response', { toolUseId, decision });
    setPendingPermission(null);
  }, []);

  const respondQuestion = useCallback(async (toolUseId: string, answers: Record<string, string>) => {
    const url = serverUrlRef.current;
    if (!url) return;
    await apiPostJson(url, '/question/respond', { toolUseId, answers });
    setPendingQuestion(null);
  }, []);

  const respondExitPlanMode = useCallback(async (requestId: string, approved: boolean) => {
    const url = serverUrlRef.current;
    if (!url) return;
    await apiPostJson(url, '/chat/exit-plan-mode-response', { requestId, approved });
    setPendingExitPlanMode(null);
  }, []);

  const respondEnterPlanMode = useCallback(async (requestId: string, approved: boolean) => {
    const url = serverUrlRef.current;
    if (!url) return;
    await apiPostJson(url, '/chat/enter-plan-mode-response', { requestId, approved });
    setPendingEnterPlanMode(null);
  }, []);

  // ── TabApiContext: lightweight, stable during streaming ──
  const hasMessages = historyMessages.length > 0 || streamingMessage !== null;
  const apiValue = useMemo<TabApiContextValue>(
    () => ({ tabId, agentDir, sessionId, apiGet, apiPost, hasMessages }),
    [tabId, agentDir, sessionId, apiGet, apiPost, hasMessages]
  );

  // ── TabContext: full state ──
  const value = useMemo<TabState>(
    () => ({
      tabId,
      agentDir,
      sessionId,
      sidecarReady,
      historyMessages,
      streamingMessage,
      messages,
      isLoading,
      sessionState,
      sendMessage,
      stopResponse,
      resetSession,
      pendingPermission,
      pendingQuestion,
      respondPermission,
      respondQuestion,
      pendingExitPlanMode,
      pendingEnterPlanMode,
      respondExitPlanMode,
      respondEnterPlanMode,
      deleteSession,
      updateSessionTitle,
      unifiedLogs,
      clearUnifiedLogs,
    }),
    [tabId, agentDir, sessionId, sidecarReady, historyMessages, streamingMessage, messages, isLoading, sessionState, sendMessage, stopResponse, resetSession, pendingPermission, pendingQuestion, respondPermission, respondQuestion, pendingExitPlanMode, pendingEnterPlanMode, respondExitPlanMode, respondEnterPlanMode, deleteSession, updateSessionTitle, unifiedLogs, clearUnifiedLogs]
  );

  return (
    <TabActiveContext.Provider value={isActive}>
      <TabApiContext.Provider value={apiValue}>
        <TabContext.Provider value={value}>{children}</TabContext.Provider>
      </TabApiContext.Provider>
    </TabActiveContext.Provider>
  );
}
