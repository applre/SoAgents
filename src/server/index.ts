import { createSseHandler } from './sse';
import { agentSession } from './agent-session';
import * as SessionStore from './SessionStore';
import * as ConfigStore from './ConfigStore';
import * as MCPConfigStore from './MCPConfigStore';
import * as SkillsStore from './SkillsStore';
import { verifyProviderViaSdk } from './provider-verify';
import type { PermissionMode } from '../shared/types/permission';
import type { AppConfig, ProviderEnv, Provider } from '../shared/types/config';
import { statSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Allow SDK to spawn Claude Code subprocess even when launched from inside Claude Code session
delete process.env.CLAUDECODE;

// 启动时种子化内置 Skills
SkillsStore.seedBundledSkills();

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
      const body = await req.json() as { message: string; agentDir: string; providerEnv?: ProviderEnv; model?: string; permissionMode?: string; mcpEnabledServerIds?: string[]; images?: Array<{ name: string; mimeType: string; data: string }> };
      const VALID_MODES = ['plan', 'acceptEdits', 'bypassPermissions'] as const;
      const mode: PermissionMode = VALID_MODES.includes(body.permissionMode as PermissionMode)
        ? (body.permissionMode as PermissionMode)
        : 'acceptEdits';
      agentSession.sendMessage(body.message, body.agentDir, body.providerEnv, body.model, mode, body.mcpEnabledServerIds, body.images).catch(console.error);
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

    if (req.method === 'POST' && url.pathname === '/question/respond') {
      const body = await req.json() as { toolUseId: string; answers: Record<string, string> };
      agentSession.respondQuestion(body.toolUseId, body.answers);
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

    if (req.method === 'GET' && url.pathname === '/chat/search') {
      const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
      if (!q) return Response.json([]);
      const sessions = SessionStore.listSessions();
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
      const id = ConfigStore.addCustomProvider(rest);
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
      MCPConfigStore.setEnabled(body.id, body.enabled);
      return Response.json({ ok: true });
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/mcp/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/mcp/'.length));
      if (MCPConfigStore.isBuiltin(id)) {
        return Response.json({ error: '不允许删除内置 MCP' }, { status: 403 });
      }
      MCPConfigStore.remove(id);
      return Response.json({ ok: true });
    }

    // Provider API Key 验证（通过 SDK 子进程发真实对话验证）
    if (req.method === 'POST' && url.pathname === '/api/verify-provider-key') {
      const body = await req.json() as {
        baseUrl?: string;
        apiKey: string;
        model?: string;
        authType?: string;
      };
      if (!body.apiKey) {
        return Response.json({ result: 'fail', error: '请输入 API Key' });
      }
      const result = await verifyProviderViaSdk(
        body.baseUrl ?? '',
        body.apiKey,
        body.authType ?? 'both',
        body.model || undefined,
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

      const statusResult = Bun.spawnSync(['git', 'status', '--porcelain'], { cwd: agentDir });
      const output = new TextDecoder().decode(statusResult.stdout).trim();
      if (!output) {
        return Response.json({ isGitRepo: true, files: [] });
      }

      const files = output.split('\n').map((line) => {
        const xy = line.substring(0, 2);
        let filePath = line.substring(3);
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1);
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

      // 尝试 diff HEAD（含 staged + unstaged）
      let diffResult = Bun.spawnSync(['git', 'diff', 'HEAD', '--', filePath], { cwd: agentDir });
      let diff = new TextDecoder().decode(diffResult.stdout);

      if (diffResult.exitCode !== 0 || !diff.trim()) {
        // HEAD 不存在（无提交）或无差异，尝试 cached
        const cachedResult = Bun.spawnSync(['git', 'diff', '--cached', '--', filePath], { cwd: agentDir });
        diff = new TextDecoder().decode(cachedResult.stdout);
      }

      if (!diff.trim()) {
        // untracked 文件或无差异 — 读取文件内容
        try {
          const content = readFileSync(join(agentDir, filePath), 'utf-8');
          return Response.json({ diff: null, content, isNew: true });
        } catch {
          return Response.json({ diff: '', content: null, isNew: false });
        }
      }

      return Response.json({ diff, isNew: false });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[Sidecar] Bun server listening on port ${port}`);
