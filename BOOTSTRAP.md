# SoAgents 项目构建指南

> 本文档记录了 SoAgents 项目的完整构建上下文，用于指导后续 Phase 2-10 的渐进式开发。

---

## 一、项目背景

SoAgents 是基于开源项目 [MyAgents](https://github.com/hAcKlyc/MyAgents) 的学习重建项目。目标是从零实现 v0.1.0 核心功能，技术栈完全沿用原项目。

**原项目研究成果**：已阅读 specs/ 目录下全部 16 篇文档（PRD、技术文档、指南、研究），提炼出完整的架构设计和实现路径。

---

## 二、技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Tauri v2 (Rust) | 2.9.5+ |
| 前端 | React 19 + TypeScript + Vite + TailwindCSS v4 | React 19.2, Vite 7.x |
| 后端 | Bun + Claude Agent SDK (多实例 Sidecar) | Bun 1.3.6, SDK 0.2.7+ |
| 通信 | Rust HTTP/SSE Proxy (reqwest) | reqwest 0.13 |
| 运行时 | Bun 内置于应用包（零外部依赖） | — |

---

## 三、核心架构（从 specs 提炼）

### 多实例 Sidecar 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Desktop App                         │
├──────────────────────────────────────────────────────────────┤
│                        React Frontend                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Chat 1    │  │   Chat 2    │  │  Settings   │          │
│  │ TabProvider │  │ TabProvider │  │  Launcher   │          │
│  │ Tab Sidecar │  │ Tab Sidecar │  │ Global API  │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
├─────────┼────────────────┼────────────────┼──────────────────┤
│         ▼                ▼                ▼     Rust Layer   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Bun Sidecar │  │ Bun Sidecar │  │   Global    │          │
│  │ :31415      │  │ :31416      │  │  Sidecar    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计约束

1. **Tab-scoped 隔离**：每个 Chat Tab 拥有独立的 Bun Sidecar 进程，API 调用必须发送到正确的 Sidecar
2. **Rust 代理层**：所有 HTTP/SSE 流量必须通过 Rust 代理层（绕过 WebView CORS），禁止前端直接 fetch
3. **SSE 事件隔离**：事件格式 `sse:{tabId}:{eventName}`，每个 Tab 只收到自己的事件
4. **零外部依赖**：应用内置 Bun 运行时，不依赖用户系统的 Node.js/npm
5. **Session 上下文保持**：配置变更时 resume session，只有用户点击「新对话」才创建全新 session

### 数据流

```
发送消息: React → invoke → Rust Proxy → reqwest POST → Bun HTTP → SDK query()
流式回复: SDK stream → Bun SSE broadcast → Rust reqwest stream → Tauri emit → React listen
```

---

## 四、Phase 1 已完成内容

### 项目结构

```
soagents/
├── CLAUDE.md              # 项目规范（命名、React 稳定性规则等）
├── BOOTSTRAP.md           # 本文件 - 构建指南
├── package.json           # name: "soagents", version: "0.1.0"
├── vite.config.ts         # root: src/renderer, alias @, proxy /api→:3000
├── tsconfig.json          # strict, path alias @/*→src/renderer/*
├── src/
│   ├── renderer/          # React 前端
│   │   ├── main.tsx       # 入口，createRoot
│   │   ├── App.tsx        # Hello World 占位
│   │   ├── index.html     # HTML 模板
│   │   ├── index.css      # TailwindCSS + 设计系统变量
│   │   ├── components/    # (空，待实现)
│   │   ├── pages/         # (空，待实现)
│   │   ├── hooks/         # (空，待实现)
│   │   ├── api/           # (空，待实现)
│   │   ├── context/       # (空，待实现)
│   │   ├── types/         # (空，待实现)
│   │   └── utils/         # (空，待实现)
│   ├── server/            # Bun 后端 (空，Phase 3 实现)
│   └── shared/            # 前后端共享代码 (空，待实现)
├── src-tauri/
│   ├── Cargo.toml         # name: "soagents", deps: tauri 2.9.5, serde, log
│   ├── tauri.conf.json    # productName: "SoAgents", devUrl: localhost:5174
│   ├── build.rs           # tauri_build::build()
│   ├── capabilities/default.json  # 最小权限
│   └── src/
│       ├── main.rs        # app_lib::run()
│       └── lib.rs         # Tauri Builder + logging + DevTools
└── specs/                 # 16篇设计文档（PRD/技术/指南/研究）
```

### 设计系统（CSS 变量，在 index.css 中）

```css
--paper: #f6efe5;          /* 主背景 */
--paper-light: #faf6f0;    /* 浅背景 */
--paper-dark: #ede4d8;     /* 深背景 */
--ink: #1c1612;            /* 主文字 */
--ink-secondary: #5c534a;  /* 次要文字 */
--ink-tertiary: #8a7f73;   /* 辅助文字 */
--accent-warm: #c26d3a;    /* 暖色强调 */
--accent-cool: #2e6f5e;    /* 冷色强调 */
--border: #d4c8b8;         /* 边框 */
--success: #2e6f5e;
--error: #c25a3a;
--warning: #c29a3a;
```

### Rust 当前状态

`lib.rs` 包含最小 Tauri 应用：plugin-shell、plugin-process、plugin-log，Debug 模式自动打开 DevTools。

### 验证状态

- Rust 编译通过（414 crates）
- `npm run tauri:dev` 窗口正常启动
- TailwindCSS 样式生效
- Git 初始提交完成

---

## 五、剩余 Phase 详细规划

### Phase 2: 自定义标题栏 + 多 Tab 系统

**目标**：Chrome 风格标题栏，多标签页创建/切换/关闭/拖拽排序

**步骤**：
1. 修改 `tauri.conf.json`：添加 `hiddenTitle: true`, `titleBarStyle: "Overlay"`, `trafficLightPosition: {x:14, y:20}`
2. 创建 `src/renderer/types/tab.ts` — Tab 数据模型
   ```typescript
   type Tab = { id: string; title: string; view: 'launcher' | 'chat' | 'settings'; agentDir: string | null; sessionId: string | null; isGenerating?: boolean }
   ```
3. 创建 `CustomTitleBar.tsx` — macOS 交通灯留白 + 拖拽区域 (`data-tauri-drag-region`)
4. 创建 `TabBar.tsx` — Tab 列表 + 新建/关闭按钮
5. 创建 `SortableTabItem.tsx` — @dnd-kit 拖拽排序（需安装 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`）
6. 改造 `App.tsx` — 多 Tab 状态管理，根据 `tab.view` 渲染不同页面
7. 键盘快捷键：Cmd+T 新建、Cmd+W 关闭

**关键参考**：原项目 `App.tsx`（约 412 行），`CustomTitleBar.tsx`，`TabBar.tsx`，`SortableTabItem.tsx`

---

### Phase 3: Bun Sidecar 进程管理

**目标**：Rust 启动/停止 Bun 进程，Bun 跑基础 HTTP 服务

**步骤**：
1. 创建 `src/server/index.ts` — Bun HTTP 服务器
   - 从环境变量 `PORT` 读取端口
   - `GET /health` → `{status: "ok"}`
   - `GET /api/ping` → `{message: "pong"}`
2. 创建 `src-tauri/src/sidecar.rs` — Rust 进程管理
   - `SidecarManager`: `Arc<Mutex<HashMap<String, SidecarInstance>>>`
   - `SidecarInstance`: `Child` 进程 + 端口 + 健康状态
   - 端口分配：`AtomicU16` 从 31415 递增
   - 启动：`std::process::Command` spawn Bun
   - 健康检查：60 × 100ms 轮询 `/health`
   - 停止：SIGTERM → 等5秒 → SIGKILL
   - `GLOBAL_SIDECAR_ID = "__global__"`
3. 创建 `src-tauri/src/commands.rs` — IPC 命令
   - `cmd_start_tab_sidecar(tab_id, agent_dir)`
   - `cmd_stop_tab_sidecar(tab_id)`
   - `cmd_get_tab_server_url(tab_id)` → `http://127.0.0.1:{port}`
   - `cmd_start_global_sidecar()`
   - `cmd_stop_all_sidecars()`
4. 更新 `lib.rs` — 注册命令和状态，应用退出清理
5. 添加 Cargo 依赖：`which`, `libc`（文件描述符限制）

**Rust 核心概念**：
- `Arc<Mutex<T>>` — 多线程共享可变状态
- `std::process::Command` — 子进程管理
- `#[tauri::command]` — IPC 命令宏
- `tauri::State<'_>` — 依赖注入

---

### Phase 4: HTTP 代理层

**目标**：React → Rust → Bun HTTP 通信，绕过 CORS

**步骤**：
1. 在 `src-tauri/src/sse_proxy.rs` 添加 `proxy_http_request` 命令
   - 接收：method, url, headers, body
   - 使用 `reqwest::Client` 转发
   - 返回响应 body
2. 创建 `src/renderer/api/tauriClient.ts` — Tauri IPC 封装
   - `getTabServerUrl(tabId)` — invoke Rust 获取 URL
   - `startTabSidecar(tabId, agentDir)` — invoke 启动
   - `stopTabSidecar(tabId)` — invoke 停止
   - 浏览器模式 fallback（开发时直接 fetch localhost:3000）
3. 创建 `src/renderer/api/apiFetch.ts` — HTTP 代理封装
   - `proxyFetch(url, options)` — 通过 Rust 代理发送
   - 全局 API：`apiGetJson(path)`, `apiPostJson(path, body)`
4. 创建 `src/renderer/utils/browserMock.ts` — 环境检测
   - `isTauriEnvironment()` / `isBrowserDevMode()`

**添加 Cargo 依赖**：`reqwest = { version = "0.13.1", features = ["stream"] }`, `tokio`, `futures-util`

---

### Phase 5: SSE 代理 + 流式事件

**目标**：Bun → Rust → React 的 SSE 事件流

**步骤**：
1. 创建 `src/server/sse.ts` — Bun SSE 服务
   - SSE 客户端管理（Map<id, Response>）
   - `GET /chat/events` — SSE 端点
   - 心跳：每 15 秒 `:heartbeat\n\n`
   - `broadcast(event, data)` — 推送事件
2. 完善 `src-tauri/src/sse_proxy.rs` — Rust SSE 代理
   - `SseProxyState`: `Mutex<HashMap<String, SseConnection>>`
   - `start_sse_proxy(url, tab_id)` — 连接 Bun SSE 端点
   - 使用 `reqwest` stream + `futures_util` 解析 `data:` / `event:` 行
   - 转发为 Tauri 事件：`app.emit(&format!("sse:{}:{}", tab_id, event_name), data)`
   - `stop_sse_proxy(tab_id)` — 断开
3. 创建 `src/renderer/api/SseConnection.ts` — 前端 SSE 接收
   - Tauri 模式：`listen('sse:{tabId}:*')` 监听事件
   - 浏览器模式：原生 `EventSource`
   - 事件分类：JSON 事件 / 字符串事件 / 空载事件
   - 回调注册：`on(eventName, callback)`

**SSE 事件列表（后续逐步添加）**：
```
chat:message-chunk (string) — 流式文本片段
chat:message-complete (null) — 消息完成
chat:message-error (string) — 错误
chat:thinking-start (json) — 思考开始
chat:thinking-chunk (json) — 思考片段
chat:tool-use-start (json) — 工具调用开始
chat:tool-input-delta (json) — 工具输入增量
chat:tool-result-complete (json) — 工具结果
chat:system-init (json) — 系统初始化信息
chat:status (json) — 系统状态
permission:request (json) — 权限请求
```

---

### Phase 6: Claude Agent SDK 集成 + 基础对话

**目标**：接入 SDK，实现发送消息和流式接收 AI 回复

**步骤**：
1. `bun add @anthropic-ai/claude-agent-sdk`
2. 创建 `src/server/agent-session.ts` — SDK 集成核心
   - `initializeAgent(agentDir)` — 初始化，创建 session
   - 消息生成器：`async function* messageGenerator()` — yield 用户消息给 SDK
   - `query({prompt, options})` 调用，处理 streaming 事件
   - SDK 事件 → SSE broadcast：
     - `content_block_delta` (text) → `chat:message-chunk`
     - `content_block_delta` (thinking) → `chat:thinking-chunk`
     - `content_block_start` (tool_use) → `chat:tool-use-start`
     - `message_stop` → `chat:message-complete`
   - `enqueueUserMessage(message)` — 用户消息入队
   - `interruptCurrentResponse()` — 中断
   - `resetSession()` — 重置
3. Bun HTTP 路由扩展：
   - `POST /chat/send` — `{message, images?, permissionMode?, model?, providerEnv?}`
   - `POST /chat/reset` — 重置会话
   - `POST /chat/stop` — 中断响应
   - `GET /chat/messages` — 获取消息历史
   - `GET /agent/state` — 代理状态
   - `GET /api/system/init-info` — 系统信息
4. 创建 `src/renderer/context/TabContext.tsx` — Tab 状态定义
   ```typescript
   interface TabState {
     tabId: string; agentDir: string; sessionId: string | null;
     messages: Message[]; isLoading: boolean; sessionState: 'idle' | 'running' | 'error';
     systemInitInfo: SystemInitInfo | null;
   }
   ```
5. 创建 `src/renderer/context/TabProvider.tsx` — Tab 状态容器
   - 管理 SSE 连接生命周期
   - 处理所有 SSE 事件 → 更新 messages 状态
   - 提供 `sendMessage()`, `stopResponse()`, `resetSession()`, `apiGet()`, `apiPost()`
6. 创建 `src/renderer/pages/Chat.tsx` — 对话页面
7. 创建 `src/renderer/components/MessageList.tsx` — 消息列表
8. 创建 `src/renderer/components/Message.tsx` — 消息气泡 + Markdown 渲染
9. 创建 `src/renderer/components/ChatInput.tsx` — 输入框

**SDK 关键 API**：
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
const result = query({
  prompt: messages,
  options: {
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    cwd: agentDir,
    permissionMode: 'acceptEdits',
  }
});
for await (const event of result) { /* 处理流式事件 */ }
```

---

### Phase 7: 完整对话体验

**目标**：Tool Use 展示、Thinking Block、权限弹窗、Slash Commands

**步骤**：
1. 工具展示组件 `src/renderer/components/tools/`：
   - `ToolUse.tsx` — 折叠面板容器
   - `BashTool.tsx` — 命令执行显示
   - `ReadTool.tsx`, `WriteTool.tsx`, `EditTool.tsx` — 文件操作
   - `GlobTool.tsx`, `GrepTool.tsx` — 搜索工具
   - `ProcessRow.tsx` — Task 子代理展示（运行时间、工具调用次数）
2. `PermissionPrompt.tsx` — 权限弹窗（Allow/Deny/Always Allow）
   - SSE `permission:request` 事件触发
   - POST `/chat/permission-response` 返回决策
3. `AskUserQuestionPrompt.tsx` — AI 向用户提问的 UI
4. `SlashCommandMenu.tsx` — Slash 命令菜单
   - 检测 `/` 输入，模糊搜索
   - 键盘导航（上下箭头 + Enter）
5. `useAutoScroll.ts` — 消息自动滚动到底部
6. 消息类型系统 `src/renderer/types/chat.ts`：
   ```typescript
   type Message = { id: string; role: 'user' | 'assistant'; blocks: ContentBlock[] }
   type ContentBlock = { type: 'text' | 'tool_use' | 'thinking'; ... }
   ```

---

### Phase 8: Session 管理 + 历史记录

**目标**：JSONL 持久化、历史列表、会话切换

**步骤**：
1. `src/server/SessionStore.ts` — 存储层
   - 索引：`~/.myagents/sessions.json`（改为 `~/.soagents/sessions.json`）
   - 消息：`~/.soagents/sessions/{id}.jsonl`（每行一条消息，O(1) 追加）
   - 目录锁：`mkdirSync(LOCK_PATH)` 原子锁，stale 检测（>30s）
   - 增量统计：行数缓存，Token 累计
2. `src/server/types/session.ts`：
   ```typescript
   type SessionMetadata = { id: string; title: string; agentDir: string; createdAt: string; messageCount: number; tokenUsage: {...} }
   ```
3. `SessionHistoryDropdown.tsx` — 历史面板
4. 会话切换：`switchToSession(sessionId)` — 加载消息 + resume SDK
5. 新对话重置：`resetSession()` — 前后端同步，`isNewSessionRef` 防御（详见 specs/tech_docs/session_state_sync.md）

**9 种会话结束场景**（全部需要重置 isLoading/sessionState/systemStatus）：
1. message_stop（正常结束）
2. message_error
3. 用户中断
4. 网络断开
5. SDK 异常
6. 会话切换
7. 新对话重置
8. Tab 关闭
9. 应用退出

---

### Phase 9: 多 Provider + 设置页

**目标**：Anthropic 订阅、API Key、自定义供应商

**步骤**：
1. `src/renderer/pages/Settings.tsx` — 设置页
2. `src/renderer/config/configService.ts` — 配置读写
3. Provider 切换机制（在 Bun 进程设置环境变量）：
   - Anthropic 官方：不设 `ANTHROPIC_BASE_URL`
   - 三方供应商：设 `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_API_KEY`
   - 切回官方时必须 `delete env.ANTHROPIC_BASE_URL`
4. Provider 持久化：`~/.soagents/providers/`
5. 预设供应商：Anthropic、DeepSeek（`/anthropic`）、Moonshot（`/anthropic`）、智谱（`/api/anthropic`）、MiniMax
6. 切换时 resume session（`shouldAbortSession + resumeSessionId`），不丢上下文

**关键陷阱**：三方供应商 → Anthropic 官方切换时，Thinking Block 签名不兼容，不能 resume，需要新建 session（详见 specs/tech_docs/third_party_providers.md）

---

### Phase 10: MCP + Skills + 工作区

**目标**：完成 v0.1.0 全部核心功能

**MCP 集成**：
- `POST /api/mcp/set` — 设置 MCP 服务器配置
- MCP 包安装：`bun add <package>` 到 `~/.soagents/mcp/<serverId>/`
- `canUseTool` 回调：必须包含 `updatedInput`（详见 specs/tech_docs/sdk_canUseTool_guide.md）

**Skills 系统**：
- 扫描 `~/.claude/skills/` 和 `.claude/skills/`
- 解析 SKILL.md（YAML frontmatter：name, description, allowed-tools, context, agent）
- `/skill-name` slash command 触发
- Skills 管理面板（列表、详情、新建）

**工作区管理**：
- `react-arborist` 文件树组件
- `src/server/dir-info.ts` — 目录扫描 API
- 文件预览（Monaco Editor 或 react-syntax-highlighter）
- `Launcher.tsx` — 启动页（最近项目、快速访问）

---

## 六、React 稳定性规范（必须遵循）

1. **Context Provider value 必须 useMemo**
2. **useEffect 依赖数组禁止放不稳定引用**（toast、api 对象、inline callback、对象字面量）
3. **跨组件回调用 useRef 稳定化**
4. **定时器必须在 cleanup 中清理**
5. **不使用 React.StrictMode**（会导致 SSE useEffect 双执行）

---

## 七、关键文件路径速查

| 用途 | 路径 |
|------|------|
| Tauri 窗口配置 | `src-tauri/tauri.conf.json` |
| Rust 入口 | `src-tauri/src/lib.rs` |
| React 入口 | `src/renderer/main.tsx` |
| App 组件 | `src/renderer/App.tsx` |
| CSS 变量/Tailwind | `src/renderer/index.css` |
| Vite 配置 | `vite.config.ts` |
| 项目规范 | `CLAUDE.md` |
| 设计文档 | `specs/` |

---

## 八、开发命令

```bash
bun install                 # 安装依赖
npm run tauri:dev           # Tauri 开发模式（完整桌面体验）
npm run dev:web             # 纯前端 Vite 开发
npm run typecheck           # TypeScript 类型检查
bun run server              # 单独启动 Bun 后端
```

---

## 九、specs 文档索引

| 文档 | 内容摘要 |
|------|----------|
| `specs/prd/PRD_MyAgents_v1.0.md` | 完整产品需求：功能模块、竞品分析、路线图 |
| `specs/version.md` | v0.1.0~v0.1.4 版本记录 |
| `specs/tech_docs/architecture.md` | 多实例 Sidecar 架构图、SSE 事件隔离 |
| `specs/tech_docs/third_party_providers.md` | 三方供应商环境变量切换、Thinking Block 签名陷阱 |
| `specs/tech_docs/bundled_bun.md` | Bun 内置打包、运行时路径优先级 |
| `specs/tech_docs/auto_update.md` | Tauri Updater + Cloudflare R2 |
| `specs/tech_docs/sdk_canUseTool_guide.md` | canUseTool 回调、updatedInput 必传、超时机制 |
| `specs/tech_docs/session_state_sync.md` | SSE 重连防重放、isNewSessionRef、9 种结束场景 |
| `specs/tech_docs/session_storage.md` | JSONL 存储、目录锁、增量统计 |
| `specs/tech_docs/unified_logging.md` | React/Bun/Rust 三源日志汇聚 |
| `specs/guides/design_guide.md` | 温暖纸张质感设计系统 |
| `specs/guides/build_and_release_guide.md` | build_macos.sh、publish_release.sh |
| `specs/guides/macos_distribution_guide.md` | Apple 签名 + 公证 |
| `specs/research/claude_code_skills_research.md` | Skills 规范、SDK 集成方案 |
| `specs/research/clawdbot-architecture-analysis.md` | Bot 网关架构参考 |
| `specs/research/china-platforms-integration-guide.md` | 飞书/企微/QQ/钉钉 Bot 集成 |
