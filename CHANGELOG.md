# Changelog

所有版本的变更记录，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

---

## [0.0.9] - 2026-02-20

### 新增
- **Token 统计展示**：历史记录列表中鼠标悬停 Session 显示 tooltip，包含消息数、输入/输出 tokens、总计（支持 K/M 单位格式化）
- **Session 重命名**：历史记录 `···` 菜单新增重命名功能，支持 Enter 保存、Esc 取消、失焦保存，标题变更持久化到 `sessions.json`
- **Session 删除**：历史记录 `···` 菜单新增删除功能，带确认对话框防误删，删除当前 Session 时自动切换到新 Session
- **供应商 CRUD 完整实现**：
  - **添加**：Settings → Provider Tab 新增"添加自定义供应商"按钮，支持配置名称、Base URL、主模型、API Key，带表单验证（必填项、URL 格式）
  - **编辑**：ProviderCard Settings 图标可点击打开编辑模态框，预设供应商只读，自定义供应商可编辑名称/URL/模型
  - **删除**：编辑模态框底部显示删除按钮（仅自定义供应商），带确认对话框，删除当前供应商时自动切换到 Anthropic，同时清理对应 API Key
- **文件拖拽/粘贴**：
  - 拖拽文件到输入框显示蓝色边框提示
  - 图片文件（png/jpg/gif/webp/svg）显示 base64 预览卡片
  - 普通文件显示 `@filename (size)` 标签
  - 支持 Cmd+V 粘贴图片
  - 发送时图片转 base64，普通文件读取内容拼接到消息

### 技术改进
- **前后端类型同步**：`src/renderer/types/config.ts` 和 `src/server/types/config.ts` 添加 `Provider.isBuiltin` 和 `AppConfig.customProviders` 字段
- **ConfigStore CRUD 方法**：新增 `addCustomProvider`、`updateCustomProvider`、`deleteCustomProvider`、`getAllProviders`（返回预设 + 自定义）
- **SessionStore 增强**：新增 `updateTitle(sessionId, title)` 方法，支持 Session 标题更新
- **API 路由扩展**：
  - `GET /api/providers` - 获取所有供应商
  - `POST /api/providers` - 创建自定义供应商
  - `PUT /api/providers/:id` - 更新供应商
  - `DELETE /api/providers/:id` - 删除供应商
  - `PUT /chat/sessions/:id/title` - 更新 Session 标题
- **工具函数**：新增 `formatTokens.ts`（Token 数字格式化）和 `formatSize.ts`（文件大小格式化）
- **ConfigProvider 增强**：添加 `refreshConfig()` 方法，支持从后端 API 动态加载供应商列表

### 修复
- **权限模式下拉框**：修复选择权限模式后无法重新打开的问题（mousedown 事件监听从 `modeBtnRef` 改为 `modeContainerRef`）
- **Provider 配置**：添加 `ANTHROPIC_MODEL` 环境变量支持第三方 Provider 模型 ID；修复 resume 策略（仅第三方→官方时清空 session）；移除 `anthropic-api` 的 `baseUrl` 字段；更新预设模型（Moonshot: kimi-k2-5、智谱: glm-4-plus、MiniMax: MiniMax-Text-01）
- **Allow 按钮颜色**：添加 `--accent-warm: #C4956A` CSS 变量，修复 PermissionPrompt 允许按钮背景透明问题
- **SearchModal 遮罩层级**：z-index 从 `z-50` 提升至 `z-[60]`，确保覆盖 TabBar
- **消息列表滚动**：MessageList 添加 `overflow-x-hidden`，移除横向滚动条
- **图标更新**：Skill 按钮图标改为 Puzzle，MCP 按钮图标改为 Wrench
- **代码质量优化**：
  - `TabProvider.tsx`：sendMessage 添加 try/catch 防止 API 失败导致 loading 状态卡死
  - `SearchModal.tsx`：添加 AbortController 防止搜索竞态条件
  - `Editor.tsx`：使用 `convertFileSrc` 替代 `file://` 协议
  - `server/index.ts`：permissionMode 添加运行时白名单校验

### 已知问题
以下功能在 PRD 中标记为「已实现」，但实际代码中**未完成**（待后续版本实现）：

**P0（核心缺失）**：
- 预设供应商自定义模型

**P1（体验缺失）**：
- @路径引用（右键菜单）
- 文件冲突自动重命名
- 文件操作撤销（Cmd+Z）
- 统计详情弹窗（按模型分组）

**P2（增强功能）**：
- 自动更新系统（Tauri Updater）
- 统一日志查看界面
- 日志 30 天自动清理
- /clear 和 /reset 命令实际执行逻辑

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

[Unreleased]: https://github.com/wangjida/soagents/compare/v0.0.9...HEAD
[0.0.9]: https://github.com/wangjida/soagents/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/wangjida/soagents/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/wangjida/soagents/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/wangjida/soagents/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/wangjida/soagents/compare/v0.0.1...v0.0.5
[0.0.1]: https://github.com/wangjida/soagents/releases/tag/v0.0.1
