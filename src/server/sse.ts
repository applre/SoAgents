import type { LogEntry } from '../shared/types/log';

// SSE 客户端注册表
const clients = new Map<string, { send: (event: string, data: string) => void; close: () => void }>();

let _clientCounter = 0;

// 历史日志回放函数（由 logger.ts 注入）
let _replayHistory: (() => LogEntry[]) | null = null;

export function setLogHistoryProvider(fn: () => LogEntry[]): void {
  _replayHistory = fn;
}

export function createSseHandler(): (_req: Request) => Response {
  return (_req: Request) => {
    const clientId = String(++_clientCounter);

    let controller: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        // 注册客户端
        const client = {
          send(event: string, data: string) {
            const chunk = `event: ${event}\ndata: ${data}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          },
          close() {
            try { controller.close(); } catch { /* already closed */ }
            clients.delete(clientId);
          },
        };
        clients.set(clientId, client);

        // 补发 Ring Buffer 中的历史日志
        if (_replayHistory) {
          for (const entry of _replayHistory()) {
            client.send('chat:log', JSON.stringify(entry));
          }
        }

        // 心跳
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(':heartbeat\n\n'));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15000);
      },
      cancel() {
        clients.delete(clientId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  };
}

export function broadcast(event: string, data: unknown): void {
  const payload = data === null ? 'null' : JSON.stringify(data);
  // 关键事件记录 SSE 客户端数和事件类型（排除高频 delta 和 log）
  if (event !== 'chat:thinking-chunk' && event !== 'chat:tool-input-delta' && event !== 'chat:log') {
    console.log(`[SSE] broadcast ${event} → ${clients.size} client(s)`);
  }
  for (const client of clients.values()) {
    client.send(event, payload);
  }
}
