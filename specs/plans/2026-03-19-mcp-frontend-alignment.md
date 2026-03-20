# MCP 前端对齐实现方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面对齐 SoAgents 与 MyAgents 在 MCP 前端选择、后端同步、Session 动态更新、状态追踪、预热和存储架构方面的差异。

**Architecture:**
- 后端新增 `/api/mcp/set` 推送端点 + `setMcpServers()`/`getMcpServers()` 全局 MCP 管理
- 前端 ChatInput 加载 MCP 时增加错误处理和重试；Tab 激活时主动同步 MCP 到后端
- Session 支持 MCP 配置变更检测（fingerprint）+ 动态重启
- 新增 McpServerStatus 类型用于 UI 状态追踪
- MCP 启用时增加预热机制（stdio 类型预下载 npm 包）
- Settings MCP Tab 增加 JSON 导出功能
- MCP 存储从 3 个独立文件统一到 AppConfig

**Tech Stack:** TypeScript, React, Bun (server)

**参考代码库:** `~/repos/MyAgents`（只读参考，不修改）

**不适用于 SoAgents 的 MyAgents 特有功能（不移植）：**
- `builtin-mcp-registry.ts`（`__builtin__` magic command）— SoAgents 无 gemini-image/edge-tts 内置 MCP
- `McpToolsCard` 组件 / `AgentToolsSection` — SoAgents 用 ChatInput popover 替代，功能等价
- `mcpService.ts` 前端服务层 — SoAgents 用后端 MCPConfigStore + REST API 替代，架构不同但功能等价
- cron-tools / im-cron / im-bridge 特殊 MCP 权限检查 — IM 聊天机器人功能，SoAgents 不涉及

---

## 文件结构

### 新增文件
无

### 修改文件

| 文件 | 职责变更 |
|------|----------|
| `src/server/agent-session.ts` | 新增 `setMcpServers()`、`getMcpServers()`、`mcpConfigFingerprint()`；`runSession()` 改为从全局 MCP 读取；MCP 变更检测 + 动态重启 |
| `src/server/index.ts` | 新增 `POST /api/mcp/set` 端点；`POST /api/mcp/toggle` 增加 stdio 预热逻辑 |
| `src/renderer/components/ChatInput.tsx` | MCP 加载增加 `.catch` 和重试；Tab 激活时同步 MCP 到后端 |
| `src/renderer/context/TabProvider.tsx` | `sendMessage` 中 MCP 同步改为使用 `/api/mcp/set` 推送 |
| `src/shared/types/mcp.ts` | 新增 `McpServerStatus` 类型 |
| `src/shared/types/config.ts` | `AppConfig` 新增 `mcpServers`、`mcpEnabledServers`、`mcpServerEnv` 字段 |
| `src/server/MCPConfigStore.ts` | 内部实现改为从 AppConfig 读写（保持函数式导出不变）+ 旧文件自动迁移 |
| `src/server/ConfigStore.ts` | 新增 `updateConfig()` + `CONFIG_DIR` 导出；`readConfig()` 保留新 MCP 字段 |
| `src/renderer/pages/Settings.tsx` | MCPTab 增加 JSON 导出按钮；MCP 卡片显示状态标签 |

---

## Task 1: 后端 — 新增 MCP 全局管理函数

**目标：** 在 agent-session.ts 中新增 `setMcpServers()`、`getMcpServers()`、`mcpConfigFingerprint()`，将 MCP 配置从"Session 创建时单次传入"改为"全局管理 + 变更检测"。

**参考：** `~/repos/MyAgents/src/server/agent-session.ts:694-739`

**Files:**
- Modify: `src/server/agent-session.ts`

- [ ] **Step 1: 新增模块级 MCP 状态和 fingerprint 函数**

在 `agent-session.ts` 文件顶部（`SessionConfig` 接口之后，约 line 70）添加：

```typescript
// ── 全局 MCP 配置（由前端通过 /api/mcp/set 推送）──

import type { McpServerDefinition } from '../shared/types/mcp';

let currentMcpServers: McpServerDefinition[] | null = null;

/**
 * 计算 MCP 配置指纹，用于检测配置变化。
 * 对比 id + type + command + args + url + env + headers
 */
function mcpConfigFingerprint(servers: McpServerDefinition[]): string {
  const items = servers
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      type: s.type,
      command: s.command,
      args: s.args,
      url: s.url,
      env: s.env,
      headers: s.headers,
    }));
  return JSON.stringify(items);
}

/**
 * 前端推送有效 MCP 配置。若配置变化且有活跃 Session，触发重启。
 */
export function setMcpServers(servers: McpServerDefinition[]): void {
  const changed =
    currentMcpServers === null ||
    mcpConfigFingerprint(currentMcpServers) !== mcpConfigFingerprint(servers);

  currentMcpServers = servers;

  if (!changed) return;

  console.log(`[MCP] Config updated: ${servers.map((s) => s.id).join(', ') || 'none'}`);

  // 通知所有活跃 runner 重启（延迟到当前 turn 完成后）
  for (const runner of getAllRunners()) {
    if (runner.isSessionActive()) {
      runner.requestMcpRestart();
    }
  }
}

/**
 * 获取当前推送的 MCP 配置。null 表示前端尚未推送。
 */
export function getMcpServers(): McpServerDefinition[] | null {
  return currentMcpServers;
}
```

