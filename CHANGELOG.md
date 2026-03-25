# Changelog

所有版本的变更记录，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

---

## [0.1.8] - 2026-03-25

### 新增

#### MCP 功能增强（Phase 1-4）
- **Bug 修复（Phase 1）**：修复切换服务器时表单不同步、编辑覆盖 enabled 状态、错误信息不显示等问题
- **质量改进（Phase 2）**：版本锁定、Playwright 结果精简、stdio 预热优化、JSON 编辑模式、KeyValue 编辑器、扩展状态徽章
- **架构增强（Phase 3）**：提取 `buildSdkMcpServers()`、`resolveStdioCommand()` 运行时回退、Session 预热、前端 `mcpService` 层、Playwright 配置面板、模态框毛玻璃背景
- **新能力（Phase 4）**：内置 MCP 注册表、Gemini Image 内置 MCP、Edge TTS 内置 MCP、OAuth 2.0 PKCE 认证流程、OAuth Token 自动注入
- **JSON 导入兼容**：MCPEditModal JSON 模式支持 Claude Desktop 格式自动解包

#### 工作区配置系统
- **Agent 配置面板**：通用设置、系统提示词（CLAUDE.md + Rules）、技能/命令/Agent 管理
- **后端 API**：CLAUDE.md 读写、Rules CRUD、CommandStore 斜杠命令管理、AgentStore 工作区 Agent 管理
- **斜杠命令菜单增强**：集成自定义命令和技能

#### 图片处理与附件
- **图片缩放**：jimp + WebP 支持，超过 1568px 自动缩放，超长图自动切片
- **消息附件**：支持图片附件存储和历史记录渲染

#### UI 改进
- **SessionTabBar 重设计**：Chrome 风格标签页（圆角顶部、分隔线、hover 关闭按钮）
- **设计系统更新**：强调色更新为 `#c26d3a`，Markdown 渲染组件提取
- **系统托盘**：最小化到托盘功能
- **流式状态计时器**：显示生成耗时，session 淡入动画

#### 任务中心
- **定时任务过滤**：按实际运行记录过滤定时任务创建的 session

#### Sidecar 进程管理重构
- **非阻塞进程回收**：SIGTERM + 后台 waitpid 轮询，超时 SIGKILL
- **alive_check 健康检测**：TCP 健康检查期间检测进程崩溃，快速失败

#### Background Completion（后台完成）
- 关闭 Tab 时 AI 继续在后台运行直到完成
- 安全机制：60 分钟最大时长、连续 3 次 HTTP 失败自动终止

### 修复
- 修复 WorkspaceConfigPanel 返回按钮无响应
- 修复 SessionTabBar 标题栏拖拽失效
- 修复侧边栏重命名 session 延迟（乐观更新）

---

## [0.1.7] - 2026-03-20

### 新增

#### 权限系统重构
- **三档权限决策**：权限弹窗从布尔值改为 deny / allow_once / always_allow 三档
- **按模式自动放行**：acceptEdits 模式自动放行读写工具，plan 模式仅允许只读，bypassPermissions 全部放行
- **Session 级始终允许**：选择「始终允许」后同名工具自动放行，级联处理 pending 请求
- **MCP 工具权限检查**：未启用的 MCP server 工具直接拒绝

#### Plan 模式
- **EnterPlanMode / ExitPlanMode**：工具拦截与用户审批流程
- **PlanModePrompt 组件**：方案预览 + 批准/拒绝 UI
- **权限联动**：进入 Plan 模式时切换为只读权限，退出后恢复原权限

#### SDK 集成优化
- **Preset System Prompt**：使用 claude_code preset + SoAgents 身份追加
- **PostToolUse Hook**：自动缩放工具返回的图片内容
- **Bundled SDK 路径优先**：CLI 解析优先检查 bundled path，避免 bun auto-install 阻塞
- **ESM 兼容修复**：import.meta.url / createRequire 替代 __dirname / require

#### UI 改进
- **FileSearchMenu 重写**：从双面板改为单面板内联展开模式
- **UsageStatsPanel 厂商筛选**：按 vendor 过滤模型用量分布
- **Toast 通知组件**：全局轻量提示
- **运行指示灯统一**：CSS 变量 --running / --running-light
- **WorkspaceSelector 滚动**：工作区列表支持滚动，限高 320px

