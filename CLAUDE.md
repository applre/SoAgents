# SoAgents - Desktop AI Agent

基于 Claude Agent SDK 的桌面端 Agent 客户端。使用 Conventional Commits，不提交敏感信息。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri v2 (Rust) |
| 前端 | React 19 + TypeScript + Vite + TailwindCSS |
| 后端 | Bun + Claude Agent SDK (Sidecar 进程) |
| 通信 | Rust HTTP/SSE Proxy (reqwest) |
| 运行时 | Bun 内置于应用包（用户无需安装 Bun 或 Node.js） |

## 项目结构

- `src/renderer/` — React 前端（config/、context/、hooks/、components/、pages/）
- `src/server/` — Bun 后端 Sidecar
- `src/shared/` — 前后端共享类型（`types/` 下按领域分文件）
- `src-tauri/` — Tauri Rust 层
- `specs/` — 设计文档（tech_docs/、guides/、prd/）
- `bundled-skills/` — 内置技能（启动时自动种子化到 `~/.soagents/skills/`）

## 参考代码库

`~/repos/MyAgents` 是功能参考代码库（Apache-2.0 开源）。移植功能时 MUST 先读 MyAgents 对应源文件理解上下文，禁止凭猜测移植。**绝对不要修改 MyAgents 的文件。**
- 对比 SoAgents 与 MyAgents 或其他参考代码库时，聚焦于对 SoAgents 具体相关/可移植的内容，而不是给出泛泛的概述。

## 开发命令

```bash
bun install                 # 依赖安装
npm run tauri:dev           # Tauri 开发模式（推荐）
npm run typecheck           # 类型检查（tsc --noEmit）
npm run lint                # ESLint 检查
npm run typecheck && npm run lint  # 提交前必跑
```

---

## 核心架构约束

### 持久 Session 架构

`src/server/agent-session.ts` 的 SessionRunner 使用 AsyncGenerator 驱动 SDK `query()`，子进程常驻。所有中止场景 MUST 通过统一的 abort 机制，禁止直接设标志位导致 generator 永久阻塞。

### Sidecar 隔离

每个 Session 独立 Bun Sidecar 进程（`SidecarOwner::Session`），按需启动，空闲 10 分钟回收。

### Rust 代理层

所有前端 HTTP/SSE 流量 MUST 通过 Rust 代理层（`invoke` -> Rust -> reqwest -> Bun Sidecar），**禁止**从 WebView 直接发起 HTTP 请求。

### localhost 连接（代理陷阱）

所有连接本地 Sidecar（`127.0.0.1`）的 reqwest 客户端 MUST 带 `.no_proxy()`，防止系统代理（Clash/V2Ray）拦截 localhost 导致 502。当前散落在 `proxy.rs`、`sse_proxy.rs`、`sidecar.rs`、`scheduler.rs` 四处，后续应集中为 `local_http` 模块。

### 零外部依赖

应用内置 Bun 运行时，MUST NOT 依赖用户系统的 Node.js/npm/npx。Sidecar 内通过 `child_process.spawn` 启动子进程时，MUST 使用 `process.env.BUN_EXECUTABLE`（Rust 层注入的内置 bun 完整路径），禁止裸写 `"bun"`。macOS GUI 应用的 PATH 只有 `/usr/bin:/bin:/usr/sbin:/sbin`，找不到用户安装的 bun。

### Config 持久化（disk-first）

配置同时存在于磁盘（`~/.soagents/config.json`）和 React 状态中，两者可能不同步。写入配置时 MUST 以磁盘为准（读最新再合并），禁止直接使用 React state 写盘（会覆盖其他字段如 API Key）。

### React 稳定性规则

1. Context value 必须 useMemo，避免每次渲染创建新对象触发全子树重渲染
2. useEffect 依赖数组不放不稳定引用（对象、数组、函数），用 ref 或 primitive 替代
3. 定时器（setInterval/setTimeout）必须在 cleanup 中清理
4. 不在渲染期间更新 ref（ESLint react-compiler/no-set-state-in-render）
5. spread array 不放依赖数组（每次渲染都是新引用），用 `.length` 或 triggerCount 替代

---

## 禁止事项

| 禁止 | 后果 | 正确做法 |
|------|------|----------|
| WebView 直接 fetch | CORS 失败 | 经 Rust 代理 |
| 裸 `reqwest::Client` 连 localhost | 系统代理 -> 502 | 加 `.no_proxy()` |
| 依赖系统 npm/npx/Node.js | 用户未安装 | 内置 bun |
| Config 写盘用 React state | 覆盖其他字段 | 磁盘读最新再合并 |
| Sidecar 用 `__dirname` / `readFileSync` | bun build 硬编码路径 | 内联常量 |
| 日志日期用 UTC `toISOString` | 与本地日期文件名不匹配 | 用本地时间 |
| UI 硬编码颜色（`#fff`、`bg-blue-500`） | 破坏设计系统 | 使用 CSS Token `var(--xxx)` |
| 新增 SSE 事件不在前端注册 | 前端静默丢弃该事件 | 前端 SSE 白名单注册 |
| Sidecar 内 `child_process.spawn("bun")` | macOS GUI 应用 PATH 无 bun → 静默挂起 | 用 `process.env.BUN_EXECUTABLE \|\| 'bun'` |
| `SessionTabBar` tab 容器用 `flex-1` | 空白区域 stopPropagation 拦截拖拽，标题栏无法拖动窗口 | tab 容器不加 `flex-1`，右侧按钮用 `ml-auto` |

