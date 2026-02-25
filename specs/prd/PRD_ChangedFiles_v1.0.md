# SoAgents — 变动文件 PRD

> **文档版本**: v1.0
> **更新日期**: 2026-02-23
> **功能范围**: 工作区级别的 Git 变动文件追踪与 Diff 预览
> **前置依赖**: WorkspaceFilesPanel 已实现、Sidecar API 层已实现

---

## 1. 背景与动机

### 1.1 现状

SoAgents 中 AI Agent 通过工具调用（Edit、Write、Bash 等）频繁修改工作区文件。当前用户只能通过：

- 外部终端执行 `git status` / `git diff`
- 打开 VS Code 等编辑器查看变更
- 逐个文件手动对比

来了解 Agent 做了哪些文件修改，缺乏集成在 SoAgents 内部的变动追踪能力。

### 1.2 目标

在现有的 **WorkspaceFilesPanel（右侧工作区文件面板）** 中新增「变动文件」Tab，实时展示 Git 工作区中的文件变更，支持点击展开行级 Diff 预览，让用户无需离开 SoAgents 即可掌握 Agent 的所有文件操作。

### 1.3 设计原则

- **零配置**：自动检测 Git 仓库，非 Git 仓库给出明确提示
- **实时性**：Tab 激活时每 5 秒自动刷新，无需手动操作
- **轻量**：Diff 按需加载（点击时获取），不预加载全部文件
- **非侵入**：融入现有 Tab 体系，不改变已有文件树和项目设置功能

---

## 2. 功能设计

### 2.1 UI 变更

在 `WorkspaceFilesPanel` 的 Tab 栏中新增 **「变动文件」** tab，始终可见（不需要点击 Settings 按钮），位于「所有文件」和「项目设置」之间。

```
顶部标题区: "工作区文件"  [Eye] [Refresh] [FolderOpen] [Settings]
Tab 区:     [所有文件] [变动文件 ③] [项目设置]
                              ↑ 变动数量 badge
内容区（变动文件 tab 激活时）:
  ┌──────────────────────────────────┐
  │ ▶ [M] index.ts          src/     │  ← 点击展开 Diff
  │ ▼ [A] utils.ts          src/lib  │  ← 已展开
  │   ┌─────────────────────────────┐│
  │   │ @@ -0,0 +1,15 @@           ││  ← Hunk 头（蓝色）
  │   │ +import { foo } from ...    ││  ← 新增行（绿色）
  │   │ +export function bar() {    ││
  │   └─────────────────────────────┘│
  │ ▶ [D] old.ts             src/     │
  │ ▶ [U] temp.txt           ./       │
  └──────────────────────────────────┘
```

### 2.2 文件状态标识

| 标识 | 含义 | 颜色 | 说明 |
|------|------|------|------|
| **M** | Modified | 黄色 `#d29922` | 已跟踪文件被修改 |
| **A** | Added | 绿色 `#3fb950` | 新文件已暂存 |
| **D** | Deleted | 红色 `#f85149` | 文件被删除 |
| **U** | Untracked | 灰色 `#8b949e` | 新文件未暂存 |
| **R** | Renamed | 紫色 `#a371f7` | 文件重命名 |

### 2.3 Diff 预览

点击任意变动文件行展开/收起行级 Diff 预览：

- **新增行**（`+` 开头）：绿色背景 `rgba(46, 160, 67, 0.15)` + 绿色文字
- **删除行**（`-` 开头）：红色背景 `rgba(248, 81, 73, 0.15)` + 红色文字
- **Hunk 头**（`@@` 开头）：蓝色背景 `rgba(56, 139, 253, 0.1)` + 蓝色文字
- **上下文行**：默认三级墨色
- 最大高度 300px，超出滚动
- 字体：等宽字体 11px

### 2.4 非 Git 仓库处理

若工作区不是 Git 仓库（`git rev-parse --is-inside-work-tree` 失败），显示：

```
          非 Git 仓库，无法追踪变更
       请在工作区中初始化 Git 仓库
```

### 2.5 刷新机制

| 触发条件 | 行为 |
|----------|------|
| 切换到「变动文件」Tab | 立即获取一次 |
| Tab 保持激活中 | 每 5 秒轮询刷新 |
| 切换工作区 | 清空状态，重新检测 |
| 轮询刷新 | 同时清除 Diff 缓存，确保 Diff 内容最新 |

---

## 3. 技术方案

### 3.1 数据流

```
WorkspaceFilesPanel                   Sidecar (Bun)
      │                                    │
      ├─ GET /api/changed-files ──────────►│
      │  ?agentDir=xxx                     │── git rev-parse --is-inside-work-tree
      │                                    │── git status --porcelain
      │◄─ { isGitRepo, files[] } ──────────┤
      │                                    │
      ├─ GET /api/file-diff ──────────────►│
      │  ?agentDir=xxx&path=xxx            │── git diff HEAD -- <path>
      │                                    │── git diff --cached -- <path>  (fallback)
      │                                    │── readFileSync (untracked fallback)
      │◄─ { diff, content, isNew } ────────┤
```