- [ ] **Step 2: 在 SessionRunner 类中新增 MCP 重启请求方法**

在 `SessionRunner` 类中添加（`needsSessionRestart()` 方法附近）：

```typescript
  private mcpRestartPending = false;

  /** 标记需要 MCP 重启，延迟到当前 streaming 完成后执行 */
  requestMcpRestart(): void {
    if (this.isStreaming) {
      this.mcpRestartPending = true;
      console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] MCP restart deferred (streaming)`);
    } else if (this.sessionActive) {
      console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] MCP config changed, restarting session`);
      this.abortSession();
    }
  }

  /** 公开 sessionActive 状态 */
  isSessionActive(): boolean {
    return this.sessionActive;
  }
```

- [ ] **Step 3: 在 turn 完成后检查 MCP 延迟重启**

在 `runSession()` 方法中，当 streaming turn 完成后（`this.isStreaming = false` 附近），加入检查：

```typescript
      this.isStreaming = false;

      // 检查延迟的 MCP 重启请求
      if (this.mcpRestartPending) {
        this.mcpRestartPending = false;
        console.log(`${logPrefix} Executing deferred MCP restart`);
        break; // 跳出 generator 循环，Session 将以新 MCP 配置重启
      }
```

- [ ] **Step 4: 修改 runSession() 的 MCP 构建逻辑**

将 `runSession()` 中现有的 MCP 构建逻辑（line 427-480）改为优先使用全局 `currentMcpServers`：

```typescript
      // ── 构建 MCP 配置 ──
      // 优先使用前端推送的全局配置（已经是 globalEnabled ∩ workspaceEnabled 的结果）
      // 回退到传统方式（从磁盘读取 + mcpEnabledServerIds 过滤）
      const pushedMcp = getMcpServers();
      const mcpFiltered: McpServerDefinition[] = pushedMcp !== null
        ? pushedMcp
        : (() => {
            const mcpAll = MCPConfigStore.getAll();
            const globalEnabledIds = new Set(MCPConfigStore.getEnabledIds());
            let filtered = mcpAll.filter((s) => globalEnabledIds.has(s.id));
            if (config.mcpEnabledServerIds !== undefined) {
              const workspaceSet = new Set(config.mcpEnabledServerIds);
              filtered = filtered.filter((s) => workspaceSet.has(s.id));
            }
            return filtered;
          })();
```

后续 `mcpServers` 对象构建逻辑保持不变（stdio/http/sse 分支处理）。

- [ ] **Step 5: 新增 getAllRunners() 辅助函数**

在 `getOrCreateRunner()` 同级位置新增：

```typescript
export function getAllRunners(): SessionRunner[] {
  return runner ? [runner] : [];
}
```

（注意：SoAgents 使用单 runner 单例模式，`runner` 是模块级变量，见 `agent-session.ts:1135`）

- [ ] **Step 6: 运行 typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/agent-session.ts
git commit -m "feat(mcp): add global MCP management with fingerprint change detection"
```

---

## Task 2: 后端 — 新增 /api/mcp/set 端点

**目标：** 新增 `POST /api/mcp/set` 端点，接收前端推送的有效 MCP 配置。

**参考：** `~/repos/MyAgents/src/server/index.ts` 中 `/api/mcp/set` 路由

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: 新增路由**

在 `src/server/index.ts` 的 MCP 路由区域（`GET /api/mcp` 附近）添加：

```typescript
    if (req.method === 'POST' && url.pathname === '/api/mcp/set') {
      const body = await req.json() as { servers: McpServerDefinition[] };
      setMcpServers(body.servers ?? []);
      return Response.json({ ok: true });
    }
```

- [ ] **Step 2: 添加 import**

确保 `index.ts` 顶部有对应 import：

```typescript
import { setMcpServers } from './agent-session';
import type { McpServerDefinition } from '../shared/types/mcp';
```

（如已有部分 import，只补缺失的）

- [ ] **Step 3: 运行 typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/server/index.ts
git commit -m "feat(mcp): add POST /api/mcp/set endpoint for frontend MCP push"
```

---

## Task 3: 前端 — ChatInput MCP 加载增加错误处理 + Tab 激活同步

