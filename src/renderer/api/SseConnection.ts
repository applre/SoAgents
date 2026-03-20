import { isTauri } from '../utils/env';
import { invoke } from '@tauri-apps/api/core';

type EventCallback = (data: unknown) => void;

export class SseConnection {
  private unlisteners: Array<() => void> = [];
  private eventSource?: EventSource;
  private callbacks: Map<string, Set<EventCallback>> = new Map();

  constructor(private sessionId: string, private serverUrl: string) {}

  async connect(): Promise<void> {
    if (isTauri()) {
      const sseUrl = `${this.serverUrl}/chat/events`;
      await invoke('cmd_start_sse_proxy', { url: sseUrl, sessionId: this.sessionId });

      const { listen } = await import('@tauri-apps/api/event');
      const knownEvents = [
        'chat:message-chunk',
        'chat:message-complete',
        'chat:message-error',
        'chat:thinking-start',
        'chat:thinking-chunk',
        'chat:tool-use-start',
        'chat:tool-input-delta',
        'chat:tool-result-complete',
        'chat:tool-result',
        'chat:system-init',
        'chat:status',
        'permission:request',
        'question:request',
        'exit-plan-mode:request',
        'enter-plan-mode:request',
        'chat:log',
      ];

      for (const eventName of knownEvents) {
        const tauriEvent = `sse:${this.sessionId}:${eventName}`;
        const unlisten = await listen<string>(tauriEvent, (evt) => {
          this.dispatch(eventName, evt.payload);
        });
        this.unlisteners.push(unlisten);
      }
    } else {
      this.eventSource = new EventSource(`${this.serverUrl}/chat/events`);
      this.eventSource.onmessage = (e) => {
        this.dispatch('message', this.tryParse(e.data));
      };
    }
  }

  on(eventName: string, cb: EventCallback): () => void {
    if (!this.callbacks.has(eventName)) {
      this.callbacks.set(eventName, new Set());
      if (this.eventSource) {
        this.eventSource.addEventListener(eventName, (e: Event) => {
          const me = e as MessageEvent;
          this.dispatch(eventName, this.tryParse(me.data));
        });
      }
    }
    this.callbacks.get(eventName)!.add(cb);
    return () => this.callbacks.get(eventName)?.delete(cb);
  }

  private dispatch(eventName: string, rawData: unknown): void {
    const cbs = this.callbacks.get(eventName);
    if (!cbs) return;
    const data = typeof rawData === 'string' ? this.tryParse(rawData) : rawData;
    for (const cb of cbs) cb(data);
  }

  private tryParse(s: string): unknown {
    try { return JSON.parse(s); } catch { return s; }
  }

  disconnect(): void {
    if (isTauri()) {
      invoke('cmd_stop_sse_proxy', { sessionId: this.sessionId }).catch(() => {});
    }
    for (const unlisten of this.unlisteners) unlisten();
    this.unlisteners = [];
    this.eventSource?.close();
    this.callbacks.clear();
  }
}