---

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| React 组件 | PascalCase | `CustomTitleBar.tsx` |
| Hook | camelCase + use 前缀 | `useUpdater.ts` |
| Context | PascalCase + Context 后缀 | `TabContext.tsx` |
| Rust 模块 | snake_case | `sse_proxy.rs` |
| 共享类型 | `src/shared/types/` 下按领域分文件 | `config.ts`, `session.ts` |

## UI 设计规范

### 设计原则（详见 `specs/guides/design_guide.md` Section 0）

| 原则 | 含义 |
|------|------|
| 阅读体验优先 | 16px 正文、768px 最大宽度、1.6 行高，一切围绕长文本阅读舒适性 |
| 层级清晰有重点 | AI 回复(L1) > 用户输入(L2) > 工具结果(L3) > 工具过程(L4) > 思考(L5) |
| 温暖但克制 | 暖色调亲和，装饰极少，颜色用于语义不用于装饰，动效 150-300ms |
| 一致性即信任 | CSS 变量驱动，禁止硬编码颜色，组件复用优先 |
| 原生质感 | 接近 macOS 原生应用质感，系统字体优先，尊重平台规范 |

品牌个性：**温暖 · 专业 · 高效**。参考方向：Apple 原生应用 / Notion / Arc / Linear。

### CSS 变量（定义在 `src/renderer/index.css`）

| 变量 | 值 | 用途 |
|------|-----|------|
| `--paper` | `#FBF9F6` | 页面底色、卡片背景 |
| `--surface` | `#F5F3F0` | 输入框/次级区域背景 |
| `--hover` | `#EEEBE7` | 悬停态背景 |
| `--ink` | `#1A1A1A` | 主文字 |
| `--ink-secondary` | `#666666` | 次级文字 |
| `--ink-tertiary` | `#999999` | 辅助文字、图标 |
| `--accent` | `#C4956A` | 强调色（暖棕） |
| `--border` | `#E8E6E3` | 边框 |
| `--error` | `#c25a3a` | 错误/危险 |
| `--success` | `#2e6f5e` | 成功 |

### 字体

- 字体族：`Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- 字号：`text-[18px]` 页面标题 / `text-[14px]` 正文 / `text-[13px]` 交互元素 / `text-[12px]` 辅助标签
- 字重：`font-medium`（交互元素）、`font-semibold`（标题、主按钮）

### 组件规则

- **按钮**：主按钮 `bg-[var(--accent)] text-white rounded-lg`；次按钮 `border-[var(--border)] rounded-lg hover:bg-[var(--hover)]`
- **输入框**：`rounded-lg px-3 py-2 text-[14px] bg-[var(--surface)] border-[var(--border)]`
- **下拉**：禁止原生 `<select>`，统一用 `CustomSelect` 组件
- **模态框**：遮罩 `bg-black/40`，容器 `rounded-xl/2xl bg-[var(--paper)] shadow-2xl`，宽 400~480px
- **图标**：Lucide React，12~16px，颜色跟随文字
- **圆角**：`rounded-md`（Tab）/ `rounded-lg`（按钮、输入、卡片）/ `rounded-xl`（面板）/ `rounded-2xl`（大弹窗）
- **动效**：`transition-colors`，主按钮 `hover:opacity-90`，次按钮 `hover:bg-[var(--hover)]`

---

## 日志与排查

日志来自三层（React/Bun Sidecar/Rust），汇入统一日志 `~/.soagents/logs/unified-{YYYY-MM-DD}.log`。用户报告问题时 MUST 主动读取日志。

- 开发版日志目录：`~/.soagents/logs_dev/`
- 发布版日志目录：`~/.soagents/logs/`
- Rust 层日志：`/Users/{user}/Library/Logs/com.soagents.app/SoAgents.log`

---

## Git 与工作流

- **提交前 MUST**：`npm run typecheck && npm run lint`，检查当前分支（`git branch --show-current`）
- **分支策略**：`dev/x.x.x` 开发 -> 合并到 `main`。MUST NOT 在 main 直接提交
- **Commit 格式**：Conventional Commits（`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`）
- **发布流程**：更新 CHANGELOG.md -> package.json version -> 构建 -> 发布 -> push tag
- **发布流程**：发布release、更新 CHANGELOG.md，不要有 对齐 MyAgents ，和MyAgents一致  这类字样，不要提到MyAgents

---

## 从 MyAgents 移植工作流

移植功能时遵循以下步骤：

1. **读 PRD**：先读 `specs/prd/` 下对应版本的 PRD，明确要做什么
2. **读 MyAgents 源码**：读 `~/repos/MyAgents` 中对应的实现文件，理解完整上下文
3. **适配差异**：
   - 路径：`~/.myagents/` -> `~/.soagents/`
   - 产品名：`MyAgents` -> `SoAgents`
   - 包标识：`com.myagents.app` -> `com.soagents.app`
   - 导入路径和项目结构差异需逐一对照
4. **实现**：编写代码，每完成一个功能点运行 `npm run typecheck && npm run lint`
5. **验收**：告知用户如何手动测试，等待确认

---

## 深度文档

修改相关模块前建议先阅读：

- 整体架构：@specs/tech_docs/architecture.md
- 统一日志：@specs/tech_docs/unified_logging.md
- 内置 Bun 运行时：@specs/tech_docs/bundled_bun.md
- Session 状态同步：@specs/tech_docs/session_state_sync.md
- Session 持久化存储：@specs/tech_docs/session_storage.md
- 第三方供应商接入：@specs/tech_docs/third_party_providers.md
- 自动更新：@specs/tech_docs/auto_update.md
- 定时任务 PRD：@specs/prd/PRD_ScheduledTasks_v1.0.md
- 设计规范：@specs/guides/design_guide.md
- 构建与发布：@specs/guides/build_and_release_guide.md