**目标：**
1. MCP 加载增加 `.catch` 和 sidecar ready 后重试
2. 工作区 MCP toggle 时主动推送到后端
3. 组件挂载时做一次初始 MCP 同步

**参考：** `~/repos/MyAgents/src/renderer/pages/Chat.tsx:620-643`（Tab 激活同步）

**Files:**
- Modify: `src/renderer/components/ChatInput.tsx`

- [ ] **Step 1: MCP 加载增加错误处理和重试**

找到 ChatInput 中加载 MCP 的 `useEffect`（约 line 181-188），改为：

```typescript
  // 加载全局已启用的 MCP servers
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      globalApiGetJson<{ servers: Array<{ id: string; name: string; description?: string; type: string; isBuiltin: boolean }>; enabledIds: string[] }>('/api/mcp')
        .then((data) => {
          if (cancelled) return;
          const enabledSet = new Set(data.enabledIds);
          setMcpServers(data.servers.filter((s) => enabledSet.has(s.id)));
        })
        .catch(() => {
          if (cancelled) return;
          // Sidecar 可能还没准备好，3 秒后重试一次
          setTimeout(() => {
            if (cancelled) return;
            globalApiGetJson<{ servers: Array<{ id: string; name: string; description?: string; type: string; isBuiltin: boolean }>; enabledIds: string[] }>('/api/mcp')
              .then((data) => {
                if (cancelled) return;
                const enabledSet = new Set(data.enabledIds);
                setMcpServers(data.servers.filter((s) => enabledSet.has(s.id)));
              })
              .catch(() => { /* 静默：Settings 页面仍可管理 MCP */ });
          }, 3000);
        });
    };
    load();
    return () => { cancelled = true; };
  }, []);
```

- [ ] **Step 2: 补充 import + 新增 syncMcpToBackend 辅助函数**

先在文件顶部 import 中补充 `globalApiPostJson`（line 7 附近）：

```typescript
import { globalApiGetJson, globalApiPostJson } from '../api/apiFetch';
```

然后在 ChatInput 组件内（`handleWorkspaceMcpToggle` 附近）新增：

```typescript
  /** 计算有效 MCP 并推送到后端 */
  const syncMcpToBackend = useCallback((wsEnabledIds: string[]) => {
    const wsSet = new Set(wsEnabledIds);
    const effectiveServers = mcpServers.filter((s) => wsSet.has(s.id));
    globalApiPostJson('/api/mcp/set', { servers: effectiveServers }).catch((err) => {
      console.error('[ChatInput] Failed to sync MCP to backend:', err);
    });
  }, [mcpServers]);
```

注意：这里用 `globalApiPostJson`（全局端点），不需要 tab-specific 的 `apiPost`。

- [ ] **Step 3: 修改 handleWorkspaceMcpToggle 增加后端同步**

```typescript
  const handleWorkspaceMcpToggle = useCallback((serverId: string, enabled: boolean) => {
    if (!agentDir) return;
    const current = wsEntry?.mcpEnabledServers ?? [];
    const next = enabled ? [...current, serverId] : current.filter((id) => id !== serverId);
    updateWorkspaceConfig(agentDir, { mcpEnabledServers: next });
    // 立即同步到后端
    syncMcpToBackend(next);
  }, [agentDir, wsEntry?.mcpEnabledServers, updateWorkspaceConfig, syncMcpToBackend]);
```

- [ ] **Step 4: 组件挂载时做初始 MCP 同步**

在 MCP 加载的 `useEffect` 成功回调中，增加初始推送：

```typescript
        .then((data) => {
          if (cancelled) return;
          const enabledSet = new Set(data.enabledIds);
          const globalEnabled = data.servers.filter((s) => enabledSet.has(s.id));
          setMcpServers(globalEnabled);

          // 初始同步：推送当前工作区有效的 MCP 到后端
          const wsIds = wsEntryRef.current?.mcpEnabledServers;
          if (wsIds !== undefined) {
            const wsSet = new Set(wsIds);
            const effective = globalEnabled.filter((s) => wsSet.has(s.id));
            globalApiPostJson('/api/mcp/set', { servers: effective }).catch(() => {});
          } else {
            // wsIds undefined = 使用全局配置（不过滤）
            globalApiPostJson('/api/mcp/set', { servers: globalEnabled }).catch(() => {});
          }
        })
```

需要增加一个 ref 来跟踪 wsEntry（避免 stale closure）。`wsEntry` 已存在于 ChatInput 中（line 69: `const wsEntry = agentDir ? workspaces.find((w) => w.path === agentDir) : undefined`），在其后面添加 ref：

```typescript
  const wsEntryRef = useRef(wsEntry);
  wsEntryRef.current = wsEntry;
```

