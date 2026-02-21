import { isTauri } from '../utils/env';
import { invoke } from '@tauri-apps/api/core';

type EventCallback = (data: unknown) => void;

export class SseConnection {
  private unlisteners: Array<() => void> = [];
  private eventSource?: EventSource;
  private callbacks: Map<string, Set<EventCallback>> = new Map();

  constructor(private tabId: string, private serverUrl: string) {}

  async connect(): Promise<void> {
    if (isTauri()) {
      // 通过 Rust 代理连接 SSE
      const sseUrl = `${this.serverUrl}/chat/events`;
      await invoke('cmd_start_sse_proxy', { url: sseUrl, tabId: this.tabId });

      // 监听所有该 tab 的 SSE 事件
      // 由于 Tauri 的 listen 需要精确事件名，我们预先订阅已知事件
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
      ];

      for (const eventName of knownEvents) {
        const tauriEvent = `sse:${this.tabId}:${eventName}`;
        const unlisten = await listen<string>(tauriEvent, (evt) => {
          this.dispatch(eventName, evt.payload);
        });
        this.unlisteners.push(unlisten);
      }
    } else {
      // 浏览器模式：原生 EventSource
      this.eventSource = new EventSource(`${this.serverUrl}/chat/events`);
      // 监听所有事件通过 message（Bun 会发 named events，但 EventSource 需要addEventListener）
      this.eventSource.onmessage = (e) => {
        this.dispatch('message', this.tryParse(e.data));
      };
    }
  }

  on(eventName: string, cb: EventCallback): () => void {
    if (!this.callbacks.has(eventName)) {
      this.callbacks.set(eventName, new Set());
      // 浏览器模式：动态订阅 named event
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
      invoke('cmd_stop_sse_proxy', { tabId: this.tabId }).catch(() => {});
    }
    for (const unlisten of this.unlisteners) unlisten();
    this.unlisteners = [];
    this.eventSource?.close();
    this.callbacks.clear();
  }
}