#### Rust 层
- **scheduler → cron_task**：模块、状态、命令全部重命名
- **TCP 健康检查**：Sidecar 从 HTTP 改为 TCP 级别检查，启动更快更可靠
- **进程退出检测**：启动后立即检测进程是否异常退出
- **claude-agent-sdk 打包**：作为 Tauri resource 分发

#### 工程化
- **ESLint 配置**：新增 eslint.config.js + react/react-hooks/typescript-eslint 插件
- **Provider Model Aliases API**：`PUT /api/provider-model-aliases` 接口
- **post-build-server 脚本**：构建后处理流程

### 改进
- **React 稳定性**：useEffect 改为状态同步模式，依赖数组修正，消除不必要的重渲染
- **类型安全**：verify-providers 脚本消除 any 类型，WorkspaceFilesPanel children prop 重命名为 childEntries
- **SkillsStore**：bundled-skills 路径查找兼容 ESM

#### 会话标题自动生成
- **AI 自动命名**：对话 3 轮后自动调用 LLM 生成简洁会话标题，侧栏实时更新

#### 消息渲染增强
- **虚拟滚动**：长对话消息列表改用虚拟滚动，大幅降低内存占用
- **Mermaid / LaTeX / Markdown 预处理**：代码块识别与渲染优化
- **思考过程与工具调用可视化**：折叠展示 AI 思考内容和工具执行详情

#### 排队消息优化
- **乐观 UI**：排队消息即时展示，无需等待后端确认
- **图片预览**：排队消息支持图片缩略图预览
- **面板重设计**：排队消息面板 UI 全面优化

#### Sidecar 健壮性增强
- **Global Sidecar 健康监控**：自动检测 Global Sidecar 异常并重启
- **启动流程重构**：Ready Promise 机制，前端 API 调用等待 Sidecar 就绪后才执行
- **跨实例误杀修复**：修复多实例场景下错误终止其他实例 Sidecar 的问题

#### MCP 全局管理
- **全局 MCP 配置**：MCP 服务器配置合并到 AppConfig，自动迁移旧格式
- **状态显示与预热**：MCP 服务器运行状态实时显示，stdio 类型自动预热
- **指纹变更检测**：配置变更后自动重载 MCP 服务器
- **JSON 导入导出**：支持 MCP 配置批量导入导出

#### 归档系统
- **归档替代删除**：会话支持归档/取消归档，侧栏和任务中心按归档状态筛选
- **侧栏优化**：工作区分组标题增加新建对话按钮，筛选和归档样式优化

### 修复
- **Release 构建对话卡死**：macOS GUI 应用 PATH 不含 bun，SDK 子进程 `spawn("bun")` 静默失败导致对话永远停在「思考中」。Rust 层通过 `BUN_EXECUTABLE` 环境变量传递内置 bun 完整路径
- **构建安全检测**：`post-build-server.sh` 新增 `BUN_EXECUTABLE` 引用检测，缺失则构建失败
- **用户主动停止与异常中断区分**：新增 `chat:message-stopped` 事件，前端正确识别用户主动中止
- **resetSession 状态清理**：重置 session 时正确清理 auto-title 和 streaming 相关状态
- **systemPrompt 格式回退**：恢复为字符串格式，移除 PostToolUse hook
- **allowedTools 恢复**：bypassPermissions 模式下不传 canUseTool

---

## [0.1.5] - 2026-03-15

### 新增

#### Config 基建加固 (PRD 0.1.4)
- **原子写入**：ConfigStore/SessionStore/SkillsStore 所有写入改用 .tmp → .bak → rename，崩溃自动从 .bak 恢复
- **Config 磁盘优先**：所有配置写入走 atomicModifyConfig（读磁盘最新 → 合并 → 原子写盘）
- **local_http 模块**：集中化 `.no_proxy()` 到 `crate::local_http`，消除 localhost 代理陷阱
- **Rust PATCH 方法**：proxy_http_request 补全 PATCH 支持

#### OpenAI Bridge + 消息队列 (PRD 0.1.5)
- **OpenAI Bridge**：SDK loopback 协议翻译，DeepSeek/Gemini 等 OpenAI 兼容供应商可正常对话
- **消息队列**：AI 回复中可继续发消息（排队 + 取消 + 强制执行），QueuedMessagesPanel UI
- **MCP 预设扩展**：新增 Playwright/DuckDuckGo/Tavily 3 个预设 MCP 服务器
- **Per-server 环境变量**：MCP 服务器独立 env 配置，持久化到 mcp-env.json
- **URL 模板变量**：HTTP/SSE 类型 MCP 支持 `{{VAR}}` 模板语法
- **Tool 渲染优化**：工具类型彩色图标 + BashOutputTool/KillShellTool/AgentTool 专用组件
- **文件搜索重构**：ChatInput 搜索逻辑抽取到 FileSearchMenu 组件

#### Provider & MCP 追平 (PRD 0.1.6)
- **3 个新预设供应商**：Google Gemini / 火山方舟 API / 阿里云百炼
- **modelAliases**：所有非 Anthropic 供应商添加 sonnet/opus/haiku 模型别名映射
- **MCP JSON 批量导入**：兼容 Claude Desktop 格式，重复 ID 自动跳过
- **MCP 运行时检测**：npx/uvx 不存在时返回下载链接提示
- **MCP 远程连接验证**：HTTP/SSE URL 可达性检查（DNS/超时/401/404/405 错误映射）
- **mcpServerArgs**：MCP 服务器追加启动参数
- **Provider 模型数据同步**：volcengine/zenmux/openrouter 模型列表更新

#### 工作区右键菜单 + Analytics (PRD 0.1.7)
- **右键菜单**：文件（预览/引用/打开/重命名/删除）、文件夹（打开/引用/重命名/删除）
- **@引用注入**：右键「引用」将 `@相对路径` 插入聊天输入框
- **文件冲突重命名**：拖拽同名文件自动重命名为 `filename (1).ext`
- **Analytics 埋点**：匿名统计（默认关闭），device_id 持久化 + 事件批量发送
- **日志导出**：Settings 导出近 3 天统一日志为 zip

#### 使用统计系统 (PRD 0.1.8)
- **Turn 级 usage 采集**：从 SDK result 事件提取 modelUsage（per-model breakdown）+ 聚合 fallback
- **持久化**：assistant 消息附带 usage/toolCount/durationMs，SessionStats 扩展 cache token 统计
- **统计 API**：`GET /sessions/:id/stats`（单 session）+ `GET /api/global-stats?range=`（全局）
- **消息 inline 展示**：assistant 气泡下方显示模型名 + token 数 + 耗时
- **UsageStatsPanel**：设置页全局统计面板（汇总卡片 + 每日趋势图 + 模型分布表）
- **SessionStatsModal**：历史记录菜单打开单 session 统计弹窗

### 改进
- **ConfigContext 拆分**：Data + Actions 双 Context，避免 actions 变化触发全子树重渲染
- **providerVerifyStatus 缓存**：Provider 验证状态持久化到 AppConfig

---

## [0.1.4] - 2026-03-15

### 新增
- **持久会话模式**：子进程常驻，多轮对话免重启 SDK
- **Sidecar 架构重构**：粒度从 Tab 级改为 Session 级隔离，每个 Session 独立进程
- **定时任务系统**：Rust scheduler + Sidecar owner 管理 + 前端任务视图 UI，支持 cron 表达式和固定间隔（every）调度模式
- **Tool 渲染增强**：新增 6 个工具专用渲染器（Bash/KillShell/Agent/Read/Edit/Glob），CodeBlock 组件独立抽取，Message 组件重构
- **ChatInput @ 文件引用**：输入 `@` 触发文件搜索，选择后插入路径引用；Skill 多选支持
- **Provider 配置对齐**：Provider 类型/预设供应商/订阅验证/缓存机制与 MyAgents 对齐
- **Provider upstreamFormat & maxOutputTokens**：支持 OpenAI Bridge 所需的协议格式和输出 token 限制配置
- **UI 交互增强**：文件 Tab 拖拽排序、停止按钮、会话运行指示器
- **CodeMirror Merge Diff**：差异视图增强
- **Provider 可用性防护**：未配置 API Key 的供应商灰显禁用，发送按钮联动禁用
- **搜索弹窗最近对话**：搜索弹窗打开时默认展示最近 10 条对话列表
- **GitHub Actions CI**：push `v*` tag 自动构建签名公证 DMG；R2 updater manifest 自动上传 & 签名流程优化

### 修复
- **Session 切换消息丢失**：streaming chunk 同步累加到 `assistantContent`，`loadSession` 等待 query 完成后再切换
- **useAutoScroll 依赖稳定性**：将 spread array 依赖改为 `triggerCount + isLoading`，避免无限重渲染
- scrollbar-hide 工具类样式补充
- Rust 编译 warning 清理（移除未使用的 SidecarOwner::ScheduledTask 和 healthy 字段）