- [ ] **Step 5: 运行 typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/ChatInput.tsx
git commit -m "feat(mcp): add error handling, retry, and backend sync for MCP loading"
```

---

## Task 4: 前端 — Tab 激活时重新同步 MCP 到后端

**目标：** 用户切换 Tab 时，将当前工作区的有效 MCP 配置重新推送到后端，确保后端 Session 使用正确的 MCP。

**参考：** `~/repos/MyAgents/src/renderer/pages/Chat.tsx:870-907`

**Files:**
- Modify: `src/renderer/components/ChatInput.tsx`

- [ ] **Step 1: 监听 Tab 激活状态**

在 ChatInput 中 import `useTabActive`：

```typescript
import { useTabApi, useTabActive } from '../context/TabContext';
```

然后在组件内：

```typescript
  const isActive = useTabActive();
```

- [ ] **Step 2: 增加 Tab 激活同步 effect**

```typescript
  // Tab 激活时重新同步 MCP 到后端
  const prevActiveRef = useRef(false);
  useEffect(() => {
    const wasInactive = !prevActiveRef.current;
    prevActiveRef.current = isActive;
    if (!isActive || !wasInactive) return;

    // 重新加载全局 MCP（用户可能在 Settings 中修改过）
    globalApiGetJson<{ servers: Array<{ id: string; name: string; description?: string; type: string; isBuiltin: boolean }>; enabledIds: string[] }>('/api/mcp')
      .then((data) => {
        const enabledSet = new Set(data.enabledIds);
        const globalEnabled = data.servers.filter((s) => enabledSet.has(s.id));
        setMcpServers(globalEnabled);

        // 推送有效 MCP 到后端
        const wsIds = wsEntryRef.current?.mcpEnabledServers;
        const wsSet = wsIds !== undefined ? new Set(wsIds) : null;
        const effective = wsSet ? globalEnabled.filter((s) => wsSet.has(s.id)) : globalEnabled;
        globalApiPostJson('/api/mcp/set', { servers: effective }).catch(() => {});
      })
      .catch(() => {});
  }, [isActive]);
```

- [ ] **Step 3: 运行 typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/ChatInput.tsx
git commit -m "feat(mcp): sync MCP to backend on tab activation"
```

---

## Task 5: 后端 — sendMessage 中保留 mcpEnabledServerIds 兼容

**目标：** 确保 `sendMessage()` 中 `mcpEnabledServerIds` 参数仍然生效（作为 fallback），同时当 `currentMcpServers` 已被推送时优先使用推送的配置。

**Files:**
- Modify: `src/server/agent-session.ts`

- [ ] **Step 1: 在 sendMessage 中增加 MCP 变更检测**

在 `needsSessionRestart()` 方法中，增加 MCP 变更检测（现有方法只检测 provider/model/mode）：

```typescript
  private needsSessionRestart(providerEnv?: ProviderEnv, model?: string, permissionMode?: PermissionMode): boolean {
    // ... 现有 provider/model/mode 变更检测 ...

    // MCP 变更检测（由 setMcpServers 的 requestMcpRestart 单独处理）
    // 此处无需重复检测

    return providerChanged || modelChanged || modeChanged;
  }
```

实际上 MCP 变更已通过 `requestMcpRestart()` 独立处理，`needsSessionRestart()` 不需要改动。此 Task 主要验证兼容性。

- [ ] **Step 2: 确认 runSession 中的 fallback 逻辑正确**

在 Task 1 Step 4 中已实现：当 `currentMcpServers === null`（前端未推送）时，回退到从磁盘读取 + `mcpEnabledServerIds` 过滤。确认此逻辑覆盖了以下场景：

1. **前端已推送 MCP** → 使用 `currentMcpServers`（忽略 `mcpEnabledServerIds`）
2. **前端未推送（App 刚启动）** → 使用磁盘配置 + `mcpEnabledServerIds`
3. **前端推送空数组** → 无 MCP（用户显式禁用所有）

- [ ] **Step 3: 运行 typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: 跳过 Commit**

此 Task 是验证性质，如果 Task 1 实现正确则无需额外改动。如果在验证过程中发现问题并修复了代码，则 amend 到 Task 1 的 commit：

```bash
git add src/server/agent-session.ts
git commit --amend --no-edit
```

---

## Task 6: 集成验证

**目标：** 端到端验证 MCP 选择 → 推送 → Session 使用的完整链路。

- [ ] **Step 1: 验证 MCP 全局管理**

1. 打开 Settings → MCP Tab
2. 启用一个 MCP（如 Playwright）
3. 确认启用成功（toggle 变为开启状态）

- [ ] **Step 2: 验证工作区 MCP 选择**

1. 进入 Chat 页面
2. 点击 ChatInput 底部工具栏的扳手图标（MCP 按钮）
3. 确认弹出层列出了全局启用的 MCP 服务器
4. Toggle 启用一个 MCP
5. 确认 toggle 状态正确保持

