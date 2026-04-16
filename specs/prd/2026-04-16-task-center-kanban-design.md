# Task Center Kanban View Design

## Overview

将任务中心从纯列表视图改造为看板 + 列表双视图模式。看板以分组可视化方式展示 session，支持按工作区（默认）、状态、时间三种维度分组。不引入拖拽，状态由系统自动判定。

参考项目：[multica-ai/multica](https://github.com/multica-ai/multica)（看板布局和卡片设计参考）

## Data Model Changes

### SessionMetadata 扩展

在 `src/shared/types/session.ts` 中新增：

```typescript
type SessionStatus = 'active' | 'approval' | 'inactive' | 'archived';
```

`status` 不持久化到磁盘，由前端根据以下条件实时计算：

| Status | Condition | Visual |
|--------|-----------|--------|
| `active` | sidecar sessionState === 'running' | 绿色实心圆 |
| `approval` | sessionState === 'idle' + 最后消息是 assistant + 用户未打开过（lastViewedAt < lastActiveAt） | 蓝色实心圆 |
| `inactive` | 其他所有非归档 session | 空心圆 |
| `archived` | session.archived === true | 灰色实心圆 |

### lastViewedAt 机制

新增 `lastViewedAt` 字段（持久化到 SessionMetadata）记录用户最后一次打开该 session 的时间戳。

Approval 判定逻辑：`sessionState !== 'running' && lastMessageRole === 'assistant' && lastViewedAt < lastActiveAt`

一旦用户打开了该 session，`lastViewedAt >= lastActiveAt`，状态自动变为 Inactive。

当用户在已打开的 session tab 中收到 assistant 回复时，`lastViewedAt` 也同步更新，避免切回任务中心时误显示 Approval。

### lastViewedAt 持久化

`lastViewedAt` 存储在 `SessionMetadata` 中（即 `sessions.json` 索引文件）。更新时机：
- 用户在任务中心点击卡片打开 session 时
- 用户在已打开的 session tab 中收到新的 assistant 回复时（自动更新，避免切回任务中心时误显示 Approval）

### Backend API Changes

#### sessionState: Rust 层提供全局运行状态

`sessionState` 不通过 Bun sidecar 获取（每个 sidecar 只知道自己的 session）。改由 Rust 层的 `SidecarPool` 提供：

1. 新增 Tauri command `cmd_get_active_sessions` → 返回所有有活跃 sidecar 的 session ID 集合
2. 前端通过 `invoke('cmd_get_active_sessions')` 获取，与 session 列表做交集
3. 在 `useTaskCenterData` 中组合：有活跃 sidecar 的 session → `active`，其他 → 非 active

这避免了跨 sidecar 查询的架构问题。

#### lastMessageRole: 持久化到 SessionMetadata

为避免在列表请求时读取所有 session 的消息文件（性能问题），`lastMessageRole` 在每次消息保存时同步更新到 `SessionMetadata`：

1. `SessionStore.addMessage()` 时，同时更新 `sessions.json` 中对应 session 的 `lastMessageRole` 字段
2. `GET /chat/sessions` 直接从索引返回，无需额外 I/O

#### lastViewedAt

通过 `PUT /chat/sessions/:id/viewed` 更新，将 `lastViewedAt` 写入 `SessionMetadata`。

### Polling / Real-time Updates

看板视图需要感知 session 状态变化（running → idle）。策略：
- `cmd_get_active_sessions` 每 5 秒轮询一次（仅在看板视图激活时）
- session 列表本身不轮询（沿用现有的 mount-time fetch）
- 轮询在切换到列表视图或离开任务中心时停止

## UI Architecture

### Component Hierarchy

```
TaskCenterView (existing, modified)
├── Toolbar
│   ├── Title: "任务中心"
│   ├── ViewTabs: [看板 | 列表]
│   ├── Separator
│   ├── GroupSegmentControl: [工作区 | 状态 | 时间]  (only shown in kanban mode)
│   └── SearchBox
├── BoardView (new)
│   ├── BoardColumn × N
│   │   ├── ColumnHeader: group name + count
│   │   └── SessionCard × N
│   │       ├── StatusDot (color by status)
│   │       ├── Title
│   │       ├── LastActiveTime (relative)
│   │       ├── MessageCount
│   │       └── Labels (e.g., "定时" tag)
│   └── Horizontal scroll container
└── ListView (existing session list, unchanged)
```

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/taskCenter/BoardView.tsx` | 看板容器，管理列和分组逻辑 |
| `src/renderer/components/taskCenter/BoardColumn.tsx` | 单列组件 |
| `src/renderer/components/taskCenter/SessionCard.tsx` | 卡片组件 |

### Modified Files

| File | Change |
|------|--------|
| `src/renderer/pages/TaskCenterView.tsx` | 添加视图切换、分组控件、条件渲染 BoardView/ListView |
| `src/renderer/hooks/useTaskCenterData.ts` | 扩展 fetch 逻辑，获取 sessionState 和 lastMessageRole |
| `src/shared/types/session.ts` | 添加 SessionStatus type |
| `src/server/index.ts` | `/chat/sessions` 接口返回 `lastMessageRole`/`lastViewedAt`；新增 `PUT /chat/sessions/:id/viewed` |
| `src-tauri/src/sidecar.rs` | 新增 `cmd_get_active_sessions` Tauri command |

## Grouping Logic

### View State

```typescript
type ViewMode = 'board' | 'list';
type GroupBy = 'workspace' | 'status' | 'time';
```

ViewMode 和 GroupBy 状态保存在 TaskCenterView 的 useState 中。

### Group: 工作区 (default)

- 每个唯一 `session.agentDir` 生成一列
- 列名：workspace 目录的最后一段路径名（basename）
- 列排序：按列内最新 session 的 `lastActiveAt` 降序
- 卡片内不显示工作区名（列头已表达）

### Group: 状态

固定 4 列：Active → Approval → Inactive → Archived

- 列头带对应颜色的状态圆点
- 卡片右下角显示工作区名（作为辅助信息）
- Archived 列默认显示（即使为空）

### Group: 时间

固定 4 列：今天 → 昨天 → 本周 → 更早

- 基于 `lastActiveAt` 计算分组，使用本地时间
- "今天"：本地日期 === today
- "昨天"：本地日期 === today - 1
- "本周"：本地日期在本周一到今天之间（不含今天和昨天）
- "更早"：本周一之前的所有
- 卡片右下角显示工作区名（作为辅助信息）
- 空列不显示

### Card Sort Within Column

所有分组模式下，列内卡片按 `lastActiveAt` 降序排列（最新的在上面）。

## Card Design

### Layout

```
┌──────────────────────────────┐
│ ● 产品调研                    │  ← StatusDot + Title
│ 21 分钟前          53条       │  ← LastActiveTime + MessageCount
│                       [定时]  │  ← Labels (optional)
└──────────────────────────────┘
```

### Card Info

- **StatusDot**: 8px 圆点，颜色由 SessionStatus 决定
- **Title**: 13px, font-weight 500, 单行截断
- **LastActiveTime**: 11px, `var(--ink-tertiary)`, 相对时间
- **MessageCount**: 11px, `var(--ink-tertiary)`, 格式 "N条"
- **Labels**: 10px, pill style tag, `var(--accent)` 色，如 "定时"
- **Workspace name** (仅状态/时间分组模式): 10px, `var(--ink-tertiary)`, 右下角

### Card Interactions

- **Click**: 导航到该 session 对话页面，更新 `lastViewedAt`
- **Hover**: subtle shadow + border-color 变化
- **Right-click / hover menu**: 归档 / 取消归档、查看统计（沿用现有）

## Toolbar Design

### View Tabs

两个 tab 按钮，紧密排列，圆角矩形：
- Active tab: `bg-[var(--accent)] text-white`
- Inactive tab: `border-[var(--border)] hover:bg-[var(--hover)]`

### Group Segmented Control

三段式按钮组（iOS Segmented Control 风格）：
- Active segment: `bg-[var(--surface)] font-weight-500`
- Inactive segment: 默认背景 + hover 态
- 仅在看板模式下显示

### Search

沿用现有搜索逻辑（debounce 300ms，调用 `/chat/search`）。搜索模式下看板隐藏，显示搜索结果列表。

## Existing Features Preserved

- 列表视图完全不变
- 搜索功能不变
- 归档/取消归档 API 不变
- SessionStatsModal 不变
- 左侧边栏最近对话列表不变
- 定时任务作为卡片上的 tag 展示，不再有独立右侧面板（原右侧定时任务面板移除，定时任务管理入口保留在左侧边栏"定时任务"菜单项）

## Styling

遵循 SoAgents 设计规范：
- CSS 变量驱动，禁止硬编码颜色
- 卡片: `rounded-lg border-[var(--border)] bg-[var(--paper)]`
- 列背景: `bg-[var(--surface)]`
- 看板区域背景: `bg-[var(--surface)]`
- 动效: `transition-colors`, `transition-shadow`, 150ms
- 图标: Lucide React
- 字体: 项目设计规范字号

## Board Scroll Behavior

- 列固定宽度 280px，`flex-shrink: 0`
- 看板容器 `overflow-x: auto`，支持横向滚动
- 每列内部 `overflow-y: auto`，支持纵向滚动
- 当列数少于可见区域时，列左对齐不拉伸

## Session Status Computation

`computeSessionStatus()` 函数放在 `src/renderer/utils/sessionStatus.ts`：

```typescript
function computeSessionStatus(
  session: SessionMetadata,
  activeSidecarSessionIds: Set<string>
): SessionStatus {
  if (session.archived) return 'archived';
  if (activeSidecarSessionIds.has(session.id)) return 'active';
  if (
    session.lastMessageRole === 'assistant' &&
    (!session.lastViewedAt || new Date(session.lastViewedAt) < new Date(session.lastActiveAt))
  ) return 'approval';
  return 'inactive';
}
```

## Out of Scope (v1)

- 拖拽排序（@dnd-kit）
- 手动 position 排序
- 卡片上的优先级/标签自定义
- 列折叠/隐藏
- 看板视图的持久化偏好存储（v1 每次打开默认看板 + 工作区分组）
- 键盘导航（方向键切换列/卡片）
- 看板内搜索过滤（v1 搜索时切换到搜索结果列表）
