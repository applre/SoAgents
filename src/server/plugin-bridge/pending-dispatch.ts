/**
 * Pending Dispatch State — shared between compat-runtime and Bridge HTTP server.
 *
 * When a plugin provides standard OpenClaw protocol callbacks (dispatcher + replyOptions),
 * the compat-runtime registers a "pending dispatch" and blocks until the AI response
 * completes. The Bridge HTTP endpoints (/stream-chunk, /finalize-stream, etc.) look up
 * the pending dispatch by chatId and route streaming events through the plugin's own
 * callbacks instead of our fallback FeishuStreamingSession.
 */

export interface PendingDispatchCallbacks {
  onPartialReply?: (payload: { text?: string }) => void;
  onReasoningStream?: (payload: { text?: string }) => void;
  sendBlockReply?: (payload: { text?: string }) => boolean;
  sendFinalReply: (payload: { text?: string; isError?: boolean }) => boolean;
}

export interface PendingDispatch {
  chatId: string;
  callbacks: PendingDispatchCallbacks;
  resolve: (result: { queuedFinal: number; counts: Record<string, number> }) => void;
  reject: (error: Error) => void;
  resolved: boolean;
  createdAt: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

const pendingDispatches = new Map<string, PendingDispatch>();

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes safety timeout

export function registerPendingDispatch(
  chatId: string,
  callbacks: PendingDispatchCallbacks,
): Promise<{ queuedFinal: number; counts: Record<string, number> }> {
  // If existing dispatch for this chatId, reject it (superseded)
  const existing = pendingDispatches.get(chatId);
  if (existing && !existing.resolved) {
    existing.resolved = true;
    clearTimeout(existing.timeoutHandle);
    existing.reject(new Error('Superseded by new dispatch'));
    pendingDispatches.delete(chatId);
  }

  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      const pd = pendingDispatches.get(chatId);
      if (pd && !pd.resolved) {
        pd.resolved = true;
        pendingDispatches.delete(chatId);
        console.error(`[pending-dispatch] Timed out after ${TIMEOUT_MS}ms for chatId=${chatId}`);
        pd.reject(new Error(`Pending dispatch timed out after ${TIMEOUT_MS}ms`));
      }
    }, TIMEOUT_MS);

    pendingDispatches.set(chatId, {
      chatId,
      callbacks,
      resolve,
      reject,
      resolved: false,
      createdAt: Date.now(),
      timeoutHandle,
    });
  });
}

export function getPendingDispatch(chatId: string): PendingDispatch | undefined {
  const pd = pendingDispatches.get(chatId);
  return pd && !pd.resolved ? pd : undefined;
}

export function resolvePendingDispatch(
  chatId: string,
  result?: { queuedFinal: number; counts: Record<string, number> },
): void {
  const pd = pendingDispatches.get(chatId);
  if (pd && !pd.resolved) {
    pd.resolved = true;
    clearTimeout(pd.timeoutHandle);
    pendingDispatches.delete(chatId);
    pd.resolve(result ?? { queuedFinal: 1, counts: { final: 1 } });
  }
}

export function rejectPendingDispatch(chatId: string, error: Error): void {
  const pd = pendingDispatches.get(chatId);
  if (pd && !pd.resolved) {
    pd.resolved = true;
    clearTimeout(pd.timeoutHandle);
    pendingDispatches.delete(chatId);
    pd.reject(error);
  }
}

/** Clean up all pending dispatches (for shutdown) */
export function clearAllPendingDispatches(): void {
  for (const [_chatId, pd] of pendingDispatches) {
    if (!pd.resolved) {
      pd.resolved = true;
      clearTimeout(pd.timeoutHandle);
      pd.reject(new Error('Bridge shutting down'));
    }
  }
  pendingDispatches.clear();
}
