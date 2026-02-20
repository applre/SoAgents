# Markdown Editor 功能规划

> 调研日期：2026-02-18
> 目标版本：下一个迭代

---

## 背景

用户需要在 soagents 中集成一个 Markdown 编辑器，风格参考 Obsidian，支持编辑和阅读两种模式切换。

---

## 技术选型

### 编辑器核心：CodeMirror 6

- **官网**：https://codemirror.net
- **协议**：MIT，完全免费，无需 API key
- **选择原因**：
  - Obsidian 底层也使用 CodeMirror 6
  - 专为浏览器设计，比 Monaco Editor 更轻量
  - 原生支持 Markdown 语法高亮
  - 适合文档编辑场景（Monaco 更适合代码编辑）

### 对比：Monaco Editor vs CodeMirror 6

| 维度 | Monaco Editor | CodeMirror 6 |
|------|--------------|--------------|
| 出身 | VS Code 编辑器内核 | 专为浏览器设计 |
| 体积 | 较重 | 轻量 |
| 适合场景 | 代码编辑 | 文档/Markdown 编辑 |
| 实时预览支持 | 不支持 | 原生支持 |
| Obsidian 使用 | ❌ | ✅ |

### 渲染层（已有依赖，无需新增）

| 库 | 作用 |
|----|------|
| `react-markdown` | 核心渲染，将 Markdown 字符串转为 React 组件 |
| `remark-gfm` | 插件，支持 GFM 扩展语法（表格、任务列表、删除线、自动链接） |
| `react-syntax-highlighter` | 代码块语法高亮 |

三者关系：`react-markdown` 是发动机，另外两个是插件。

---

## 功能设计

### 模式切换（Obsidian 风格）

Obsidian 共 **2 种模式**（不是 3 种）：

| 模式 | 说明 |
|------|------|
| **Edit（编辑视图）** | CodeMirror 编辑器，可编辑，Markdown 语法高亮 |
| **Preview（阅读视图）** | react-markdown 全屏渲染，只读 |

> **注意**：Split（左右分屏）是 Typora/MarkText 风格，不是 Obsidian 风格。
> Obsidian 的分屏是布局功能（同时打开多个文档），与编辑/阅读模式无关。

UI 交互：右上角两个切换按钮，共享同一份文本 state，切换无缝。

### 工具栏（Edit 模式显示，Preview 模式隐藏）

| 按钮 | 功能 | 插入内容 |
|------|------|---------|
| **B** | 粗体 | `**文字**` |
| *I* | 斜体 | `*文字*` |
| H1 | 一级标题 | `# ` |
| H2 | 二级标题 | `## ` |
| `code` | 行内代码 | `` `代码` `` |
| 代码块 | 多行代码 | ` ```\n\n``` ` |
| 链接 | 超链接 | `[文字](url)` |
| —— | 分割线 | `---` |

### 文件操作

- **保存**：`Cmd+S` 触发，调用 `@tauri-apps/plugin-dialog`（已安装）弹出系统保存框，写 `.md` 文件
- **导出 HTML**：将 react-markdown 渲染结果包一层 HTML 模板下载
- 顶部显示当前文件名

---

## 实现方案

### 需要新增的依赖

```bash
bun add @uiw/react-codemirror @codemirror/lang-markdown @codemirror/theme-one-dark
```

### 新建文件

```
src/renderer/pages/Editor.tsx              # 主编辑器页面
src/renderer/components/EditorToolbar.tsx  # 工具栏组件
```

### 接入方式

在现有 Tab 系统（`src/renderer/types/tab.ts`）中新增 `editor` Tab 类型，与 `chat`、`settings`、`launcher` 并列。

### 组件结构

```
Editor.tsx
├── EditorToolbar（Edit 模式下显示）
│   ├── 格式化按钮组
│   └── Edit | Preview 切换按钮
├── CodeMirror（Edit 模式）
└── ReactMarkdown（Preview 模式）
```

---

## 待决策项（下一版本迭代时确认）

- [ ] 是否支持图片插入（粘贴/拖拽上传）
- [ ] 是否需要文件树/文件管理侧边栏（多文档管理）
- [ ] 主题：跟随系统深色/浅色，还是固定深色
- [ ] 是否支持 Vim 键位（CodeMirror 6 有插件支持）
- [ ] 导出格式：仅 HTML，还是也支持 PDF（可用 Tauri 的打印功能）