### 3.2 后端 API

#### `GET /api/changed-files`

| 参数 | 类型 | 说明 |
|------|------|------|
| `agentDir` | string (query) | 工作区绝对路径 |

**响应**:

```typescript
{
  isGitRepo: boolean;
  files: Array<{
    path: string;     // 相对路径，如 "src/index.ts"
    status: string;   // "M" | "A" | "D" | "U" | "R"
  }>;
}
```

**实现**:
1. `Bun.spawnSync(['git', 'rev-parse', '--is-inside-work-tree'], { cwd })` 检测 Git 仓库
2. `Bun.spawnSync(['git', 'status', '--porcelain'], { cwd })` 获取变动列表
3. 解析 `XY filename` 格式：
   - `??` → U (Untracked)
   - X/Y 含 `D` → D (Deleted)
   - X 为 `A` → A (Added)
   - X 为 `R` → R (Renamed)
   - 其他 → M (Modified)
4. 处理带引号路径和 rename 格式（`old -> new`）

#### `GET /api/file-diff`

| 参数 | 类型 | 说明 |
|------|------|------|
| `agentDir` | string (query) | 工作区绝对路径 |
| `path` | string (query) | 文件相对路径 |

**响应**:

```typescript
{
  diff: string | null;    // git diff 输出
  content: string | null; // 文件完整内容（untracked 时）
  isNew: boolean;         // 是否为新文件
}
```

**实现**:
1. 尝试 `git diff HEAD -- <path>`（含 staged + unstaged）
2. 若 HEAD 不存在或无输出，尝试 `git diff --cached -- <path>`
3. 仍无输出则 `readFileSync` 读取文件内容（untracked 文件），标记 `isNew: true`

**安全**: 使用 `Bun.spawnSync` 数组参数形式，无 shell 注入风险。`--` 分隔符确保路径不被解释为 git 选项。

### 3.3 前端组件

| 组件 | 类型 | 职责 |
|------|------|------|
| `StatusBadge` | 纯展示 | 根据状态码渲染彩色徽章 |
| `DiffView` | 纯展示 | 解析 diff/content 并行级渲染 |
| `WorkspaceFilesPanel` | 有状态 | 管理变动文件列表、Diff 缓存、展开状态 |

**新增状态**:

```typescript
changedFiles: ChangedFileEntry[]        // 变动文件列表
isGitRepo: boolean | null               // Git 仓库检测结果
changedLoading: boolean                 // 列表加载状态
expandedDiffPath: string | null         // 当前展开 Diff 的文件路径
diffCache: Record<string, FileDiffResult> // Diff 结果缓存
diffLoading: boolean                    // Diff 加载状态
```

---

## 4. 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/server/index.ts` | 修改 | 新增 `/api/changed-files` 和 `/api/file-diff` 路由 |
| `src/renderer/components/WorkspaceFilesPanel.tsx` | 修改 | 新增变动文件 Tab、StatusBadge、DiffView |

---

## 5. 边界与限制

### 5.1 当前版本不支持

- **非 Git 仓库的变动追踪**：依赖 Git，非 Git 项目仅显示提示信息
- **大文件 Diff**：未做虚拟化，超大 Diff 可能导致渲染卡顿
- **二进制文件 Diff**：Git 对二进制文件输出 `Binary files differ`，当前原样展示
- **Stash / 分支对比**：仅对比当前工作区 vs HEAD
- **多 remote 状态**：不显示 ahead/behind 等推送状态

### 5.2 后续迭代方向

| 方向 | 说明 |
|------|------|
| Agent 操作实时触发刷新 | 在 `chat:tool-result` / `chat:message-complete` SSE 事件后主动刷新，替代轮询 |
| 文件级操作 | 支持 Stage / Unstage / Discard 单个文件 |
| Diff 虚拟化 | 大文件 Diff 使用虚拟滚动，避免 DOM 节点过多 |
| Commit 面板 | 在变动文件 Tab 底部增加提交消息输入 + Commit 按钮 |
| 分支对比 | 支持选择 base 分支进行对比 |

---

## 6. 验证清单

- [ ] `npm run typecheck` 通过
- [ ] Git 仓库工作区：「变动文件」Tab 正确显示变动文件列表和状态徽章
- [ ] 非 Git 仓库工作区：显示「非 Git 仓库，无法追踪变更」
- [ ] 点击文件展开 Diff 预览，新增行绿色、删除行红色、Hunk 头蓝色
- [ ] 新文件（Untracked）展开后显示完整内容，所有行绿色
- [ ] Tab 激活时每 5 秒自动刷新列表
- [ ] 切换工作区后状态正确清空和重新加载
- [ ] 变动文件数量 Badge 在 Tab 标签上正确显示
