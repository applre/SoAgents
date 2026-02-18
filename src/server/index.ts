import { createSseHandler } from './sse';
import { agentSession } from './agent-session';
import * as SessionStore from './SessionStore';
import * as ConfigStore from './ConfigStore';
import * as MCPConfigStore from './MCPConfigStore';
import * as SkillsStore from './SkillsStore';
import { statSync } from 'fs';

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

    // 文件信息
    if (req.method === 'GET' && url.pathname === '/api/file-stat') {
      const filePath = url.searchParams.get('path');
      if (!filePath) return Response.json({ error: 'missing path' }, { status: 400 });
      try {
        const stat = statSync(filePath);
        return Response.json({ size: stat.size });
      } catch {
        return Response.json({ error: 'not found' }, { status: 404 });
      }
    }

    // MCP 路由
    if (req.method === 'GET' && url.pathname === '/api/mcp') {
      return Response.json(MCPConfigStore.getAll());
    }

    if (req.method === 'POST' && url.pathname === '/api/mcp') {
      const body = await req.json() as { id: string } & MCPConfigStore.MCPServerConfig;
      const { id, ...config } = body;
      MCPConfigStore.set(id, config);
      return Response.json({ ok: true });
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/mcp/')) {
      const id = url.pathname.slice('/api/mcp/'.length);
      MCPConfigStore.remove(id);
      return Response.json({ ok: true });
    }

    // Skills 路由
    if (req.method === 'GET' && url.pathname === '/api/skills') {
      const agentDir = url.searchParams.get('agentDir') ?? undefined;
      return Response.json(SkillsStore.list(agentDir));
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/skills/')) {
      const name = decodeURIComponent(url.pathname.slice('/api/skills/'.length));
      const agentDir = url.searchParams.get('agentDir') ?? undefined;
      const skill = SkillsStore.get(name, agentDir);
      if (!skill) return new Response('Not Found', { status: 404 });
      return Response.json(skill);
    }

    if (req.method === 'POST' && url.pathname === '/api/skills') {
      const body = await req.json() as SkillsStore.SkillData;
      SkillsStore.create(body);
      return Response.json({ ok: true });
    }

    if (req.method === 'PUT' && url.pathname.startsWith('/api/skills/')) {
      const name = decodeURIComponent(url.pathname.slice('/api/skills/'.length));
      const body = await req.json() as SkillsStore.SkillData;
      SkillsStore.update(name, body);
      return Response.json({ ok: true });
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/skills/')) {
      const name = decodeURIComponent(url.pathname.slice('/api/skills/'.length));
      const scope = (url.searchParams.get('scope') ?? 'global') as 'global' | 'project';
      const agentDir = url.searchParams.get('agentDir') ?? undefined;
      SkillsStore.deleteSkill(name, scope, agentDir);
      return Response.json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[Sidecar] Bun server listening on port ${port}`);
