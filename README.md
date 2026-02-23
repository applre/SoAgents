# SoAgents

桌面端 AI Agent 客户端，基于 Claude Agent SDK，通过 Tauri + React + Bun 全栈架构实现。



# 目标用户与应用场景

## 目标用户

| 用户类型 | 典型场景 | 核心需求 |
|----------|----------|----------|
| **内容创作者** | 写作、剪辑脚本、社媒运营 | 快速生成、批量处理、风格一致 |
| **学生/研究者** | 论文整理、代码学习、资料分析 | 学习辅助、知识整理、代码解释 |
| **产品经理** | PRD 撰写、竞品分析、数据整理 | 文档生成、信息提取、格式转换 |
| **独立开发者** | 原型开发、代码生成、调试 | 快速迭代、多项目并行、MCP 扩展 |
| **各行业专家** | 领域知识应用、自动化任务 | 专业 Prompt、工作流定制 |

## 核心应用场景

**场景 1: 多项目并行开发**
> 开发者同时在 Tab 1 中让 AI 重构前端代码，Tab 2 中让 AI 编写后端 API，Tab 3 中让 AI 整理文档。三个任务真并行，互不阻塞。

**场景 2: 灵活的模型选择**
> 用户在编写代码时使用 Claude Sonnet（高质量），在简单对话时切换到 DeepSeek（低成本），模型切换不丢失对话上下文。

**场景 3: MCP 工具扩展**
> 用户配置 MCP 服务器连接数据库查询工具，AI 可以直接查询线上数据并生成报表，无需离开应用。

## 功能特性

- **本地优先** - 所有数据本地存储，无云端依赖
- **多工作区隔离** - 每个工作区独立 Sidecar 进程，互不干扰
- **多 Provider 支持** - Anthropic、DeepSeek、Moonshot、智谱、MiniMax、OpenRouter
- **流式对话** - 实时流式输出，支持 Thinking 展示和工具调用可视化
- **Session 管理** - JSONL 持久化，支持历史对话加载、重命名、置顶、删除
- **MCP 集成** - 支持 STDIO/HTTP/SSE 协议
- **文件编辑器** - 内置代码编辑器，支持多语言高亮和 Markdown 预览
- **权限控制** - 工具调用权限弹框，支持多种权限模式

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
git clone https://github.com/applre/SoAgents.git
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