- [ ] **Step 3: 验证 MCP 推送到后端**

1. 打开开发者工具 Network tab
2. Toggle MCP 开关
3. 确认有 `POST /api/mcp/set` 请求发出
4. 确认请求 body 包含正确的 `servers` 数组

- [ ] **Step 4: 验证 Tab 切换同步**

1. 在 Tab A 启用 MCP X
2. 切换到 Settings tab
3. 切换回 Tab A
4. 确认有 `POST /api/mcp/set` 请求发出
5. 确认 MCP X 仍然显示为启用状态

- [ ] **Step 5: 验证 Session 使用 MCP**

1. 启用 Playwright MCP
2. 发送一条需要浏览器的消息
3. 确认 Agent 尝试使用 MCP 工具（可在 unified log 中看到）

- [ ] **Step 6: 最终 typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS

---

## Task 7: 共享类型 — 新增 McpServerStatus 类型

**目标：** 新增 `McpServerStatus` 类型，用于 MCP 卡片的连接状态显示（Settings 页面 + ChatInput popover）。

**参考：** `~/repos/MyAgents/src/shared/types/mcp.ts` 中 `McpServerStatus`

**Files:**
- Modify: `src/shared/types/mcp.ts`
- Modify: `src/renderer/pages/Settings.tsx`（MCP 卡片显示状态标签）

- [ ] **Step 1: 在 mcp.ts 中新增 McpServerStatus 类型**

在 `src/shared/types/mcp.ts` 末尾添加：

```typescript
/** MCP 服务器运行时状态 */
export type McpServerStatus = 'enabled' | 'connecting' | 'error' | 'disabled';

export interface McpServerWithStatus extends McpServerDefinition {
  status: McpServerStatus;
  errorMessage?: string;
}
```

- [ ] **Step 2: 后端 — 在 /api/mcp 响应中增加 status 字段**

修改 `src/server/index.ts` 中 `GET /api/mcp` 路由，为每个 server 附加 status：

```typescript
    if (req.method === 'GET' && url.pathname === '/api/mcp') {
      const servers = MCPConfigStore.getAll();
      const enabledIds = MCPConfigStore.getEnabledIds();
      const enabledSet = new Set(enabledIds);

      // 附加运行时状态（enabled = 用户已启用，disabled = 未启用）
      // 注意：stdio MCP 实际连接在 SDK query() 时才建立，此处只反映用户意图
      const serversWithStatus = servers.map((s) => ({
        ...s,
        status: enabledSet.has(s.id) ? 'enabled' as const : 'disabled' as const,
      }));

      return Response.json({ servers: serversWithStatus, enabledIds });
    }
```

注意：此处 `connected` 是简化判断（启用=连接中）。更精确的实时状态需要 MCP SDK 反馈，可后续增强。

- [ ] **Step 3: Settings MCP 卡片显示状态标签**

在 `src/renderer/pages/Settings.tsx` 的 MCP Tab 中，每个 MCP 卡片增加状态指示器：