### 改进
- **日志增强**：sdkSessionId 持久化、SSE 广播日志
- **日志目录隔离**：开发版 `~/.soagents/logs_dev/`，发布版 `~/.soagents/logs/`
- 同步 Cargo.lock 版本号，移除 filesystem MCP 预设

---

## [0.1.3] - 2026-02-28

### 修复
- 打包时排除 macOS `._ ` 元数据文件，修复 updater 解包失败

---

## [0.1.2] - 2026-02-28

### 修复
- 为 bundled bun 添加 JIT entitlements，修复正式版 sidecar 崩溃

---

## [0.1.1] - 2026-02-28

### 新增
- **自动更新系统**：Tauri updater + 统一日志 + SSE/滚动优化
- **Tauri 原生文件拖拽**：支持拖拽文件到工作区
- **变动文件目录树**：未跟踪文件展开显示
- **GitHub Actions CI**：发布流程、updater 签名、.tar.gz/.sig 产物生成

### 修复
- 用户消息气泡内粘贴内容颜色不统一
- Moonshot URL 修复
- icon.png 加入版本控制，修复 CI 构建失败

---

## [0.1.0] - 2026-02-23

### 新增
- **应用内 WebView**：聊天消息和 Markdown 预览中的 HTTP 链接点击后在 SecondTabBar 子标签页中打开，使用 Tauri v2 原生 WebView 加载（支持 GitHub 等设置了 X-Frame-Options 的网站）。导航栏支持 URL 显示、刷新、外部浏览器打开
- **权限模式重设计**：从 default/acceptEdits/bypassPermissions 调整为 Plan/协同/自主三模式，对齐 Claude Code 标准模式。全新卡片式 UI，带图标、颜色和「推荐」标签
- **Settings 通用 Tab**：开机启动（tauri-plugin-autostart）、默认工作区路径选择、网络代理配置
- **Settings 关于 Tab**：版本信息、产品描述、外部链接、隐藏开发者选项（连击 5 次解锁）
- **内置 Skills**：bundled-skills 目录新增 docx/pdf/pptx/xlsx/skill-creator/summarize 六个内置技能，应用启动时自动种子化
- **MCP 预设**：内置 MCP 服务器预设配置（`src/shared/mcp-presets.ts`），支持启用/禁用切换，禁止删除内置项
- **多模态图片消息**：agent-session 支持 base64 图片作为消息内容发送
- **CustomSelect 组件**：统一的自定义下拉选择器（`src/renderer/components/CustomSelect.tsx`）

### 改进
- **Settings 页面重构**：MCP 和 Skills 管理 UI 整合到 Settings Tab 中，支持启用/禁用切换
- **WorkspaceFilesPanel 增强**：文件面板功能优化
- **AppConfig 类型扩展**：新增 ProxySettings、minimizeToTray、defaultWorkspacePath、showDevTools 等配置字段
- **configService 升级**：改用 spread merge 自动兼容新配置字段

### 修复
- **供应商 CRUD Bug**：修复 `addCustomProvider` 未自动生成 `id` 导致编辑/删除功能无法使用的问题
- **Tauri unstable 特性**：启用 `unstable` feature flag 支持多 WebView 创建
- 清理过时的 PLAN 和 specs 文档

### 技术细节
- Tauri Cargo.toml 新增 `unstable` feature + `tauri-plugin-autostart` 依赖
- Tauri capabilities 新增 9 项 webview 权限 + autostart 权限
- 新增 `useAutostart` hook、`developerMode` 工具、`parsePartialJson` 工具函数

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

[Unreleased]: https://github.com/applre/SoAgents/compare/v0.1.7...HEAD
[0.1.7]: https://github.com/applre/SoAgents/compare/v0.1.5...v0.1.7
[0.1.5]: https://github.com/applre/SoAgents/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/applre/SoAgents/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/applre/SoAgents/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/applre/SoAgents/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/applre/SoAgents/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/applre/SoAgents/compare/v0.0.9...v0.1.0
[0.0.9]: https://github.com/applre/SoAgents/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/applre/SoAgents/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/applre/SoAgents/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/applre/SoAgents/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/applre/SoAgents/compare/v0.0.1...v0.0.5
[0.0.1]: https://github.com/applre/SoAgents/releases/tag/v0.0.1
