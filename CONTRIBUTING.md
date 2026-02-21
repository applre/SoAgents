# Contributing to SoAgents

感谢你对 SoAgents 的关注！欢迎提交 Issue 和 Pull Request。

## 开发环境搭建

### 前置依赖

| 依赖 | 最低版本 | 安装方式 |
|------|---------|---------|
| Node.js | v18+ | `brew install node` |
| Bun | v1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| Rust | 1.77.2+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Xcode CLT | — | `xcode-select --install` |

### 启动开发

```bash
git clone https://github.com/applre/SoAgents.git
cd SoAgents
bun install
npm run tauri:dev
```

## 代码规范

### 命名

| 类型 | 规范 | 示例 |
|------|------|------|
| React 组件 | PascalCase | `LeftSidebar.tsx` |
| Hook | camelCase + use 前缀 | `useAutoScroll.ts` |
| Context | PascalCase + Context 后缀 | `TabContext.tsx` |
| Rust 模块 | snake_case | `sse_proxy.rs` |

### 提交信息

使用中文 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
feat: 新增会话置顶功能
fix: 修复代码块在用户消息中显示为白色的问题
refactor: 提取共享类型到 src/shared/
docs: 更新 README 依赖说明
```

### 架构原则

- **Workspace 隔离** — 每个工作区独立 Sidecar 进程，同工作区多 Session 共享进程
- **Rust 代理层** — 所有 HTTP/SSE 流量经由 Rust 代理，禁止前端直接 fetch
- **共享类型** — 前后端公用类型放 `src/shared/types/`，避免重复定义

## 提交 Pull Request

1. Fork 仓库并创建分支
2. 确保 `npm run typecheck` 和 `cargo check` 通过
3. 提交 PR 并描述改动内容

## 报告问题

请通过 [GitHub Issues](https://github.com/applre/SoAgents/issues) 提交，包含：

- 系统版本（macOS 版本、芯片类型）
- 复现步骤
- 期望行为 vs 实际行为
