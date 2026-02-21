# SoAgents

桌面端 AI Agent 客户端，基于 Claude Agent SDK，通过 Tauri + React + Bun 全栈架构实现。

## 功能特性

- **多工作区隔离** - 每个工作区独立 Sidecar 进程，互不干扰
- **多 Provider 支持** - Anthropic、DeepSeek、Moonshot、智谱、MiniMax、火山引擎、硅基流动、OpenRouter
- **流式对话** - 实时流式输出，支持 Thinking 展示和工具调用可视化
- **Session 管理** - JSONL 持久化，支持历史对话加载、重命名、置顶、删除
- **权限控制** - 工具调用权限弹框，支持多种权限模式
- **MCP 集成** - 支持 STDIO/HTTP/SSE 协议
- **文件编辑器** - 内置代码编辑器，支持多语言高亮和 Markdown 预览
- **本地优先** - 所有数据本地存储，无云端依赖

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri v2 (Rust) |
| 前端 | React 19 + TypeScript + Vite + TailwindCSS v4 |
| 后端 | Bun + Claude Agent SDK (Sidecar) |
| 通信 | Rust HTTP/SSE Proxy (reqwest) |

## 系统要求

**用户**: macOS 13.0+（Apple Silicon & Intel）

**开发者**: 需要以下环境

| 依赖 | 最低版本 | 安装方式 |
|------|---------|---------|
| Node.js | v18+ | `brew install node` 或 [官网下载](https://nodejs.org/) |
| Bun | v1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| Rust | 1.77.2+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Xcode CLT | — | `xcode-select --install` |

> Tauri v2 编译需要 Xcode Command Line Tools，首次安装 Rust 后建议重启终端。

## 快速开始

```bash
git clone https://github.com/jingyu/SoAgents.git
cd SoAgents
bun install
```

首次启动后，Claude 订阅用户（Pro/Max）选择默认的 `Anthropic (订阅)` 即可直接使用；API 用户在设置页配置对应 Provider 的 API Key。

### 开发模式

```bash
# Tauri 桌面应用开发
npm run tauri:dev

# 纯前端开发（不启动 Tauri）
npm run dev:web
```

### 生产构建

```bash
npm run tauri:build
```

### 类型检查

```bash
npm run typecheck
```

## 项目结构

```
SoAgents/
├── src/
│   ├── renderer/          # React 前端
│   │   ├── api/           # SSE/HTTP 客户端
│   │   ├── context/       # Tab 状态管理
│   │   ├── components/    # UI 组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   └── pages/         # 页面组件
│   ├── server/            # Bun 后端 (Sidecar)
│   └── shared/            # 前后端共享类型
├── src-tauri/             # Tauri Rust 代码
│   └── src/
│       ├── lib.rs         # 应用入口
│       ├── sidecar.rs     # Sidecar 进程管理
│       ├── proxy.rs       # HTTP 代理
│       └── sse_proxy.rs   # SSE 代理
└── specs/                 # 设计文档
```

## 架构概览

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React 前端  │────▶│  Rust 代理层  │────▶│  Bun Sidecar    │
│  (Renderer)  │◀────│  (Tauri)     │◀────│  (Agent SDK)    │
└─────────────┘     └──────────────┘     └─────────────────┘
                    HTTP/SSE Proxy        每个工作区独立进程
```

- 所有 HTTP/SSE 流量通过 Rust 代理层，适配 Tauri 沙箱
- 每个工作区对应一个 Sidecar 进程，同工作区多 Session 共享进程
- Provider 配置通过环境变量传递给 SDK 子进程

## License

[MIT](LICENSE)
