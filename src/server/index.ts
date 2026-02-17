import { createSseHandler } from './sse';
import { agentSession } from './agent-session';
import * as SessionStore from './SessionStore';
import * as ConfigStore from './ConfigStore';

// Allow SDK to spawn Claude Code subprocess even when launched from inside Claude Code session
delete process.env.CLAUDECODE;

const port = parseInt(process.env.PORT || "3000", 10);

const sseHandler = createSseHandler();

const server = Bun.serve({
  port,
  idleTimeout: 0, // 禁用超时，SSE 长连接需要
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok", port });
    }

    if (req.method === "GET" && url.pathname === "/api/ping") {
      return Response.json({ message: "pong" });
    }

    if (req.method === "GET" && url.pathname === "/chat/events") {
      return sseHandler(req);
    }

    if (req.method === "POST" && url.pathname === "/chat/send") {
      const body = await req.json() as { message: string; agentDir: string; providerEnv?: { baseUrl?: string; apiKey?: string } };
      agentSession.sendMessage(body.message, body.agentDir, body.providerEnv).catch(console.error);
      return Response.json({ ok: true });
    }

    if (req.method === "POST" && url.pathname === "/chat/stop") {
      agentSession.stop();
      return Response.json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/chat/permission-response') {
      const body = await req.json() as { toolUseId: string; allow: boolean };
      agentSession.respondPermission(body.toolUseId, body.allow);
      return Response.json({ ok: true });
    }

    if (req.method === "POST" && url.pathname === "/chat/reset") {
      agentSession.reset();
      return Response.json({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/chat/messages") {
      return Response.json(agentSession.getMessages());
    }

    if (req.method === "GET" && url.pathname === "/agent/state") {
      return Response.json(agentSession.getState());
    }

    if (req.method === 'GET' && url.pathname === '/chat/sessions') {
      return Response.json(agentSession.getSessions());
    }

    if (req.method === 'POST' && url.pathname === '/chat/load-session') {
      const body = await req.json() as { sessionId: string };
      agentSession.loadSession(body.sessionId);
      return Response.json({ ok: true, messages: agentSession.getCurrentMessages() });
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/chat/sessions/')) {
      const sessionId = url.pathname.replace('/chat/sessions/', '');
      SessionStore.deleteSession(sessionId);
      return Response.json({ ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/config') {
      return Response.json(ConfigStore.readConfig());
    }

    if (req.method === 'PUT' && url.pathname === '/config') {
      const body = await req.json() as { currentProviderId?: string; apiKeys?: Record<string, string> };
      const current = ConfigStore.readConfig();
      const updated = {
        currentProviderId: body.currentProviderId ?? current.currentProviderId,
        apiKeys: body.apiKeys ?? current.apiKeys,
      };
      ConfigStore.writeConfig(updated);
      return Response.json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[Sidecar] Bun server listening on port ${port}`);
