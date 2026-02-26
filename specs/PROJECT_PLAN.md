# SoAgents 项目计划书

> **文档版本**: v1.0
> **编写日期**: 2026-02-19
> **项目名称**: SoAgents
> **项目性质**: 基于 Claude Agent SDK 的开源桌面端 AI Agent 客户端
> **学习参考**: [SoAgents](https://github.com/hAcKlyc/SoAgents) (Apache 2.0)

---

## 目录

1. [项目概述](#1-项目概述)
2. [项目目标](#2-项目目标)
3. [目标用户与应用场景](#3-目标用户与应用场景)
4. [技术方案](#4-技术方案)
5. [功能规划](#5-功能规划)
6. [开发计划与里程碑](#6-开发计划与里程碑)
7. [项目现状](#7-项目现状)
8. [后续迭代规划](#8-后续迭代规划)
9. [风险评估与应对](#9-风险评估与应对)
10. [资源需求](#10-资源需求)
11. [质量保障](#11-质量保障)
12. [附录](#12-附录)

---

## 1. 项目概述

### 1.1 项目背景

2026 年是 AI Agent 爆发的元年。Claude Agent SDK 的开源为开发者提供了构建强大 AI Agent 的基础能力，但目前大多数 Agent 工具仍以命令行为主（如 Claude Code CLI），对非技术用户存在较高的使用门槛。

SoAgents 项目旨在通过学习和建设一个开源项目，掌握桌面端 AI Agent 客户端的完整技术栈，并在此基础上探索创新方向。

### 1.2 项目定位

SoAgents 是一个**基于 Claude Agent SDK 的桌面端通用 AI Agent 客户端**，通过图形化界面降低 AI Agent 的使用门槛，让更多人能够利用 AI Agent 的强大能力。

### 1.3 核心价值主张

| 价值维度 | 描述 |
|----------|------|
| **零门槛** | GUI 图形界面，无需命令行经验 |
| **真并行** | 多 Tab 独立进程架构，同时处理多个项目 |
| **多模型** | 支持 Anthropic、DeepSeek、Moonshot、智谱等 7+ 供应商 |
| **本地隐私** | 所有数据存储在本地，不上传云端 |
| **可扩展** | MCP 工具协议 + Skills 技能系统 |

---

## 2. 项目目标

### 2.1 总体目标

从零构建一个功能完整的桌面端 AI Agent 客户端，覆盖对话交互、多项目管理、工具扩展、模型切换等核心场景。

### 2.2 阶段目标

| 阶段 | 目标 | 衡量标准 |
|------|------|----------|
| **Phase 1 (基础搭建)** | 完成项目脚手架和技术栈验证 | Tauri + React + Vite 窗口正常启动 |
| **Phase 2 (UI 框架)** | 实现多 Tab 系统和自定义标题栏 | Tab 创建/切换/关闭/拖拽排序正常 |
| **Phase 3 (进程管理)** | 实现 Bun Sidecar 进程的启动与管理 | 每个 Tab 独立 Bun 进程，健康检查通过 |
| **Phase 4 (通信层)** | 打通 React → Rust → Bun HTTP 通信 | 前端发请求经 Rust 代理到 Bun 并返回 |
| **Phase 5 (流式传输)** | 实现 SSE 事件流代理 | Bun 推送事件经 Rust 到达 React |
| **Phase 6 (核心对话)** | 接入 Claude Agent SDK，实现基础对话 | 发送消息并流式接收 AI 回复 |
| **Phase 7 (完整体验)** | Tool Use、Thinking Block、权限弹窗 | 完整的 Agent 交互体验 |
| **Phase 8 (持久化)** | Session 管理和历史记录 | 对话持久化，历史可恢复 |
| **Phase 9 (多供应商)** | 多 Provider 支持和设置页 | 切换供应商不丢失上下文 |
| **Phase 10 (生态集成)** | MCP 工具 + Skills + 工作区管理 | v0.1.0 核心功能完整 |

### 2.3 学习目标

作为学习项目，SoAgents 同时承担以下技术学习目标：

- **Tauri v2**: 掌握 Rust 桌面应用框架，IPC 通信、进程管理、系统集成
- **多进程架构**: 理解 Sidecar 模式、进程隔离与生命周期管理
- **流式通信**: SSE 代理、事件路由、连接管理
- **AI Agent SDK**: Claude Agent SDK 集成、工具调用、权限控制
- **React 工程化**: 大型 Context 架构、性能优化、稳定性规范

---

## 3. 目标用户与应用场景

### 3.1 目标用户

| 用户类型 | 典型场景 | 核心需求 |
|----------|----------|----------|
| **内容创作者** | 写作、剪辑脚本、社媒运营 | 快速生成、批量处理、风格一致 |
| **学生/研究者** | 论文整理、代码学习、资料分析 | 学习辅助、知识整理、代码解释 |
| **产品经理** | PRD 撰写、竞品分析、数据整理 | 文档生成、信息提取、格式转换 |
| **独立开发者** | 原型开发、代码生成、调试 | 快速迭代、多项目并行、MCP 扩展 |
| **各行业专家** | 领域知识应用、自动化任务 | 专业 Prompt、工作流定制 |

### 3.2 核心应用场景

**场景 1: 多项目并行开发**
> 开发者同时在 Tab 1 中让 AI 重构前端代码，Tab 2 中让 AI 编写后端 API，Tab 3 中让 AI 整理文档。三个任务真并行，互不阻塞。

**场景 2: 灵活的模型选择**
> 用户在编写代码时使用 Claude Sonnet（高质量），在简单对话时切换到 DeepSeek（低成本），模型切换不丢失对话上下文。

**场景 3: MCP 工具扩展**
> 用户配置 MCP 服务器连接数据库查询工具，AI 可以直接查询线上数据并生成报表，无需离开应用。

---

## 4. 技术方案

### 4.1 技术栈

| 层级 | 技术选型 | 版本 | 选型理由 |
|------|----------|------|----------|
| **桌面框架** | Tauri v2 (Rust) | 2.9.5 | 体积小、性能高、安全性好 |
| **前端** | React 19 + TypeScript + Vite | React 19.2.4, Vite 7.3.1 | 生态成熟、类型安全、开发效率高 |
| **样式** | TailwindCSS v4 | 4.1.18 | 原子化 CSS、快速迭代 |
| **代码编辑** | CodeMirror 6 | 6.x | 轻量、扩展性强 |
| **拖拽排序** | @dnd-kit | 6.3.1 | React 18/19 兼容 |
| **后端运行时** | Bun | 1.3.6 | 启动快、内置运行时 |
| **AI SDK** | Claude Agent SDK | 0.2.44 | 官方 SDK，功能完整 |
| **通信代理** | Rust reqwest | 0.12 | 绕过 CORS、低延迟 |
| **存储** | 本地文件系统 (JSONL) | — | 隐私保护、无需数据库 |

### 4.2 核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                       Tauri Desktop App                          │
├──────────────────────────────────────────────────────────────────┤
│                         React Frontend                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Tab 1     │  │   Tab 2     │  │  Settings   │              │
│  │ (项目 A)    │  │ (项目 B)    │  │  Launcher   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
├─────────┼────────────────┼────────────────┼──────────────────────┤
│         ▼                ▼                ▼       Rust Layer     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ HTTP/SSE    │  │ HTTP/SSE    │  │ HTTP Proxy  │              │
│  │ Proxy       │  │ Proxy       │  │             │              │
│  │ :31415      │  │ :31416      │  │ :31417      │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
├─────────┼────────────────┼────────────────┼──────────────────────┤
│         ▼                ▼                ▼   Bun Sidecar Layer  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Sidecar 1   │  │ Sidecar 2   │  │ Global API  │              │
│  │ Claude SDK  │  │ Claude SDK  │  │ 全局配置     │              │
│  │ 独立进程 ✓  │  │ 独立进程 ✓  │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 关键设计原则

| 原则 | 说明 |
|------|------|
| **Tab 隔离** | 每个 Tab 拥有独立 Bun Sidecar 进程，崩溃隔离、真并行 |
| **Rust 代理** | 所有 HTTP/SSE 流量经 Rust 代理层，绕过 WebView CORS |
| **SSE 事件路由** | 事件格式 `sse:{tabId}:{eventName}`，精确路由到目标 Tab |
| **零外部依赖** | Bun 运行时内置于应用包，用户无需安装 Node.js |
| **Session 上下文保持** | 切换模型/供应商保持对话上下文，仅「新对话」创建新 session |

### 4.4 数据流

```
发送消息: React → Tauri IPC → Rust HTTP Proxy → Bun HTTP → Claude Agent SDK → AI API
流式回复: AI API → SDK Stream → Bun SSE Broadcast → Rust SSE Proxy → Tauri Emit → React Listen
```

### 4.5 数据存储

| 数据类型 | 存储位置 | 格式 |
|----------|----------|------|
| 会话索引 | `~/.soagents/sessions.json` | JSON |
| 会话消息 | `~/.soagents/sessions/{id}.jsonl` | JSONL (O(1) 追加) |
| 供应商配置 | `~/.soagents/providers/` | JSON |
| MCP 配置 | `~/.soagents/mcp/` | JSON |
| Skills | `~/.soagents/skills/` | Markdown (SKILL.md) |
| 日志 | `~/.soagents/logs/` | 文本 |

---

## 5. 功能规划

### 5.1 功能架构

```
┌─────────────────────────────────────────────────────────────┐
│                     SoAgents 功能架构                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   智能对话    │  │  多项目管理   │  │   工具扩展    │       │
│  │  • 流式输出   │  │  • 多 Tab     │  │  • MCP 集成   │       │
│  │  • 上下文保持 │  │  • 工作区切换  │  │  • Skills    │       │
│  │  • 权限控制   │  │  • 历史记录   │  │  • Commands  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   模型管理    │  │  文件管理     │  │   系统能力    │       │
│  │  • 多供应商   │  │  • 拖拽上传   │  │  • 自动更新   │       │
│  │  • 自定义模型 │  │  • 工作区浏览  │  │  • 本地存储   │       │
│  │  • API/订阅   │  │  • 文件预览   │  │  • 快捷键     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 核心功能清单

#### P0 - 必须实现

| 模块 | 功能 | 描述 |
|------|------|------|
| 智能对话 | 流式输出 | AI 回复实时逐字显示，支持中断 |
| 智能对话 | Markdown 渲染 | 标题、列表、表格、代码块、数学公式 |
| 智能对话 | Thinking Block | 显示 AI 推理过程（可折叠） |
| 智能对话 | 工具调用展示 | 可视化显示工具使用和结果 |
| 智能对话 | 权限控制 | 行动/规划/自主三种模式 |
| 多 Tab | 创建/切换/关闭 | 完整的 Tab 生命周期管理 |
| 多 Tab | 拖拽排序 | Tab 拖拽调整顺序 |
| 多 Tab | 并行执行 | 多 Tab 任务互不阻塞 |
| 多供应商 | Anthropic 订阅/API | 官方渠道支持 |
| 多供应商 | 第三方供应商 | DeepSeek、Moonshot、智谱等 |
| 多供应商 | 热切换 | 对话中切换模型，上下文保持 |
| MCP | 服务器配置 | 可视化添加/编辑/删除 |
| MCP | 三种协议 | STDIO / HTTP / SSE |

#### P1 - 重要功能

| 模块 | 功能 | 描述 |
|------|------|------|
| Skills | 内置/自定义技能 | Slash Commands 触发 |
| Skills | 技能同步 | 从 Claude Code 同步 |
| 工作区 | 文件树浏览 | 项目目录结构查看 |
| 工作区 | 拖拽/粘贴文件 | 文件上传到工作区 |
| 工作区 | @路径引用 | 右键菜单插入引用 |
| 历史记录 | Session 持久化 | JSONL 格式存储 |
| 历史记录 | Token 统计 | 按模型分组统计消耗 |
| 设置 | 自定义供应商 | 添加 OpenAI 兼容接口 |

#### P2 - 增强功能

| 模块 | 功能 | 描述 |
|------|------|------|
| 系统 | 自动更新 | Chrome 风格静默更新 |
| 系统 | 统一日志 | React/Bun/Rust 日志汇聚 |
| 系统 | 快捷键支持 | 完整键盘操作 |
| 文件 | 文件编辑器 | Markdown + 代码编辑 |

---

## 6. 开发计划与里程碑

### 6.1 总体时间线

```
Phase 1 ──── Phase 2 ──── Phase 3 ──── Phase 4 ──── Phase 5
基础搭建      UI 框架      进程管理      通信层       流式传输
  ✅            ✅           ✅           ✅           ✅

Phase 6 ──── Phase 7 ──── Phase 8 ──── Phase 9 ──── Phase 10
核心对话      完整体验     持久化       多供应商      生态集成
  ✅            ✅           ✅           ✅           ✅
                                                       │
                                                  v0.0.6 当前
```

### 6.2 各阶段详细计划

#### Phase 1: 基础搭建 ✅ 已完成

**交付物**：
- [x] Tauri v2 + React 19 + Vite + TailwindCSS 项目脚手架
- [x] Rust 后端基础配置（logging、DevTools）
- [x] 设计系统 CSS 变量（温暖纸张质感）
- [x] TypeScript 严格模式配置
- [x] Git 初始化

#### Phase 2: 自定义标题栏 + 多 Tab 系统 ✅ 已完成

**交付物**：
- [x] macOS 自定义标题栏（交通灯留白 + 拖拽区域）
- [x] 多 Tab 创建/切换/关闭
- [x] Tab 拖拽排序 (@dnd-kit)
- [x] Tab 重命名
- [x] 快捷键：Cmd+T 新建、Cmd+W 关闭

#### Phase 3: Bun Sidecar 进程管理 ✅ 已完成

**交付物**：
- [x] `sidecar.rs` — Rust 进程管理器 (Arc<Mutex<HashMap>>)
- [x] 端口分配：31415 起递增
- [x] 健康检查：60 × 100ms 轮询
- [x] 进程生命周期：SIGTERM → 5s → SIGKILL
- [x] `commands.rs` — IPC 命令注册

#### Phase 4: HTTP 代理层 ✅ 已完成

**交付物**：
- [x] `proxy.rs` — reqwest HTTP 代理（绕过 CORS）
- [x] `tauriClient.ts` — Tauri IPC 封装
- [x] `apiFetch.ts` — HTTP 代理封装
- [x] `.no_proxy()` + `.tcp_nodelay(true)` 优化

#### Phase 5: SSE 代理 + 流式事件 ✅ 已完成

**交付物**：
- [x] `sse.ts` — Bun SSE 服务（心跳 15s）
- [x] `sse_proxy.rs` — Rust SSE 代理（事件路由）
- [x] `SseConnection.ts` — 前端 SSE 接收
- [x] 事件格式：`sse:{tabId}:{eventName}`

#### Phase 6: Claude Agent SDK 集成 ✅ 已完成

**交付物**：
- [x] `agent-session.ts` — SDK 集成核心
- [x] 流式事件映射（SDK → SSE → React）
- [x] `TabContext.tsx` + `TabProvider.tsx` — Tab 状态管理
- [x] `Chat.tsx` — 对话页面
- [x] `MessageList.tsx` + `Message.tsx` — 消息渲染

#### Phase 7: 完整对话体验 ✅ 已完成

**交付物**：
- [x] 工具展示组件（Bash/Read/Write/Edit/Glob/Grep）
- [x] `PermissionPrompt.tsx` — 权限弹窗
- [x] `AskUserQuestionPrompt.tsx` — AI 提问交互
- [x] `SlashCommandMenu.tsx` — 命令菜单
- [x] Thinking Block 展示

#### Phase 8: Session 管理 + 历史记录 ✅ 已完成

**交付物**：
- [x] `SessionStore.ts` — JSONL 持久化
- [x] 9 种会话结束场景的状态重置
- [x] `SessionHistoryDropdown.tsx` — 历史面板
- [x] Token 统计（按模型分组）
- [x] 会话切换与恢复

#### Phase 9: 多 Provider 支持 ✅ 已完成

**交付物**：
- [x] `Settings.tsx` — 设置页面
- [x] Anthropic 订阅模式 + API Key 模式
- [x] 预设供应商（DeepSeek、Moonshot、智谱、MiniMax、火山引擎、OpenRouter）
- [x] 自定义供应商 CRUD
- [x] Provider 切换上下文保持（resume session）

#### Phase 10: MCP + Skills + 工作区 ✅ 已完成

**交付物**：
- [x] MCP 服务器配置管理（STDIO/HTTP/SSE）
- [x] Skills 系统（内置 + 自定义 + 同步）
- [x] `WorkspaceFilesPanel.tsx` — 文件树
- [x] 文件拖拽/粘贴上传
- [x] `Editor.tsx` — Markdown/代码编辑器
- [x] `Launcher.tsx` — 启动页

### 6.3 版本发布记录

| 版本 | 日期 | 核心里程碑 |
|------|------|------------|
| v0.0.1 | — | Phase 1 完成，基础脚手架 |
| v0.0.5 | — | Phase 2-8 完成，核心对话体验 |
| **v0.0.6** | **2026-02-18** | **Phase 9-10 完成，当前最新版本** |
| v0.1.0 | 2026-01-24 (参考) | SoAgents 首个公开版本 |
| v0.1.4 | 2026-01-29 (参考) | SoAgents 最新稳定版本 |

---

## 7. 项目现状

### 7.1 已完成功能 (v0.0.6)

| 模块 | 状态 | 说明 |
|------|------|------|
| 核心架构 | ✅ 完成 | Tauri + React + Bun + Rust Proxy |
| 多 Tab 系统 | ✅ 完成 | 独立 Sidecar、拖拽排序、持久化 |
| 流式对话 | ✅ 完成 | 流式输出、Thinking Block、Tool Use |
| Session 管理 | ✅ 完成 | JSONL 持久化、历史恢复 |
| 多供应商 | ✅ 完成 | 7+ 供应商、自定义供应商 |
| MCP 集成 | ✅ 完成 | 三种协议、权限管理 |
| Skills | ✅ 完成 | 内置 + 自定义 + 同步 |
| 工作区 | ✅ 完成 | 文件树、编辑器、拖拽上传 |
| 设置页 | ✅ 完成 | Provider/MCP/Skills 配置 |

### 7.2 项目数据

| 指标 | 数值 |
|------|------|
| 代码语言 | TypeScript + Rust + CSS |
| 前端组件数 | 30+ React 组件 |
| Rust 模块数 | 5 核心模块 |
| Bun 后端模块数 | 6 核心模块 |
| 设计/技术文档 | 16+ 篇 |
| Git 版本标签 | v0.0.1 ~ v0.0.6 |

### 7.3 关键技术成果

1. **多进程 Sidecar 架构**：每个 Tab 独立进程，真正的并行执行，崩溃隔离
2. **三层代理通信**：React → Rust reqwest → Bun，完美解决 WebView CORS 限制
3. **SSE 事件隔离**：`sse:{tabId}:{eventName}` 格式，精准路由到目标 Tab
4. **9 种会话结束场景处理**：全面覆盖正常/异常/用户操作结束场景的状态重置
5. **Clash 代理兼容**：`.no_proxy()` 配置解决本地回环被系统代理拦截问题

---

## 8. 后续迭代规划

### 8.1 近期规划 (v0.1.x → v0.2.x)

| 功能 | 优先级 | 预计版本 | 说明 |
|------|--------|----------|------|
| 供应商编辑增强 | P0 | v0.1.x | 编辑名称、URL、模型列表 |
| 预设供应商自定义模型 | P0 | v0.1.x | 预设供应商也可添加自定义模型 |
| 历史记录优化 | P1 | v0.1.x | 统计详情弹窗、消息/Token 展示 |
| 自动更新系统 | P1 | v0.1.x | Tauri Updater + R2 CDN |
| 统一日志系统 | P1 | v0.1.x | React/Bun/Rust 日志汇聚 |
| Windows 支持 | P0 | v0.2.0 | 跨平台构建 |
| 图片/文件上传对话 | P0 | v0.2.0 | 多模态输入 |
| 语音输入 | P1 | v0.2.1 | 语音转文字 |
| 对话导出 | P1 | v0.2.1 | Markdown/PDF 格式导出 |
| 主题定制 | P2 | v0.2.2 | 深色/浅色模式 |
| 插件市场 | P2 | v0.2.3 | MCP/Skills 社区分享 |

### 8.2 中期规划 (v0.3.x)

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 多语言界面 (i18n) | P1 | 中英文等多语言支持 |
| 知识库集成 (RAG) | P1 | 本地文档检索增强 |
| 工作流自动化 | P2 | 定义和执行自动化工作流 |
| 本地模型支持 | P2 | Ollama 等本地推理引擎 |

### 8.3 长期愿景 (v1.0+)

| 方向 | 描述 |
|------|------|
| **企业版** | 团队协作、权限管理、审计日志 |
| **移动端** | iOS/Android 客户端 |
| **云同步** | 可选的跨设备同步（端到端加密） |
| **Agent 市场** | 社区共享和发现 Agent 配置 |

---

## 9. 风险评估与应对

### 9.1 技术风险

| 风险 | 可能性 | 影响程度 | 应对措施 |
|------|--------|----------|----------|
| Claude SDK 重大变更 | 中 | 高 | 抽象适配层，持续跟进官方更新 |
| Tauri v2 稳定性问题 | 低 | 中 | 紧跟社区版本，及时升级 |
| 多进程内存压力 | 中 | 中 | 进程池管理，限制最大 Tab 数 |
| MCP 协议变更 | 低 | 中 | 模块化 MCP 层，易于适配 |
| Bun 运行时兼容性 | 低 | 高 | 版本锁定，回归测试 |

### 9.2 产品风险

| 风险 | 可能性 | 影响程度 | 应对措施 |
|------|--------|----------|----------|
| 功能范围蔓延 | 高 | 中 | 严格按 Phase 开发，MVP 优先 |
| 用户需求变化快 | 中 | 中 | 模块化架构，快速迭代 |
| 跨平台兼容问题 | 中 | 高 | macOS 先行，Windows 后续跟进 |

### 9.3 已解决的技术难题

以下是开发过程中遇到并已解决的关键技术问题，作为经验参考：

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Clash 代理拦截 localhost | 系统代理拦截本地回环请求 | reqwest Client 配置 `.no_proxy()` |
| Bun SSE 连接超时断开 | 默认 idle timeout | 设置 `idleTimeout: 0` |
| SDK 子进程被阻塞 | CLAUDECODE 环境变量干扰 | `delete process.env.CLAUDECODE` |
| Thinking Block 不显示 | SDK 配置遗漏 | 开启 `includePartialMessages: true` |
| 三方→Anthropic 签名冲突 | Thinking Block 签名不兼容 | 检测供应商切换时新建 session |
| React Context 无限重渲染 | Provider value 不稳定 | 强制 `useMemo` 包裹所有 Provider value |

---

## 10. 资源需求

### 10.1 开发环境

| 资源 | 要求 |
|------|------|
| 操作系统 | macOS 13.0+ (主开发环境) |
| Rust | 最新 stable 版本 |
| Bun | 1.3.6+ |
| Node.js | 用于部分构建工具 |
| IDE | VSCode / Cursor + Rust Analyzer |
| AI 辅助 | Claude Code / Claude Desktop |

### 10.2 外部服务

| 服务 | 用途 | 费用 |
|------|------|------|
| Anthropic API | AI 模型调用 | 按量付费 |
| Apple Developer | macOS 签名 + 公证 | $99/年 |
| Cloudflare R2 | 自动更新 CDN | 免费额度 |
| GitHub | 代码托管 | 免费 |

### 10.3 构建命令参考

```bash
bun install                    # 安装依赖
npm run tauri:dev              # Tauri 开发模式（完整桌面体验）
npm run dev:web                # 纯前端 Vite 开发
npm run typecheck              # TypeScript 类型检查
bun run server                 # 单独启动 Bun 后端
npm run tauri:build            # 生产构建
```

---

## 11. 质量保障

### 11.1 编码规范

| 规范 | 说明 |
|------|------|
| TypeScript 严格模式 | `strict: true`，100% 类型覆盖 |
| React 稳定性规则 | Context Provider value 必须 useMemo；useEffect 依赖数组禁止不稳定引用 |
| 组件命名 | PascalCase 组件名，camelCase 变量/函数名 |
| CSS 规范 | TailwindCSS 原子类优先，CSS 变量定义设计令牌 |
| Rust 规范 | rustfmt + clippy 格式化和静态分析 |

### 11.2 性能指标

| 指标 | 目标值 |
|------|--------|
| 应用启动时间 | < 3 秒 |
| Tab 新建响应 | < 1 秒 |
| 消息首字延迟 | < 500ms |
| 内存占用（单 Tab） | < 200MB |
| 并发 Tab 数 | ≥ 10 |

### 11.3 安全要求

| 要求 | 实现方式 |
|------|----------|
| 数据本地化 | 所有数据存储在 `~/.soagents/` |
| 无遥测 | 不收集任何用户数据 |
| API Key 安全 | 本地存储，不传输到第三方 |
| 进程隔离 | Tauri 安全沙箱 + Sidecar 进程隔离 |
| 进程清理 | 应用退出时自动清理所有子进程（SIGTERM → SIGKILL） |

---

## 12. 附录

### 12.1 项目目录结构

```
soagents/
├── CLAUDE.md                    # 项目规范（React 稳定性规则、命名约定）
├── BOOTSTRAP.md                 # 构建指南（Phase 1-10 详细步骤）
├── PROCESS.md                   # 开发过程记录与问题排查
├── CHANGELOG.md                 # 版本变更日志
├── package.json                 # 前端依赖配置
├── vite.config.ts               # Vite 构建配置
├── tsconfig.json                # TypeScript 配置
├── src/
│   ├── renderer/                # React 前端
│   │   ├── App.tsx             # 主应用（多 Tab 管理）
│   │   ├── pages/              # 页面组件（Chat/Settings/Launcher/Editor）
│   │   ├── components/         # UI 组件
│   │   │   └── tools/          # 工具展示组件
│   │   ├── context/            # React Context（Tab/Config）
│   │   ├── api/                # 通信层（IPC/HTTP/SSE）
│   │   ├── hooks/              # 自定义 Hooks
│   │   ├── types/              # TypeScript 类型定义
│   │   └── utils/              # 工具函数
│   ├── server/                  # Bun 后端
│   │   ├── index.ts            # HTTP 服务器入口
│   │   ├── agent-session.ts    # SDK 集成核心
│   │   ├── sse.ts              # SSE 事件广播
│   │   ├── SessionStore.ts     # JSONL 会话存储
│   │   ├── ConfigStore.ts      # 配置管理
│   │   ├── MCPConfigStore.ts   # MCP 配置
│   │   └── SkillsStore.ts      # Skills 管理
│   └── shared/                  # 前后端共享代码
├── src-tauri/                   # Tauri Rust 后端
│   ├── src/
│   │   ├── lib.rs              # Tauri 应用入口
│   │   ├── commands.rs         # IPC 命令
│   │   ├── sidecar.rs          # 进程管理器
│   │   ├── proxy.rs            # HTTP 代理
│   │   └── sse_proxy.rs        # SSE 代理
│   ├── tauri.conf.json         # Tauri 配置
│   └── Cargo.toml              # Rust 依赖
└── specs/                       # 设计与技术文档
    ├── prd/                     # 产品需求文档
    ├── tech_docs/               # 技术架构文档
    ├── guides/                  # 构建/发布/设计指南
    ├── research/                # 技术调研文档
    └── version.md               # 版本历史
```

### 12.2 设计系统

**温暖纸张质感** — 核心设计语言

```css
--paper: #f6efe5;              /* 主背景色 - 温暖米色 */
--paper-light: #faf6f0;        /* 浅背景 */
--paper-dark: #ede4d8;         /* 深背景 */
--ink: #1c1612;                /* 主文字 - 深棕 */
--ink-secondary: #5c534a;      /* 次要文字 */
--ink-tertiary: #8a7f73;       /* 辅助文字 */
--accent-warm: #c26d3a;        /* 暖色强调 - 焦橙 */
--accent-cool: #2e6f5e;        /* 冷色强调 - 森林绿 */
--border: #d4c8b8;             /* 边框色 */
--success: #2e6f5e;            /* 成功 */
--error: #c25a3a;              /* 错误 */
--warning: #c29a3a;            /* 警告 */
```

### 12.3 关键文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 项目规范 | `CLAUDE.md` | React 稳定性规则、命名约定 |
| 构建指南 | `BOOTSTRAP.md` | Phase 1-10 详细步骤 |
| 过程记录 | `PROCESS.md` | 问题排查与解决方案 |
| 产品需求 | `specs/prd/PRD_SoAgents_v1.0.md` | 完整产品需求文档 |
| 技术架构 | `specs/tech_docs/architecture.md` | 多实例 Sidecar 架构 |
| 设计指南 | `specs/guides/design_guide.md` | UI/UX 设计规范 |
| 版本历史 | `specs/version.md` | 版本发布记录 |
| 构建发布 | `specs/guides/build_and_release_guide.md` | 构建和发布流程 |

### 12.4 竞品对比

| 维度 | SoAgents | Claude Code CLI | Cursor | ChatGPT Desktop |
|------|----------|-----------------|--------|-----------------|
| 产品形态 | 桌面 GUI | 命令行 | IDE 插件 | 桌面 GUI |
| 使用门槛 | 零门槛 | 需 CLI 经验 | 低 | 零门槛 |
| Agent 能力 | ✅ 完整 | ✅ 完整 | ✅ 完整 | ❌ 无 |
| 多任务并行 | ✅ 真并行 | ❌ 单会话 | ❌ 单会话 | ❌ 单会话 |
| 多模型支持 | ✅ 7+ 供应商 | ❌ 仅 Anthropic | ✅ 多模型 | ❌ 仅 OpenAI |
| MCP 支持 | ✅ 完整 | ✅ 完整 | ⚠️ 部分 | ❌ 无 |
| 数据隐私 | ✅ 本地 | ✅ 本地 | ⚠️ 云端 | ⚠️ 云端 |

---

*文档结束*

*编写工具: Claude Code | 日期: 2026-02-19*
