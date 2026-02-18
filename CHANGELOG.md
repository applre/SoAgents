# Changelog

所有版本的变更记录，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

> 下一个版本 v0.1.0 功能规划中…

---

## [0.0.8] - 2026-02-19

### 新增
- **设置 Tab**：点击侧边栏「设置」时，在 TopTabBar 新增设置 tab 页，无 `>` 按钮，有 `×` 关闭按钮
- **设置 Tab 激活时**：隐藏 TopTabBar 右侧「展开工作区文件面板」图标
- **设置 Tab 激活时**：侧边栏隐藏最近对话区域，保持界面干净

---

## [0.0.7] - 2026-02-19

### 新增
- **WorkspaceFilesPanel 文件树**：支持文件夹点击展开/折叠，递归渲染子目录，缓存已展开目录内容
- **Editor 多语言代码高亮**：支持 JS/TS/Python/Rust/CSS/HTML/JSON，非 Markdown 文件强制进入 edit 模式
- **MCP/Skills 集成**：工作区文件面板与 MCP、Skills 入口整合
- **Markdown 预览**：新增 typography 插件，附件卡片通过 `/api/file-stat` 获取文件大小

### 修复
- 工具栏图标更新为 Lucide 风格（PanelRightOpen / PanelRightClose / ExternalLink / RefreshCw）
- 用户消息文字被 prose 样式覆盖为黑色的问题；AI 气泡改为暖灰底色
- `handleSelectWorkspace`：打开已存在工作区时未跳转到已有 Tab 的问题

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
