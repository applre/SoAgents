# SoAgents 开发过程记录

## 遇到的问题与解决方案

### 1. Clash 代理拦截 localhost 流量

**现象**：SSE 消息被缓冲，前端收不到任何流式事件，reqwest DEBUG 日志显示：
```
proxy(http://127.0.0.1:7897/) intercepts 'http://127.0.0.1:31415/'
```

**原因**：系统代理（Clash）拦截了 Rust → Bun 的 localhost 通信，导致 SSE 流被缓冲而非逐行推送。

**修复**：所有 reqwest Client 加 `.no_proxy()` + `.tcp_nodelay(true)` + `.http1_only()`：
```rust
let client = reqwest::Client::builder()
    .no_proxy()
    .tcp_nodelay(true)
    .http1_only()
    .build()?;
```
涉及文件：`src-tauri/src/proxy.rs`、`src-tauri/src/sse_proxy.rs`、`src-tauri/src/sidecar.rs`（健康检查）

---

### 2. Bun.serve 默认 10 秒 idle timeout 断开 SSE

**现象**：日志出现 `[Bun.serve]: request timed out after 10 seconds`，SSE 长连接被服务端强制断开。

**原因**：Bun.serve 默认 idleTimeout 为 10 秒，不适合 SSE 长连接。

**修复**：`src/server/index.ts` 中设置 `idleTimeout: 0`：
```typescript
const server = Bun.serve({
  port,
  idleTimeout: 0, // 禁用超时，SSE 长连接需要
  async fetch(req) { ... }
});
```

---

### 3. Claude Agent SDK 无法在 Claude Code 会话内启动

**现象**：发送消息后报错：
```
Claude Code cannot be launched inside another Claude Code session.
To bypass this check, unset the CLAUDECODE environment variable.
```

**原因**：从 Claude Code（CLI）内部运行 `npm run tauri:dev`，`CLAUDECODE` 环境变量被继承到 Bun sidecar 进程，SDK 检测到嵌套会话拒绝启动。

**修复**：`src/server/index.ts` 启动时清除该环境变量：
```typescript
// 允许 SDK 在 Claude Code 会话内启动子进程
delete process.env.CLAUDECODE;
```

---

### 4. 前端收不到 Claude 回复内容

**现象**：消息发出去，SDK 也处理了（日志可见），但前端界面没有任何文字出现。

**原因（两个）**：

1. `includePartialMessages: true` 被错误地认为是无效选项移除了——没有它，SDK 不发 `stream_event` 流式事件，只发 `assistant` 完整消息。

2. `assistant` 消息的处理代码只累加内容到变量，没有调用 `broadcast()`，前端 SSE 永远收不到。

**修复**：`src/server/agent-session.ts`：
```typescript
// 1. 加回 includePartialMessages
options: {
  allowedTools: [...],
  cwd: agentDir,
  permissionMode: 'acceptEdits',
  includePartialMessages: true,  // 启用流式 stream_event 事件
},

// 2. stream_event 只广播不累加（避免双倍计数）
// 3. assistant 消息作为存储用途；若无流式内容则也广播（兜底）
if (msg.type === 'stream_event') {
  // broadcast chunk, don't accumulate
} else if (msg.type === 'assistant') {
  // accumulate for storage; broadcast if no streaming happened
  if (!hasStreamedContent) {
    broadcast('chat:message-chunk', { text: block.text });
  }
}
```

---

## 架构说明

### 为什么用 `.no_proxy()` 而非依赖 VPN bypass 配置

MyAgents 原项目依赖用户在 Clash 里配置 bypass 规则，通用性差。
SoAgents 在代码层面强制绕过代理，对所有用户开箱即用，且不影响 API 请求（API 请求走的是 SDK 子进程，不受影响）。

### 5. MyAgents 与 SoAgents 端口冲突

**现象**：发消息后没有任何回复，日志中有 reqwest 连接但没有 `[AgentSession] Starting query` 日志。

**原因**：MyAgents.app 的 sidecar 也默认监听 31415 端口。两个 app 同时运行时，SoAgents 的请求发到了 MyAgents 的 sidecar（它的 `isRunning` 状态不对，直接丢弃消息）。

**修复**：开发 SoAgents 前先关掉 MyAgents，或清理端口：
```bash
lsof -ti:31415 | xargs kill -9
```

---

### SDK 的工作原理

`@anthropic-ai/claude-agent-sdk` 不是直接调用 API，而是 spawn `bun cli.js` 子进程（即 Claude Code CLI），通过 stdio JSON 协议通信。认证复用 `~/.claude/` 下存储的 OAuth token（订阅用户）或 `ANTHROPIC_API_KEY`。
