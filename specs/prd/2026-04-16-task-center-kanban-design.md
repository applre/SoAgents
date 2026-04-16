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

新增 `lastViewedAt` 字段记录用户最后一次打开该 session 的时间戳。当用户点击卡片导航到 session 时，更新 `lastViewedAt` 为当前时间。

Approval 判定逻辑：`sessionState === 'idle' && lastMessage.role === 'assistant' && lastViewedAt < lastActiveAt`

一旦用户打开了该 session，`lastViewedAt >= lastActiveAt`，状态自动变为 Inactive。

### Backend API Changes

`GET /chat/sessions` 返回需要附加：
- `sessionState`: 'idle' | 'running' | 'error'（当前 sidecar 运行状态，无 sidecar 时为 'idle'）
- `lastMessageRole`: 'user' | 'assistant' | null（最后一条消息的 role）
- `lastViewedAt`: ISO timestamp | null

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
| `src/server/index.ts` | `/chat/sessions` 接口扩展返回字段 |

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
- **LastActiveTime**: 11px, color #999, 相对时间
- **MessageCount**: 11px, color #999, 格式 "N条"
- **Labels**: 10px, pill style tag, 暖棕色（`--accent`），如 "定时"
- **Workspace name** (仅状态/时间分组模式): 10px, color #999, 右下角

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
- 定时任务作为卡片上的 tag 展示，不再有独立右侧面板

## Styling

遵循 SoAgents 设计规范：
- CSS 变量驱动，禁止硬编码颜色
- 卡片: `rounded-lg border-[var(--border)] bg-[var(--paper)]`
- 列背景: `bg-[var(--surface)]`
- 看板区域背景: `bg-[var(--surface)]`
- 动效: `transition-colors`, `transition-shadow`, 150ms
- 图标: Lucide React
- 字体: 项目设计规范字号

## Out of Scope (v1)

- 拖拽排序（@dnd-kit）
- 手动 position 排序
- 卡片上的优先级/标签自定义
- 列折叠/隐藏
- 看板视图的持久化偏好存储（v1 每次打开默认工作区分组）