```typescript
  {/* MCP 卡片状态标签 */}
  <span className={`inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full ${
    server.status === 'enabled'
      ? 'bg-[var(--success)]/10 text-[var(--success)]'
      : server.status === 'error'
        ? 'bg-[var(--error)]/10 text-[var(--error)]'
        : 'bg-[var(--surface)] text-[var(--ink-tertiary)]'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${
      server.status === 'enabled' ? 'bg-[var(--success)]'
        : server.status === 'error' ? 'bg-[var(--error)]'
        : 'bg-[var(--ink-tertiary)]'
    }`} />
    {server.status === 'enabled' ? '已启用' : server.status === 'error' ? '错误' : '未启用'}
  </span>
```

- [ ] **Step 4: 运行 typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/mcp.ts src/server/index.ts src/renderer/pages/Settings.tsx
git commit -m "feat(mcp): add McpServerStatus type and status display in Settings"
```

---

## Task 8: 后端 — MCP stdio 预热机制

**目标：** 当启用 stdio 类型的 MCP（使用 npx/bunx 的）时，预下载 npm 包避免首次使用时长时间等待。

**参考：** `~/repos/MyAgents/src/server/agent-session.ts` 中 pre-warm 逻辑

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: 在 POST /api/mcp/toggle 中增加 stdio 预热**

在 `src/server/index.ts` 中，`POST /api/mcp/toggle` 路由的成功响应之前，增加预热逻辑：

```typescript
    if (req.method === 'POST' && url.pathname === '/api/mcp/toggle') {
      const body = await req.json() as { serverId: string; enabled: boolean };
      // ... 现有的 toggle 逻辑 ...

      // stdio 预热：启用时，如果 command 包含 npx/bunx，后台预下载
      if (body.enabled) {
        const server = MCPConfigStore.getAll().find((s) => s.id === body.serverId);
        if (server?.type === 'stdio' && server.command) {
          const cmd = server.command;
          const args = server.args ?? [];
          // 检测 npx/bunx 命令，预下载包（不执行 MCP server）
          if (cmd === 'npx' || cmd === 'bunx' || cmd.endsWith('/npx') || cmd.endsWith('/bunx')) {
            const pkg = args.find((a) => !a.startsWith('-'));
            if (pkg) {
              console.log(`[MCP] Pre-warming stdio package: ${pkg}`);
              // 用 npm cache add 仅下载不执行，避免触发 MCP server 启动
              Bun.spawn(['npm', 'cache', 'add', pkg], {
                stdout: 'ignore',
                stderr: 'ignore',
                env: { ...process.env, ...(server.env ?? {}) },
              }).exited.catch(() => {});
            }
          }
        }
      }

      return Response.json({ ok: true, enabledIds: MCPConfigStore.getEnabledIds() });
    }
```

- [ ] **Step 2: 运行 typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/server/index.ts
git commit -m "feat(mcp): pre-warm stdio MCP packages on enable"
```

---

## Task 9: Settings — MCP Tab JSON 导出功能

**目标：** 在 Settings MCP Tab 中增加"导出 JSON"按钮，允许用户导出当前 MCP 配置（方便备份/迁移）。

**Files:**
- Modify: `src/renderer/pages/Settings.tsx`

- [ ] **Step 1: 在 MCP Tab 顶部增加导出按钮**

在 Settings.tsx 的 MCP Tab 区域，标题旁增加导出按钮：

```typescript
  {/* MCP Tab 标题栏 */}
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-[18px] font-semibold text-[var(--ink)]">MCP 服务器</h3>
    <button
      onClick={handleExportMcpJson}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[var(--ink-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors"
    >
      <Download size={14} />
      导出 JSON
    </button>
  </div>
```

- [ ] **Step 2: 实现导出处理函数**

```typescript
  const handleExportMcpJson = useCallback(async () => {
    try {
      const data = await globalApiGetJson<{ servers: unknown[]; enabledIds: string[] }>('/api/mcp');
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'soagents-mcp-config.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Settings] Failed to export MCP config:', err);
    }
  }, []);
```

注意：Tauri WebView 中 `<a>.click()` 下载可能受限。如果需要，可改为通过 Tauri `dialog.save` + `fs.writeTextFile`。先用简单方案，后续按需调整。

- [ ] **Step 3: 确保 Download 图标已导入**

```typescript
import { Download } from 'lucide-react';
```

（如 Settings.tsx 已有 lucide-react 导入，只补 `Download`）

- [ ] **Step 4: 运行 typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pages/Settings.tsx
git commit -m "feat(mcp): add JSON export button in Settings MCP tab"
```

---

## Task 10: 存储架构统一 — MCP 3 文件合并到 AppConfig

**目标：** 将 MCP 配置从 3 个独立文件（`mcp.json`、`mcp-state.json`、`mcp-env.json`）合并到 `~/.soagents/config.json` 的 `AppConfig` 中，保持向后兼容。

**重要约束：**
- `MCPConfigStore.ts` 当前使用**函数式导出**（`export function getAll()`），所有调用方通过 `import * as MCPConfigStore` 使用。重构后 MUST 保持函数式导出，避免修改调用方。
- `ConfigStore.ts` 当前使用函数式导出（`readConfig()`、`writeConfig()`），无 class/static 方法。
- `readConfig()` 中有字段解构赋值（line 23-32），新增字段必须在此处一并保留，否则写入后再读出会丢失。
- `checkNeedsConfig(id)` 现有签名返回 `boolean`，保持不变。

**Files:**
- Modify: `src/shared/types/config.ts`
- Modify: `src/server/ConfigStore.ts`
- Modify: `src/server/MCPConfigStore.ts`

- [ ] **Step 1: 在 AppConfig 接口中新增 MCP 字段**

修改 `src/shared/types/config.ts`，在 `AppConfig` 接口末尾增加（`mcpServerArgs` 字段之后）：

```typescript
import type { McpServerDefinition } from './mcp';

export interface AppConfig {
  // ... 现有字段 ...
  mcpServerArgs?: Record<string, string[]>;

  /** MCP 自定义服务器定义（不含 preset），key = server id */
  mcpServers?: Record<string, import('./mcp').MCPServerConfig>;
  /** 全局启用的 MCP server IDs */
  mcpEnabledServers?: string[];
  /** 每个 MCP 的环境变量覆盖 */
  mcpServerEnv?: Record<string, Record<string, string>>;
}
```

注意：`mcpServers` 的 value 类型沿用现有 `MCPServerConfig`（来自 MCPConfigStore.ts），而非 `McpServerDefinition`，以保持文件格式一致。

- [ ] **Step 2: 修改 ConfigStore.readConfig() 保留新字段**

在 `src/server/ConfigStore.ts` 的 `readConfig()` 函数的 return 对象中（line 23-32），增加新字段的保留：

```typescript
export function readConfig(): AppConfig {
  ensureDataDir();
  const parsed = safeLoadJsonSync<Partial<AppConfig>>(CONFIG_PATH, {});
  if (!parsed || Object.keys(parsed).length === 0) {
    return { ...DEFAULT_CONFIG };
  }
  return {
    currentProviderId: parsed.currentProviderId ?? DEFAULT_CONFIG.currentProviderId,
    currentModelId: parsed.currentModelId,
    apiKeys: parsed.apiKeys ?? {},
    customProviders: parsed.customProviders ?? [],
    presetCustomModels: parsed.presetCustomModels,
    providerVerifyStatus: parsed.providerVerifyStatus,
    providerModelAliases: parsed.providerModelAliases,
    mcpServerArgs: parsed.mcpServerArgs,
    // ── MCP 统一存储字段 ──
    mcpServers: parsed.mcpServers,
    mcpEnabledServers: parsed.mcpEnabledServers,
    mcpServerEnv: parsed.mcpServerEnv,
  };
}
```

- [ ] **Step 3: 在 ConfigStore 新增 updateConfig() 辅助函数**

在 `src/server/ConfigStore.ts` 末尾新增：

```typescript
/**
 * Disk-first 部分更新：读取最新配置 → 合并 → 写入。
 * 遵循 CLAUDE.md "Config 持久化" 约束。
 */
export function updateConfig(partial: Partial<AppConfig>): void {
  const current = readConfig();
  const merged = { ...current, ...partial };
  writeConfig(merged);
}
```

同时导出 `DATA_DIR` 常量供 MCPConfigStore 迁移逻辑使用：

```typescript
export const CONFIG_DIR = DATA_DIR;
```

- [ ] **Step 4: 重构 MCPConfigStore — 内部实现改为读写 AppConfig**

重写 `src/server/MCPConfigStore.ts`，保持**函数式导出**不变（所有调用方 `import * as MCPConfigStore` 无需修改）：

```typescript
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { McpServerDefinition } from '../shared/types/mcp';
import { PRESET_MCP_SERVERS } from '../shared/mcp-presets';
import { readConfig, updateConfig, CONFIG_DIR } from './ConfigStore';

// ── 旧文件迁移 ──

const MIGRATION_FLAG = join(CONFIG_DIR, 'mcp-migrated');
let migrationDone = false;

function ensureMigration(): void {
  if (migrationDone) return;
  migrationDone = true;
  if (existsSync(MIGRATION_FLAG)) return;

  const oldMcpPath = join(CONFIG_DIR, 'mcp.json');
  const oldStatePath = join(CONFIG_DIR, 'mcp-state.json');
  const oldEnvPath = join(CONFIG_DIR, 'mcp-env.json');

  try {
    let didMigrate = false;
    const patch: Record<string, unknown> = {};

    if (existsSync(oldMcpPath)) {
      patch.mcpServers = JSON.parse(readFileSync(oldMcpPath, 'utf-8'));
      didMigrate = true;
    }
    if (existsSync(oldStatePath)) {
      const state = JSON.parse(readFileSync(oldStatePath, 'utf-8'));
      patch.mcpEnabledServers = state.enabledServers ?? state.enabledIds ?? [];
      didMigrate = true;
    }
    if (existsSync(oldEnvPath)) {
      patch.mcpServerEnv = JSON.parse(readFileSync(oldEnvPath, 'utf-8'));
      didMigrate = true;
    }

    if (didMigrate) {
      updateConfig(patch);
      writeFileSync(MIGRATION_FLAG, new Date().toISOString());
      console.log('[MCPConfigStore] Migrated from legacy files to AppConfig');
    }
  } catch (err) {
    console.error('[MCPConfigStore] Migration failed:', err);
  }
}

// ── 保留旧接口用于 AppConfig 内部存储格式 ──
export interface MCPServerConfig {
  name?: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

// ── 公开函数（签名不变，调用方无需修改）──

export function getAll(): McpServerDefinition[] {
  ensureMigration();
  const config = readConfig();
  const userConfigs = config.mcpServers ?? {};
  const result: McpServerDefinition[] = [];

  for (const preset of PRESET_MCP_SERVERS) {
    result.push({ ...preset });
  }
  for (const [id, cfg] of Object.entries(userConfigs)) {
    if (PRESET_MCP_SERVERS.some((p) => p.id === id)) continue;
    result.push({
      id,
      name: cfg.name ?? id,
      type: cfg.type,
      command: cfg.command,
      args: cfg.args,
      env: cfg.env,
      url: cfg.url,
      headers: cfg.headers,
      isBuiltin: false,
    });
  }
  return result;
}

export function getEnabledIds(): string[] {
  ensureMigration();
  return readConfig().mcpEnabledServers ?? [];
}

export function setEnabled(id: string, enabled: boolean): void {
  const config = readConfig();
  const set = new Set(config.mcpEnabledServers ?? []);
  if (enabled) set.add(id); else set.delete(id);
  updateConfig({ mcpEnabledServers: [...set] });
}

export function set(id: string, config: MCPServerConfig): void {
  const current = readConfig();
  const servers = { ...(current.mcpServers ?? {}), [id]: config };
  updateConfig({ mcpServers: servers });
  // 新 MCP 默认启用
  const enabled = new Set(current.mcpEnabledServers ?? []);
  if (!enabled.has(id)) {
    enabled.add(id);
    updateConfig({ mcpEnabledServers: [...enabled] });
  }
}

export function remove(id: string): boolean {
  if (PRESET_MCP_SERVERS.some((p) => p.id === id)) return false;
  const current = readConfig();
  const servers = { ...(current.mcpServers ?? {}) };
  delete servers[id];
  const enabled = (current.mcpEnabledServers ?? []).filter((s) => s !== id);
  updateConfig({ mcpServers: servers, mcpEnabledServers: enabled });
  return true;
}

export function isBuiltin(id: string): boolean {
  return PRESET_MCP_SERVERS.some((p) => p.id === id);
}

export function getServerEnv(id: string): Record<string, string> {
  return readConfig().mcpServerEnv?.[id] ?? {};
}

export function getAllServerEnv(): Record<string, Record<string, string>> {
  return readConfig().mcpServerEnv ?? {};
}

export function setServerEnv(id: string, env: Record<string, string>): void {
  const current = readConfig();
  const allEnv = { ...(current.mcpServerEnv ?? {}), [id]: env };
  updateConfig({ mcpServerEnv: allEnv });
}

export function checkNeedsConfig(id: string): boolean {
  const preset = PRESET_MCP_SERVERS.find((p) => p.id === id);
  if (!preset?.requiresConfig?.length) return false;
  const env = getServerEnv(id);
  return preset.requiresConfig.some((key) => !env[key]);
}
```

- [ ] **Step 5: 运行 typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/types/config.ts src/server/ConfigStore.ts src/server/MCPConfigStore.ts
git commit -m "refactor(mcp): consolidate 3 MCP files into AppConfig with auto-migration"
```

---

## Task 11: 最终集成验证

**目标：** 全面验证所有 Tasks 1-10 的集成效果。

- [ ] **Step 1: 验证 MCP 全局管理 + 状态显示**

1. 打开 Settings → MCP Tab
2. 确认每个 MCP 卡片显示状态标签（已启用/未启用）
3. 启用一个 MCP，确认状态变为"已启用"
4. 禁用后确认变回"未启用"

- [ ] **Step 2: 验证 MCP JSON 导出**

1. 在 Settings MCP Tab 点击"导出 JSON"
2. 确认下载了 `soagents-mcp-config.json` 文件
3. 打开文件，确认包含 `servers` 和 `enabledIds`

- [ ] **Step 3: 验证工作区 MCP 选择 + 后端推送**

1. 进入 Chat 页面
2. 打开 ChatInput 的 MCP popover
3. Toggle 一个 MCP
4. 确认 Network 中有 `POST /api/mcp/set` 请求
5. 确认请求 body 中 `servers` 只包含 globalEnabled ∩ workspaceEnabled

- [ ] **Step 4: 验证 Tab 切换同步**

1. 在 Tab A 启用 MCP X
2. 切换到 Settings tab
3. 切换回 Tab A
4. 确认 Network 中有新的 `POST /api/mcp/set` 请求
5. 确认 MCP X 仍然显示为启用

- [ ] **Step 5: 验证 stdio 预热**

1. 启用一个 stdio 类型的 npx MCP（如 Playwright）
2. 检查 unified log 中是否出现 `[MCP] Pre-warming stdio package:` 日志

- [ ] **Step 6: 验证存储迁移**

1. 检查 `~/.soagents/config.json` 是否包含 `mcpServers`、`mcpEnabledServers`、`mcpServerEnv` 字段
2. 确认旧文件（`mcp.json`、`mcp-state.json`、`mcp-env.json`）不再被写入
3. 检查 `~/.soagents/mcp-migrated` 标志文件存在

- [ ] **Step 7: 验证 MCP 动态重启**

1. 在活跃 Session 中，切换到 Settings 禁用当前使用的 MCP
2. 切换回 Chat tab
3. 确认 unified log 中出现 MCP restart 相关日志
4. 发送新消息，确认被禁用的 MCP 工具不再可用

- [ ] **Step 8: 最终 typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS
