import { createSseHandler, setLogHistoryProvider } from './sse';
import { getOrCreateRunner, getRunner, getCurrentSessionId, resetState, removeRunner, isRunning, getPendingState, setProxyConfig, respondExitPlanMode, respondEnterPlanMode } from './agent-session';
import * as SessionStore from './SessionStore';
import * as ConfigStore from './ConfigStore';
import * as MCPConfigStore from './MCPConfigStore';
import * as SkillsStore from './SkillsStore';
import { verifyProviderViaSdk, checkAnthropicSubscription, verifySubscription } from './provider-verify';
import { initLogger, getLogHistory } from './logger';
import { appendUnifiedLogBatch } from './UnifiedLogger';
import { isAnalyticsEnabled, trackServer } from './analytics';
import type { PermissionMode } from '../shared/types/permission';
import type { AppConfig, ProviderEnv, Provider, ProviderAuthType } from '../shared/types/config';
import { PROVIDERS, getEffectiveModelAliases } from '../shared/providers';
import type { LogEntry } from '../shared/types/log';
import { statSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, renameSync, rmSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Allow SDK to spawn Claude Code subprocess even when launched from inside Claude Code session
delete process.env.CLAUDECODE;

/** Runtime download URLs for common MCP commands */
const RUNTIME_DOWNLOAD_URLS: Record<string, { name: string; url: string }> = {
  'node':    { name: 'Node.js', url: 'https://nodejs.org/' },
  'npx':     { name: 'Node.js', url: 'https://nodejs.org/' },
  'npm':     { name: 'Node.js', url: 'https://nodejs.org/' },
  'python':  { name: 'Python', url: 'https://www.python.org/downloads/' },
  'python3': { name: 'Python', url: 'https://www.python.org/downloads/' },
  'deno':    { name: 'Deno', url: 'https://deno.land/' },
  'uv':      { name: 'uv (Python 包管理器)', url: 'https://docs.astral.sh/uv/' },
  'uvx':     { name: 'uv (Python 包管理器)', url: 'https://docs.astral.sh/uv/' },
};

function getCommandDownloadInfo(command: string): { runtimeName?: string; downloadUrl?: string } {
  const info = RUNTIME_DOWNLOAD_URLS[command];
  return info ? { runtimeName: info.name, downloadUrl: info.url } : {};
}

// 初始化统一日志系统（拦截 console 方法）
initLogger();
// 连接 Ring Buffer 到 SSE，新客户端连接时补发历史日志
setLogHistoryProvider(getLogHistory);

// 启动时种子化内置 Skills
SkillsStore.seedBundledSkills();

const port = parseInt(process.env.PORT || "3000", 10);

const sseHandler = createSseHandler();

Bun.serve({
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

    // 接收前端批量日志（写入统一日志文件）
    if (req.method === "POST" && url.pathname === "/api/unified-log") {
      const body = await req.json() as { entries: LogEntry[] };
      appendUnifiedLogBatch(body.entries ?? []);
      return Response.json({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/chat/events") {
      return sseHandler(req);
    }

    if (req.method === "POST" && url.pathname === "/chat/send") {
      const body = await req.json() as { message: string; agentDir: string; sessionId?: string; providerEnv?: ProviderEnv; model?: string; permissionMode?: string; mcpEnabledServerIds?: string[]; images?: Array<{ name: string; mimeType: string; data: string }> };
      const VALID_MODES = ['plan', 'acceptEdits', 'bypassPermissions'] as const;
      const mode: PermissionMode = VALID_MODES.includes(body.permissionMode as PermissionMode)
        ? (body.permissionMode as PermissionMode)
        : 'acceptEdits';

      // Auto-resolve providerEnv from config when not provided (e.g. scheduled tasks)
      let resolvedProviderEnv = body.providerEnv;
      let resolvedModel = body.model;
      if (!resolvedProviderEnv) {
        const config = ConfigStore.readConfig();
        const allProviders = [...PROVIDERS, ...(config.customProviders ?? [])];
        const provider = allProviders.find(p => p.id === config.currentProviderId);
        if (provider && provider.type !== 'subscription') {
          const apiKey = config.apiKeys?.[provider.id];
          if (apiKey) {
            resolvedProviderEnv = {
              baseUrl: provider.config?.baseUrl as string | undefined,
              apiKey,
              authType: provider.authType as ProviderAuthType | undefined,
              apiProtocol: provider.apiProtocol,
              timeout: provider.config?.timeout as number | undefined,
              disableNonessential: provider.config?.disableNonessential as boolean | undefined,
              maxOutputTokens: provider.maxOutputTokens,
              upstreamFormat: provider.upstreamFormat,
              modelAliases: getEffectiveModelAliases(provider, config.providerModelAliases),
            };
          }
        }
        // Also auto-resolve model if not provided
        if (!resolvedModel && config.currentModelId) {
          resolvedModel = config.currentModelId;
        } else if (!resolvedModel && provider?.primaryModel) {
          resolvedModel = provider.primaryModel;
        }
        if (resolvedProviderEnv || provider?.type === 'subscription') {
          console.log(`[chat/send] Auto-resolved provider: ${provider?.id ?? 'unknown'}, model: ${resolvedModel ?? 'default'}`);
        }
      }

      let sessionId = body.sessionId ?? null;
      if (!sessionId) {
        const session = SessionStore.createSession(body.agentDir, body.message.slice(0, 50));
        sessionId = session.id;
      }
      const runner = getOrCreateRunner(sessionId);
      const sendResult = await runner.sendMessage(body.message, body.agentDir, resolvedProviderEnv, resolvedModel, mode, body.mcpEnabledServerIds, body.images);
      if (!sendResult.ok) {
        return Response.json({ ok: false, error: sendResult.error }, { status: 429 });
      }
      return Response.json({ ok: true, sessionId, queued: sendResult.queued, queueId: sendResult.queueId });
    }

    if (req.method === 'POST' && url.pathname === '/chat/queue/cancel') {
      const body = await req.json() as { queueId: string };
      const r = getRunner();
      if (!r) return Response.json({ ok: false, error: 'no_session' });
      const result = r.cancelQueueItem(body.queueId);
      return Response.json(result);
    }

    if (req.method === 'POST' && url.pathname === '/chat/queue/force') {
      const body = await req.json() as { queueId: string };
      const r = getRunner();
      if (!r) return Response.json({ ok: false });
      const ok = r.forceExecuteQueueItem(body.queueId);
      return Response.json({ ok });
    }

    if (req.method === 'GET' && url.pathname === '/chat/queue/status') {
      const r = getRunner();
      if (!r) return Response.json([]);
      return Response.json(r.getQueueStatus());
    }

    if (req.method === "POST" && url.pathname === "/chat/stop") {
      await req.json().catch(() => ({}));
      getRunner()?.stop();
      return Response.json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/chat/permission-response') {
      const body = await req.json() as { toolUseId: string; decision: 'deny' | 'allow_once' | 'always_allow' };
      getRunner()?.respondPermission(body.toolUseId, body.decision);
      return Response.json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/question/respond') {
      const body = await req.json() as { toolUseId: string; answers: Record<string, string> };
      getRunner()?.respondQuestion(body.toolUseId, body.answers);
      return Response.json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/chat/exit-plan-mode-response') {
      const body = await req.json() as { requestId: string; approved: boolean };
      respondExitPlanMode(body.requestId, body.approved);
      return Response.json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/chat/enter-plan-mode-response') {
      const body = await req.json() as { requestId: string; approved: boolean };
      respondEnterPlanMode(body.requestId, body.approved);
      return Response.json({ ok: true });
    }

    if (req.method === "POST" && url.pathname === "/chat/reset") {
      resetState();
      return Response.json({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/chat/messages") {
      const sid = getCurrentSessionId();
      if (!sid) return Response.json([]);
      const msgs = SessionStore.getSessionMessages(sid);
      return Response.json(msgs.map((m: import('../shared/types/session').SessionMessage) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.timestamp).getTime(),
        ...(m.usage ? { usage: m.usage } : {}),
        ...(m.durationMs ? { durationMs: m.durationMs } : {}),
        ...(m.toolCount ? { toolCount: m.toolCount } : {}),
      })));
    }

    if (req.method === 'GET' && url.pathname === '/agent/pending-requests') {
      return Response.json(getPendingState());
    }

    if (req.method === "GET" && url.pathname === "/agent/state") {
      const sid = getCurrentSessionId();
      return Response.json({
        sessionId: sid,
        isRunning: isRunning(),
        runningSessionIds: isRunning() && sid ? [sid] : [],
      });
    }

    if (req.method === 'GET' && url.pathname === '/chat/sessions') {
      const agentDir = url.searchParams.get('agentDir');
      const all = SessionStore.listSessions();
      return Response.json(agentDir ? all.filter(s => s.agentDir === agentDir) : all);
    }

    if (req.method === 'GET' && url.pathname === '/chat/search') {
      const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
      if (!q) return Response.json([]);
      const agentDir = url.searchParams.get('agentDir');
      const allSessions = SessionStore.listSessions();
      const sessions = agentDir ? allSessions.filter(s => s.agentDir === agentDir) : allSessions;
      const results: { sessionId: string; sessionTitle: string; matches: { id: string; role: string; preview: string }[] }[] = [];
      for (const s of sessions) {
        try {
          const messages = SessionStore.getSessionMessages(s.id);
          const matches = messages
            .filter((m) => m.content.toLowerCase().includes(q))
            .slice(0, 3)
            .map((m) => {
              const idx = m.content.toLowerCase().indexOf(q);
              const start = Math.max(0, idx - 40);
              const end = Math.min(m.content.length, idx + q.length + 60);
              const preview = (start > 0 ? '…' : '') + m.content.slice(start, end) + (end < m.content.length ? '…' : '');
              return { id: m.id, role: m.role, preview };
            });
          if (matches.length > 0) results.push({ sessionId: s.id, sessionTitle: s.title || '未命名对话', matches });
        } catch { /* skip */ }
      }
      return Response.json(results);
    }

    if (req.method === 'POST' && url.pathname === '/sessions/create') {
      const body = await req.json() as { agentDir: string; title?: string };
      const session = SessionStore.createSession(body.agentDir, body.title);
      return Response.json({ sessionId: session.id });
    }

    if (req.method === 'GET' && url.pathname.match(/^\/chat\/sessions\/[^/]+\/messages$/)) {
      const sessionId = url.pathname.split('/')[3];
      try {
        const msgs = SessionStore.getSessionMessages(sessionId);
        return Response.json(msgs);
      } catch {
        return Response.json([]);
      }
    }

    if (req.method === 'PUT' && url.pathname.match(/^\/chat\/sessions\/[^/]+\/archive$/)) {
      const sessionId = url.pathname.split('/')[3];
      if (getCurrentSessionId() === sessionId) {
        removeRunner();
      }
      SessionStore.archiveSession(sessionId);
      return Response.json({ ok: true });
    }

    if (req.method === 'PUT' && url.pathname.match(/^\/chat\/sessions\/[^/]+\/unarchive$/)) {
      const sessionId = url.pathname.split('/')[3];
      SessionStore.unarchiveSession(sessionId);
      return Response.json({ ok: true });
    }

    if (req.method === 'PUT' && url.pathname.match(/^\/chat\/sessions\/[^/]+\/title$/)) {
      const sessionId = url.pathname.split('/')[3];
      const body = await req.json() as { title: string };
      SessionStore.updateTitle(sessionId, body.title);
      return Response.json({ ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/config') {
      return Response.json(ConfigStore.readConfig());
    }

    if (req.method === 'PUT' && url.pathname === '/config') {
      const body = await req.json() as Partial<AppConfig>;
      const current = ConfigStore.readConfig();
      const updated: AppConfig = {
        currentProviderId: body.currentProviderId ?? current.currentProviderId,
        currentModelId: body.currentModelId !== undefined ? body.currentModelId : current.currentModelId,
        apiKeys: body.apiKeys ?? current.apiKeys,
        customProviders: current.customProviders,
      };
      ConfigStore.writeConfig(updated);
      return Response.json({ ok: true });
    }

    // Provider CRUD
    if (req.method === 'GET' && url.pathname === '/api/providers') {
      return Response.json(ConfigStore.getAllProviders());
    }

    if (req.method === 'POST' && url.pathname === '/api/providers') {
      const body = await req.json() as Omit<Provider, 'id'> & { id?: string };
      const { id: bodyId, ...rest } = body;
      const id = ConfigStore.addCustomProvider(rest, bodyId);
      return Response.json({ ok: true, id });
    }

    if (req.method === 'PUT' && url.pathname.startsWith('/api/providers/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/providers/'.length));
      const body = await req.json() as Partial<Provider>;
      ConfigStore.updateCustomProvider(id, body);
      return Response.json({ ok: true });
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/providers/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/providers/'.length));
      ConfigStore.deleteCustomProvider(id);
      return Response.json({ ok: true });
    }

    // Provider 验证状态缓存
    if (req.method === 'GET' && url.pathname === '/api/provider-verify-status') {
      return Response.json(ConfigStore.getProviderVerifyStatus());
    }

    if (req.method === 'PUT' && url.pathname === '/api/provider-verify-status') {
      const body = await req.json() as { providerId: string; status: 'valid' | 'invalid'; accountEmail?: string };
      ConfigStore.saveProviderVerifyStatus(body.providerId, body.status, body.accountEmail);
      return Response.json({ ok: true });
    }

    // 预设 Provider 自定义模型管理
    if (req.method === 'PUT' && url.pathname === '/api/preset-custom-models') {
      const body = await req.json() as { providerId: string; models: Array<{ model: string; modelName: string; modelSeries: string }> };
      ConfigStore.savePresetCustomModels(body.providerId, body.models);
      return Response.json({ ok: true });
    }

    // Provider Model Aliases 管理
    if (req.method === 'PUT' && url.pathname === '/api/provider-model-aliases') {
      const body = await req.json() as { providerId: string; aliases: { sonnet?: string; opus?: string; haiku?: string } };
      ConfigStore.saveProviderModelAliases(body.providerId, body.aliases);
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

    // 目录文件列表
    if (req.method === 'GET' && url.pathname === '/api/dir-files') {
      const dirPath = url.searchParams.get('path');
      if (!dirPath) return Response.json({ error: 'missing path' }, { status: 400 });
      const showHidden = url.searchParams.get('hidden') === '1';
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        const files = entries
          .filter((e) => showHidden || !e.name.startsWith('.'))
          .map((e) => ({
            name: e.name,
            type: e.isDirectory() ? 'dir' : 'file',
            path: `${dirPath}/${e.name}`,
          }))
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        return Response.json(files);
      } catch {
        return Response.json({ error: 'not found' }, { status: 404 });
      }
    }

    // 文件读取
    if (req.method === 'GET' && url.pathname === '/api/file-read') {
      const filePath = url.searchParams.get('path');
      if (!filePath) return Response.json({ error: 'missing path' }, { status: 400 });
      try {
        const content = readFileSync(filePath, 'utf-8');
        return Response.json({ content });
      } catch {
        return Response.json({ error: 'not found' }, { status: 404 });
      }
    }

    // 文件写入
    if (req.method === 'POST' && url.pathname === '/api/file-write') {
      const body = await req.json() as { path: string; content: string };
      if (!body.path) return Response.json({ error: 'missing path' }, { status: 400 });
      try {
        mkdirSync(dirname(body.path), { recursive: true });
        writeFileSync(body.path, body.content, 'utf-8');
        return Response.json({ ok: true });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // 文件重命名
    if (req.method === 'POST' && url.pathname === '/api/file-rename') {
      const body = await req.json() as { oldPath: string; newName: string };
      if (!body.oldPath || !body.newName) return Response.json({ error: 'missing oldPath or newName' }, { status: 400 });
      if (body.newName.includes('/') || body.newName.includes('\\')) {
        return Response.json({ error: 'invalid name' }, { status: 400 });
      }
      try {
        const newPath = join(dirname(body.oldPath), body.newName);
        if (existsSync(newPath)) {
          return Response.json({ error: '同名文件已存在' }, { status: 409 });
        }
        renameSync(body.oldPath, newPath);
        return Response.json({ ok: true, newPath });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // 文件/文件夹删除
    if (req.method === 'POST' && url.pathname === '/api/file-delete') {
      const body = await req.json() as { path: string };
      if (!body.path) return Response.json({ error: 'missing path' }, { status: 400 });
      try {
        const st = statSync(body.path);
        if (st.isDirectory()) {
          rmSync(body.path, { recursive: true, force: true });
        } else {
          unlinkSync(body.path);
        }
        return Response.json({ ok: true });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // 文件复制（支持冲突自动重命名）
    if (req.method === 'POST' && url.pathname === '/api/file-copy') {
      const body = await req.json() as { sourcePaths: string[]; targetDir: string };
      if (!body.sourcePaths?.length || !body.targetDir) {
        return Response.json({ error: 'missing sourcePaths or targetDir' }, { status: 400 });
      }
      const results: { name: string; finalName: string; renamed: boolean }[] = [];
      try {
        mkdirSync(body.targetDir, { recursive: true });
        for (const src of body.sourcePaths) {
          const name = src.split('/').pop() || src;
          const ext = name.includes('.') ? '.' + name.split('.').pop()! : '';
          const base = ext ? name.slice(0, -ext.length) : name;
          let finalName = name;
          let counter = 1;
          let renamed = false;
          while (existsSync(join(body.targetDir, finalName))) {
            finalName = `${base} (${counter})${ext}`;
            counter++;
            renamed = true;
          }
          const destPath = join(body.targetDir, finalName);
          const srcStat = statSync(src);
          if (srcStat.isDirectory()) {
            const copyDir = (s: string, d: string) => {
              mkdirSync(d, { recursive: true });
              for (const entry of readdirSync(s, { withFileTypes: true })) {
                if (entry.isSymbolicLink()) continue;
                const sp = join(s, entry.name);
                const dp = join(d, entry.name);
                if (entry.isDirectory()) copyDir(sp, dp);
                else copyFileSync(sp, dp);
              }
            };
            copyDir(src, destPath);
          } else {
            copyFileSync(src, destPath);
          }
          results.push({ name, finalName, renamed });
        }
        return Response.json({ ok: true, results });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // MCP 路由
    if (req.method === 'GET' && url.pathname === '/api/mcp') {
      return Response.json({
        servers: MCPConfigStore.getAll(),
        enabledIds: MCPConfigStore.getEnabledIds(),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/mcp') {
      const body = await req.json() as { id: string } & MCPConfigStore.MCPServerConfig;
      const { id, ...config } = body;
      MCPConfigStore.set(id, config);
      return Response.json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/mcp/toggle') {
      const body = await req.json() as { id: string; enabled: boolean };

      // Disabling always succeeds immediately
      if (!body.enabled) {
        MCPConfigStore.setEnabled(body.id, false);
        return Response.json({ ok: true });
      }

      // Enabling: validate before toggling on
      const allServers = MCPConfigStore.getAll();
      const server = allServers.find(s => s.id === body.id);
      if (!server) {
        return Response.json({ ok: false, error: { type: 'unknown', message: 'MCP 服务器不存在' } });
      }

      // stdio: check command exists
      if (server.type === 'stdio' && server.command) {
        try {
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(server.command!, ['--version'], {
              timeout: 5000,
              stdio: 'ignore',
              env: { ...process.env },
            });
            proc.on('error', (err: NodeJS.ErrnoException) => {
              if (err.code === 'ENOENT') {
                reject({ type: 'command_not_found', command: server.command, ...getCommandDownloadInfo(server.command!) });
              } else {
                reject({ type: 'runtime_error', message: err.message });
              }
            });
            proc.on('close', () => resolve());
          });
        } catch (err: unknown) {
          const error = err as Record<string, unknown>;
          if (error.type === 'command_not_found') {
            return Response.json({
              ok: false,
              error: {
                type: 'command_not_found',
                command: error.command,
                message: `命令 "${error.command}" 未找到`,
                runtimeName: error.runtimeName,
                downloadUrl: error.downloadUrl,
              },
            });
          }
        }
      }

      // http/sse: validate remote URL is reachable
      if ((server.type === 'http' || server.type === 'sse') && server.url) {
        let targetUrl = server.url;
        if (targetUrl.includes('{{')) {
          const serverEnv = MCPConfigStore.getServerEnv(server.id);
          targetUrl = targetUrl.replace(/\{\{(\w+)\}\}/g, (_, key) => serverEnv[key] ?? '');
        }
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const method = server.type === 'sse' ? 'GET' : 'POST';
          const fetchOpts: RequestInit = { method, signal: controller.signal };
          if (method === 'POST') {
            fetchOpts.headers = { 'Content-Type': 'application/json' };
            fetchOpts.body = JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} });
          }
          const response = await fetch(targetUrl, fetchOpts);
          clearTimeout(timeout);

          if (response.status === 401 || response.status === 403) {
            return Response.json({ ok: false, error: { type: 'connection_failed', message: `认证失败 (HTTP ${response.status})，请检查 Headers 配置` } });
          }
          if (response.status === 404) {
            return Response.json({ ok: false, error: { type: 'connection_failed', message: `端点不存在 (HTTP 404)，请检查 URL 是否正确` } });
          }
          if (response.status === 405) {
            const hint = server.type === 'sse'
              ? '。请尝试切换传输协议为 Streamable HTTP'
              : '。请尝试切换传输协议为 SSE';
            return Response.json({ ok: false, error: { type: 'connection_failed', message: `请求方法不被允许 (HTTP 405)${hint}` } });
          }
          if (!response.ok) {
            return Response.json({ ok: false, error: { type: 'connection_failed', message: `服务器返回错误 (HTTP ${response.status})` } });
          }
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          let message: string;
          if (error.name === 'AbortError') {
            message = '连接超时（15秒），请检查 URL 是否正确或服务器是否可达';
          } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            message = '域名无法解析，请检查 URL 是否正确';
          } else if (error.message.includes('ECONNREFUSED')) {
            message = '连接被拒绝，请检查服务是否已启动';
          } else {
            message = `连接失败：${error.message}`;
          }
          return Response.json({ ok: false, error: { type: 'connection_failed', message } });
        }
      }

      // Validation passed — enable
      MCPConfigStore.setEnabled(body.id, true);
      return Response.json({ ok: true });
    }

    // MCP per-server env (API keys)
    if (req.method === 'GET' && url.pathname === '/api/mcp/env') {
      return Response.json(MCPConfigStore.getAllServerEnv());
    }

    if (req.method === 'PUT' && url.pathname === '/api/mcp/env') {
      const body = await req.json() as { id: string; env: Record<string, string> };
      MCPConfigStore.setServerEnv(body.id, body.env);
      return Response.json({ ok: true });
    }

    // MCP config check (needs-config status for all servers)
    if (req.method === 'GET' && url.pathname === '/api/mcp/needs-config') {
      const all = MCPConfigStore.getAll();
      const result: Record<string, boolean> = {};
      for (const s of all) {
        if (s.requiresConfig?.length) {
          result[s.id] = MCPConfigStore.checkNeedsConfig(s.id);
        }
      }
      return Response.json(result);
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/mcp/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/mcp/'.length));
      if (MCPConfigStore.isBuiltin(id)) {
        return Response.json({ error: '不允许删除内置 MCP' }, { status: 403 });
      }
      MCPConfigStore.remove(id);
      return Response.json({ ok: true });
    }

    // Proxy hot-reload
    if (req.method === 'POST' && url.pathname === '/api/proxy/set') {
      try {
        const payload = await req.json();
        setProxyConfig(payload);
        return Response.json({ success: true });
      } catch (error) {
        console.error('[api/proxy/set] Error:', error);
        return Response.json({ error: String(error) }, { status: 500 });
      }
    }

    // MCP server args (extra args appended to preset)
    if (req.method === 'PUT' && url.pathname === '/api/config/mcp-args') {
      const body = await req.json() as { serverId: string; args: string[] };
      const config = ConfigStore.readConfig();
      if (!config.mcpServerArgs) config.mcpServerArgs = {};
      if (body.args.length === 0) {
        delete config.mcpServerArgs[body.serverId];
      } else {
        config.mcpServerArgs[body.serverId] = body.args;
      }
      ConfigStore.writeConfig(config);
      return Response.json({ ok: true });
    }

    // ── Subscription 状态与验证 ──

    if (req.method === 'GET' && url.pathname === '/api/subscription/status') {
      try {
        const status = checkAnthropicSubscription();
        return Response.json(status);
      } catch (error) {
        console.error('[api/subscription/status] Error:', error);
        return Response.json(
          { available: false, error: error instanceof Error ? error.message : 'Check failed' },
          { status: 500 },
        );
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/subscription/verify') {
      try {
        console.log('[api/subscription/verify] Starting verification...');
        const result = await verifySubscription();
        console.log('[api/subscription/verify] Result:', JSON.stringify(result));
        return Response.json(result);
      } catch (error) {
        console.error('[api/subscription/verify] Error:', error);
        return Response.json(
          { success: false, error: error instanceof Error ? error.message : 'Verification failed' },
          { status: 500 },
        );
      }
    }

    // Provider API Key 验证（通过 SDK 子进程发真实对话验证）
    if (req.method === 'POST' && url.pathname === '/api/verify-provider-key') {
      const body = await req.json() as {
        baseUrl?: string;
        apiKey: string;
        model?: string;
        authType?: string;
        apiProtocol?: string;
        maxOutputTokens?: number;
        upstreamFormat?: string;
      };
      if (!body.apiKey) {
        return Response.json({ result: 'fail', error: '请输入 API Key' });
      }
      const result = await verifyProviderViaSdk(
        body.baseUrl ?? '',
        body.apiKey,
        body.authType ?? 'both',
        body.model || undefined,
        body.apiProtocol === 'openai' ? 'openai' : undefined,
        body.maxOutputTokens,
        body.upstreamFormat === 'responses' ? 'responses' : undefined,
      );
      return Response.json({
        result: result.success ? 'ok' : 'fail',
        error: result.error,
      });
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
      const deleted = SkillsStore.deleteSkill(name, scope, agentDir);
      if (!deleted) {
        return Response.json({ error: '不允许删除内置 Skill' }, { status: 403 });
      }
      return Response.json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/skills/toggle') {
      const body = await req.json() as { name: string; enabled: boolean };
      SkillsStore.toggleSkill(body.name, body.enabled);
      return Response.json({ ok: true });
    }

    // Skill sync from Claude Code
    if (req.method === 'GET' && url.pathname === '/api/skill/sync-check') {
      try {
        const claudeSkillsDir = join(homedir(), '.claude', 'skills');
        if (!existsSync(claudeSkillsDir)) {
          return Response.json({ canSync: false, count: 0, folders: [] });
        }

        const claudeFolders = readdirSync(claudeSkillsDir, { withFileTypes: true })
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name);

        if (claudeFolders.length === 0) {
          return Response.json({ canSync: false, count: 0, folders: [] });
        }

        const soagentsSkillsDir = join(homedir(), '.soagents', 'skills');
        const existingFolders = new Set<string>();
        if (existsSync(soagentsSkillsDir)) {
          for (const entry of readdirSync(soagentsSkillsDir, { withFileTypes: true })) {
            if (entry.isDirectory()) existingFolders.add(entry.name);
          }
        }

        const syncableFolders = claudeFolders.filter(f => !existingFolders.has(f));
        return Response.json({
          canSync: syncableFolders.length > 0,
          count: syncableFolders.length,
          folders: syncableFolders,
        });
      } catch (error) {
        console.error('[api/skill/sync-check] Error:', error);
        return Response.json(
          { canSync: false, count: 0, folders: [], error: error instanceof Error ? error.message : 'Check failed' },
          { status: 500 }
        );
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/skill/sync-from-claude') {
      try {
        const claudeSkillsDir = join(homedir(), '.claude', 'skills');
        if (!existsSync(claudeSkillsDir)) {
          return Response.json({ success: false, synced: 0, failed: 0, error: 'Claude Code skills directory not found' }, { status: 404 });
        }

        const claudeFolders = readdirSync(claudeSkillsDir, { withFileTypes: true })
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name);

        if (claudeFolders.length === 0) {
          return Response.json({ success: true, synced: 0, failed: 0 });
        }

        const soagentsSkillsDir = join(homedir(), '.soagents', 'skills');
        if (!existsSync(soagentsSkillsDir)) {
          mkdirSync(soagentsSkillsDir, { recursive: true });
        }

        const existingFolders = new Set<string>();
        for (const entry of readdirSync(soagentsSkillsDir, { withFileTypes: true })) {
          if (entry.isDirectory()) existingFolders.add(entry.name);
        }

        const isValidName = (name: string) => /^[a-zA-Z0-9_-]+$/.test(name);
        const syncableFolders = claudeFolders.filter(f => !existingFolders.has(f) && isValidName(f));

        if (syncableFolders.length === 0) {
          return Response.json({ success: true, synced: 0, failed: 0 });
        }

        let synced = 0;
        let failed = 0;
        const errors: string[] = [];

        const copyDirRecursive = (src: string, dest: string) => {
          mkdirSync(dest, { recursive: true });
          for (const entry of readdirSync(src, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) continue; // skip symlinks for security
            const srcPath = join(src, entry.name);
            const destPath = join(dest, entry.name);
            if (entry.isDirectory()) {
              copyDirRecursive(srcPath, destPath);
            } else {
              copyFileSync(srcPath, destPath);
            }
          }
        };

        for (const folder of syncableFolders) {
          try {
            copyDirRecursive(join(claudeSkillsDir, folder), join(soagentsSkillsDir, folder));
            synced++;
          } catch (e) {
            failed++;
            errors.push(`${folder}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }

        return Response.json({ success: true, synced, failed, errors: errors.length > 0 ? errors : undefined });
      } catch (error) {
        console.error('[api/skill/sync-from-claude] Error:', error);
        return Response.json(
          { success: false, synced: 0, failed: 0, error: error instanceof Error ? error.message : 'Sync failed' },
          { status: 500 }
        );
      }
    }

    // ── Git 初始化 ───────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/api/git-init') {
      const body = await req.json() as { agentDir: string };
      if (!body.agentDir) return Response.json({ error: 'missing agentDir' }, { status: 400 });

      // 检测是否已经是 git 仓库
      const check = Bun.spawnSync(['git', 'rev-parse', '--is-inside-work-tree'], { cwd: body.agentDir, stderr: 'pipe' });
      if (check.exitCode === 0) {
        return Response.json({ ok: true, alreadyInit: true });
      }

      // git init
      const initResult = Bun.spawnSync(['git', 'init'], { cwd: body.agentDir, stderr: 'pipe' });
      if (initResult.exitCode !== 0) {
        return Response.json({ error: 'git init failed: ' + new TextDecoder().decode(initResult.stderr) }, { status: 500 });
      }

      // git add -A + commit（使用 fallback 用户配置，避免未配置 git user 导致失败）
      Bun.spawnSync(['git', 'add', '-A'], { cwd: body.agentDir });
      Bun.spawnSync(
        ['git', '-c', 'user.name=SoAgents', '-c', 'user.email=soagents@local', 'commit', '-m', 'Initial commit', '--allow-empty'],
        { cwd: body.agentDir, stderr: 'pipe' }
      );

      return Response.json({ ok: true, alreadyInit: false });
    }

    // ── Git 变动文件 ──────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === '/api/changed-files') {
      const agentDir = url.searchParams.get('agentDir');
      if (!agentDir) return Response.json({ error: 'missing agentDir' }, { status: 400 });

      // 检测是否为 git 仓库
      const checkResult = Bun.spawnSync(['git', 'rev-parse', '--is-inside-work-tree'], { cwd: agentDir, stderr: 'pipe' });
      if (checkResult.exitCode !== 0) {
        return Response.json({ isGitRepo: false, files: [] });
      }

      const statusResult = Bun.spawnSync(['git', '-c', 'core.quotePath=false', 'status', '--porcelain', '--untracked-files=all'], { cwd: agentDir });
      const output = new TextDecoder().decode(statusResult.stdout).trimEnd();
      if (!output) {
        return Response.json({ isGitRepo: true, files: [] });
      }

      const files = output.split('\n').map((line) => {
        const xy = line.substring(0, 2);
        let filePath = line.substring(3);
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          // Decode git's octal-escaped paths (e.g. \345\210\253 → UTF-8 bytes → 中文)
          const raw = filePath.slice(1, -1);
          const bytes: number[] = [];
          for (let i = 0; i < raw.length; i++) {
            if (raw[i] === '\\' && i + 3 < raw.length && /^[0-7]{3}$/.test(raw.substring(i + 1, i + 4))) {
              bytes.push(parseInt(raw.substring(i + 1, i + 4), 8));
              i += 3;
            } else {
              bytes.push(raw.charCodeAt(i));
            }
          }
          filePath = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        }
        const renameMatch = filePath.match(/^(.+) -> (.+)$/);
        if (renameMatch) filePath = renameMatch[2];

        let status: string;
        if (xy === '??') status = 'U';
        else if (xy[0] === 'D' || xy[1] === 'D') status = 'D';
        else if (xy[0] === 'A') status = 'A';
        else if (xy[0] === 'R') status = 'R';
        else status = 'M';

        return { path: filePath, status };
      });
      return Response.json({ isGitRepo: true, files });
    }

    if (req.method === 'GET' && url.pathname === '/api/file-diff') {
      const agentDir = url.searchParams.get('agentDir');
      const filePath = url.searchParams.get('path');
      if (!agentDir || !filePath) return Response.json({ error: 'missing params' }, { status: 400 });

      let before = '';
      let after = '';

      // 尝试获取 HEAD 版本（before）
      const hasHead = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: agentDir });
      if (hasHead.exitCode === 0) {
        const showResult = Bun.spawnSync(['git', 'show', `HEAD:${filePath}`], { cwd: agentDir });
        if (showResult.exitCode === 0) {
          before = new TextDecoder().decode(showResult.stdout);
        }
      }

      // 读取当前工作区文件（after）
      try {
        after = readFileSync(join(agentDir, filePath), 'utf-8');
      } catch {
        // 文件已删除
      }

      return Response.json({ before, after });
    }

    // ── 统计 API ──

    if (req.method === 'GET' && url.pathname.match(/^\/sessions\/[^/]+\/stats$/)) {
      const statsSessionId = url.pathname.split('/')[2];
      const result = SessionStore.getSessionDetailedStats(statsSessionId);
      if (!result) return Response.json({ error: 'not found' }, { status: 404 });
      return Response.json(result);
    }

    if (req.method === 'GET' && url.pathname === '/api/global-stats') {
      const range = (url.searchParams.get('range') ?? '30d') as '7d' | '30d' | '60d';
      const validRanges = ['7d', '30d', '60d'];
      const safeRange = validRanges.includes(range) ? range : '30d';
      return Response.json(SessionStore.getGlobalStats(safeRange));
    }

    if (req.method === 'GET' && url.pathname === '/api/search-files') {
      const agentDir = url.searchParams.get('agentDir');
      const q = url.searchParams.get('q') ?? '';
      if (!agentDir) return Response.json({ error: 'missing agentDir' }, { status: 400 });
      if (!q) return Response.json([]);

      const glob = new Bun.Glob(`**/*${q}*`);
      const results: { path: string; name: string; type: 'file' | 'dir' }[] = [];
      try {
        for await (const file of glob.scan({ cwd: agentDir, onlyFiles: false, dot: false })) {
          if (file.includes('node_modules/') || file.includes('.git/') || file.includes('.DS_Store')) continue;
          const name = file.split('/').pop() || file;
          const isDir = file.endsWith('/');
          results.push({ path: isDir ? file.slice(0, -1) : file, name, type: isDir ? 'dir' : 'file' });
          if (results.length >= 20) break;
        }
      } catch { /* 目录不存在等 */ }
      return Response.json(results);
    }

    // ── Analytics API ──

    if (req.method === 'GET' && url.pathname === '/api/analytics/status') {
      return Response.json({ enabled: isAnalyticsEnabled() });
    }

    if (req.method === 'POST' && url.pathname === '/api/analytics/track') {
      const body = await req.json() as { event: string; params?: Record<string, string | number | boolean | null | undefined> };
      if (body.event) trackServer(body.event, body.params ?? {});
      return Response.json({ ok: true });
    }

    // ── 日志导出 API ──

    if (req.method === 'GET' && url.pathname === '/api/logs/export') {
      try {
        const logsDir = join(homedir(), '.soagents', 'logs');
        if (!existsSync(logsDir)) {
          return Response.json({ success: false, error: '没有找到日志目录' }, { status: 404 });
        }

        const now = Date.now();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        const files = readdirSync(logsDir)
          .filter(f => f.startsWith('unified-') && f.endsWith('.log'))
          .filter(f => {
            try { return now - statSync(join(logsDir, f)).mtimeMs < threeDaysMs; }
            catch { return false; }
          })
          .sort();

        if (files.length === 0) {
          return Response.json({ success: false, error: '没有找到近3天的运行日志' }, { status: 404 });
        }

        const desktopDir = join(homedir(), 'Desktop');
        const timestamp = new Date().toISOString().slice(0, 10);
        const zipName = `SoAgents-logs-${timestamp}.zip`;
        const zipPath = join(desktopDir, zipName);

        const filePaths = files.map(f => join(logsDir, f));
        const isWin = process.platform === 'win32';

        if (isWin) {
          const proc = Bun.spawn(['powershell', '-Command',
            `Compress-Archive -Path '${filePaths.join("','")}' -DestinationPath '${zipPath}' -Force`
          ]);
          await proc.exited;
        } else {
          const proc = Bun.spawn(['zip', '-j', zipPath, ...filePaths]);
          await proc.exited;
        }

        return Response.json({ success: true, path: zipPath });
      } catch (error) {
        return Response.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to export logs'
        }, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[Sidecar] Bun server listening on port ${port}`);
