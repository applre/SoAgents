# Changelog

所有版本的变更记录，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

> 下一个版本 v0.1.0 功能规划中…

---

## [0.0.6] - 2026-02-18

### 新增
- **多工作区 Tab 持久化**：切换工作区时 Chat 组件持续挂载（`display:none` 切换），Sidecar 进程保持连接不重启
- **WorkspaceTabBar 工作区跳转**：下拉菜单中选择已打开的工作区直接跳转，否则新建 Tab
- `sessionsFetched` 标志位：首次 fetch 完成前不清空已缓存的 sessions，防止切换工作区时列表闪空

### 修复
- 切换工作区后最近对话列表不实时刷新（根本原因：Chat 每次 unmount→remount 导致 Sidecar 重启）
- 每次对话完成（`chat:message-complete`）后自动刷新 sessions，新对话实时出现在列表中
- `handleSessionsChange` 改为接受 `tabId` 参数，消除 `activeTabId` 闭包依赖，解决 sessions 写入错误 Tab 的问题
- 点击「新建对话」后 Logo 上移的视觉抖动（侧边栏容器加 `overflow:hidden`，固定区块加 `shrink-0`）

---

## [0.0.5] - 2026-02-18

### 新增
- **Phase 2 · 窗口系统**：自定义标题栏（macOS traffic lights 适配）、多 Tab 框架
- **Phase 3 · Sidecar 进程管理**：每个 Tab 独立 Bun Sidecar 进程，隔离运行环境
- **Phase 4 · Rust 代理层**：所有 HTTP/SSE 流量经由 Rust `reqwest` 代理，支持 Tauri 沙箱限制
- **Phase 5 · 前端基础架构**：`TabContext` / `TabProvider` 状态管理，`ConfigContext` 全局配置
- **Phase 6 · 工作区选择（Launcher）**：原生文件夹对话框、最近工作区记录（localStorage）
- **Phase 7 · 聊天 UI**：流式文字输出、Thinking 块、Tool Use 展示、权限弹框、AskUserQuestion 弹框、Slash Commands 菜单
- **Phase 8 · Session 管理**：JSONL 持久化、历史记录列表、加载 / 删除对话
- **Phase 9 · 多 Provider 支持**：DeepSeek / Moonshot / 智谱 / MiniMax 第三方接入，设置页面 API Key 管理

---

## [0.0.1] - 2026-02-17

### 新增
- **项目脚手架**：Tauri v2 + React 19 + Vite + TailwindCSS v4，暖纸质感设计系统
- Tauri Rust 后端（日志 + DevTools）、Bun 运行时集成
- 设计规范、PRD、技术文档（specs/）

---

[Unreleased]: https://github.com/wangjida/soagents/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/wangjida/soagents/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/wangjida/soagents/compare/v0.0.1...v0.0.5
[0.0.1]: https://github.com/wangjida/soagents/releases/tag/v0.0.1
