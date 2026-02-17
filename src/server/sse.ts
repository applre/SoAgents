// SSE 客户端注册表
const clients = new Map<string, { send: (event: string, data: string) => void; close: () => void }>();

let _clientCounter = 0;

export function createSseHandler(): (req: Request) => Response {
  return (req: Request) => {
    const clientId = String(++_clientCounter);

    let controller: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        // 注册客户端
        clients.set(clientId, {
          send(event, data) {
            const chunk = `event: ${event}\ndata: ${data}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          },
          close() {
            try { controller.close(); } catch {}
            clients.delete(clientId);
          },
        });
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
  for (const client of clients.values()) {
    client.send(event, payload);
  }
}
