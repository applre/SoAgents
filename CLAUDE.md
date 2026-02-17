# SoAgents - Claude Agent Desktop Client

## 产品定位

SoAgents 是基于 Claude Agent SDK 的桌面端 Agent 客户端，通过渐进式重建 MyAgents 项目来学习 Tauri + React + Bun 全栈开发。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri v2 (Rust) |
| 前端 | React 19 + TypeScript + Vite + TailwindCSS |
| 后端 | Bun + Claude Agent SDK (Sidecar) |
| 通信 | Rust HTTP/SSE Proxy (reqwest) |

## 项目结构

```
soagents/
├── src/
│   ├── renderer/          # React 前端
│   │   ├── api/           # SSE/HTTP 客户端
│   │   ├── context/       # Tab 状态管理
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── components/    # UI 组件
│   │   └── pages/         # 页面组件
│   ├── server/            # Bun 后端 (Sidecar)
│   └── shared/            # 前后端共享代码
├── src-tauri/             # Tauri Rust 代码
└── specs/                 # 设计文档（从 MyAgents 复制）
```

## 开发命令

```bash
bun install                 # 依赖安装
npm run tauri:dev           # Tauri 开发模式
npm run dev:web             # 纯前端开发
npm run typecheck           # 类型检查
```

## 核心原则

### 1. Tab-scoped 隔离
每个 Tab 拥有独立的 Sidecar 进程。

### 2. Rust 代理层
所有 HTTP/SSE 流量通过 Rust 代理层，禁止直接 fetch。

### 3. React 稳定性
- Context Provider value 必须 useMemo
- useEffect 依赖数组不放不稳定引用
- 定时器必须清理

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| React 组件 | PascalCase | `CustomTitleBar.tsx` |
| Hook | camelCase + use 前缀 | `useUpdater.ts` |
| Context | PascalCase + Context 后缀 | `TabContext.tsx` |
| Rust 模块 | snake_case | `sse_proxy.rs` |
