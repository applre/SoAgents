# Task Center Kanban View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the task center from a list-only view to a kanban + list dual-view, with three grouping dimensions (workspace, status, time) and automatic session status detection.

**Architecture:** Extend `SessionMetadata` with `lastMessageRole` and `lastViewedAt` fields (persisted to `sessions.json`). Front-end computes `SessionStatus` from these fields + active sidecar info (via existing `cmd_list_running_sidecars` Tauri command — sidecar IDs are session IDs when owner is `SidecarOwner::Session`). New `BoardView`, `BoardColumn`, and `SessionCard` components render the kanban. `TaskCenterView` adds view/group mode switching toolbar.

**Import paths:** `@/*` maps to `src/renderer/*`. For `src/shared/` use relative paths (e.g., `../../shared/types/session`).

**Tech Stack:** React 19, TypeScript, TailwindCSS, Tauri v2 invoke, Bun sidecar API

**Spec:** `specs/prd/2026-04-16-task-center-kanban-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/types/session.ts` | Modify | Add `SessionStatus` type, extend `SessionMetadata` with `lastMessageRole`, `lastViewedAt` |
| `src/server/SessionStore.ts` | Modify | Persist `lastMessageRole` on `saveMessage()`, add `markViewed()` function |
| `src/server/index.ts` | Modify | Add `PUT /chat/sessions/:id/viewed` endpoint |
| `src/renderer/utils/sessionStatus.ts` | Create | `computeSessionStatus()` pure function |
| `src/renderer/components/taskCenter/SessionCard.tsx` | Create | Kanban card component |
| `src/renderer/components/taskCenter/BoardColumn.tsx` | Create | Single column component |
| `src/renderer/components/taskCenter/BoardView.tsx` | Create | Board container with grouping logic |
| `src/renderer/hooks/useTaskCenterData.ts` | Modify | Add active sidecar polling, expose `activeSidecarSessionIds` |
| `src/renderer/pages/TaskCenterView.tsx` | Modify | Add toolbar (view tabs, segment control), conditional rendering |

---

### Task 1: Extend SessionMetadata Type

**Files:**
- Modify: `src/shared/types/session.ts`

- [ ] **Step 1: Add SessionStatus type and extend SessionMetadata**

In `src/shared/types/session.ts`, add the `SessionStatus` type and two new optional fields to `SessionMetadata`:

```typescript
export type SessionStatus = 'active' | 'approval' | 'inactive' | 'archived';

// Add to SessionMetadata interface:
  /** Role of the last message in the session ('user' | 'assistant'), updated on each saveMessage */
  lastMessageRole?: 'user' | 'assistant';
  /** ISO timestamp of when the user last opened/viewed this session */
  lastViewedAt?: string;
```

Add `lastMessageRole?: 'user' | 'assistant'` and `lastViewedAt?: string` as optional fields at the end of the `SessionMetadata` interface (after `source`).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (new fields are optional, no consumers break)

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/session.ts
git commit -m "feat(types): add SessionStatus type and metadata fields for kanban view"
```

---

### Task 2: Persist lastMessageRole in SessionStore

**Files:**
- Modify: `src/server/SessionStore.ts`

- [ ] **Step 1: Update saveMessage() to persist lastMessageRole**

In `src/server/SessionStore.ts`, inside the `saveMessage()` function (line 114), after the existing `updateSessionStats()` call (line 125-131), add code to persist `lastMessageRole`:

```typescript
// After updateSessionStats call, add:
  // Update lastMessageRole in session index
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      sessions[idx].lastMessageRole = msg.role as 'user' | 'assistant';
      writeIndex(sessions);
    }
  });
```

Note: `updateSessionStats` already calls `withLock` and `writeIndex`. To avoid double writes, merge the `lastMessageRole` update INTO the existing `updateSessionStats` function instead. In `updateSessionStats()` (line 166), add an optional `lastMessageRole` parameter:

Better approach — modify `updateSessionStats` signature and body:

```typescript
export function updateSessionStats(
  sessionId: string,
  delta: Partial<SessionStats>,
  lastMessageRole?: 'user' | 'assistant'
): void {
  // ... existing code ...
  // Inside withLock, after updating stats, before writeIndex:
  if (lastMessageRole) {
    session.lastMessageRole = lastMessageRole;
  }
  // ... writeIndex(sessions) already called ...
}
```

Then in `saveMessage()`, pass the role:

```typescript
  updateSessionStats(sessionId, {
    messageCount: 1,
    totalInputTokens: msg.usage?.inputTokens ?? 0,
    totalOutputTokens: msg.usage?.outputTokens ?? 0,
    totalCacheReadTokens: msg.usage?.cacheReadTokens ?? 0,
    totalCacheCreationTokens: msg.usage?.cacheCreationTokens ?? 0,
  }, msg.role as 'user' | 'assistant');
```

- [ ] **Step 2: Add markViewed() function**

Add a new exported function in `SessionStore.ts`:

```typescript
export function markViewed(sessionId: string): void {
  if (!isValidId(sessionId)) return;
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx].lastViewedAt = new Date().toISOString();
    writeIndex(sessions);
  });
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/server/SessionStore.ts
git commit -m "feat(session): persist lastMessageRole and add markViewed()"
```

---

### Task 3: Add PUT /chat/sessions/:id/viewed API Endpoint

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: Add the viewed endpoint**

In `src/server/index.ts`, find the existing session endpoints section (near the `PUT /chat/sessions/:id/archive` handler around line 420-435). Add a new endpoint nearby:

```typescript
// PUT /chat/sessions/:id/viewed — mark session as viewed
if (req.method === 'PUT' && url.pathname.match(/^\/chat\/sessions\/[^/]+\/viewed$/)) {
  const sessionId = url.pathname.split('/')[3];
  SessionStore.markViewed(sessionId);
  return Response.json({ ok: true });
}
```

Add the import for `markViewed` if not already importing all of SessionStore. The existing code uses `import * as SessionStore` so it should be accessible.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/server/index.ts
git commit -m "feat(api): add PUT /chat/sessions/:id/viewed endpoint"
```

---

### Task 4: Create computeSessionStatus Utility

**Files:**
- Create: `src/renderer/utils/sessionStatus.ts`

- [ ] **Step 1: Create the status computation function**

Create `src/renderer/utils/sessionStatus.ts`:

```typescript
import type { SessionMetadata, SessionStatus } from '../../shared/types/session';

export function computeSessionStatus(
  session: SessionMetadata,
  activeSidecarSessionIds: Set<string>
): SessionStatus {
  if (session.archived) return 'archived';
  if (activeSidecarSessionIds.has(session.id)) return 'active';
  if (
    session.lastMessageRole === 'assistant' &&
    (!session.lastViewedAt || new Date(session.lastViewedAt) < new Date(session.lastActiveAt))
  ) {
    return 'approval';
  }
  return 'inactive';
}

/** Status display config */
export const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string }> = {
  active:   { label: 'Active',   color: 'var(--success)' },
  approval: { label: 'Approval', color: 'var(--approval, #3b82f6)' }, // Add --approval to index.css
  inactive: { label: 'Inactive', color: 'transparent' },
  archived: { label: 'Archived', color: 'var(--ink-tertiary)' },
};
```

Add `--approval: #3b82f6;` to the `:root` block in `src/renderer/index.css` (alongside existing `--accent`, `--success`, `--error` variables).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/utils/sessionStatus.ts
git commit -m "feat(utils): add computeSessionStatus utility for kanban view"
```

---

### Task 5: Create SessionCard Component

**Files:**
- Create: `src/renderer/components/taskCenter/SessionCard.tsx`

- [ ] **Step 1: Create the card component**

Create directory and file `src/renderer/components/taskCenter/SessionCard.tsx`:

```typescript
import React, { memo } from 'react';
import type { SessionMetadata, SessionStatus } from '../../../shared/types/session';
import type { SessionTag } from '@/hooks/useTaskCenterData';
import { STATUS_CONFIG } from '@/utils/sessionStatus';
import { relativeTimeCompact } from '@/utils/formatTime';

interface SessionCardProps {
  session: SessionMetadata;
  status: SessionStatus;
  tags?: SessionTag[];
  showWorkspace?: boolean;
  onClick: () => void;
}

export const SessionCard = memo(function SessionCard({
  session,
  status,
  tags,
  showWorkspace,
  onClick,
}: SessionCardProps) {
  const statusCfg = STATUS_CONFIG[status];
  const isInactive = status === 'inactive';
  const messageCount = session.stats?.messageCount ?? 0;
  const timeStr = relativeTimeCompact(session.lastActiveAt);

  // Workspace basename
  const workspaceName = showWorkspace
    ? session.agentDir.split('/').filter(Boolean).pop() ?? ''
    : '';

  return (
    <div
      className="bg-[var(--paper)] border border-[var(--border)] rounded-lg px-3.5 py-3 cursor-pointer transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:border-[var(--ink-tertiary)]"
      onClick={onClick}
    >
      {/* Top row: status dot + title */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: isInactive ? 'transparent' : statusCfg.color,
            border: isInactive ? '1.5px solid var(--ink-tertiary)' : 'none',
          }}
        />
        <span className="text-[13px] font-medium truncate flex-1 text-[var(--ink)]">
          {session.title || '未命名对话'}
        </span>
      </div>

      {/* Bottom row: time + count + tags + workspace */}
      <div className="flex items-center justify-between text-[11px] text-[var(--ink-tertiary)]">
        <div className="flex items-center gap-2.5">
          <span>{timeStr}</span>
          <span>{messageCount}条</span>
        </div>
        <div className="flex items-center gap-2">
          {tags?.some(t => t.type === 'cron') && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] font-medium">
              定时
            </span>
          )}
          {showWorkspace && workspaceName && (
            <span className="text-[10px]">{workspaceName}</span>
          )}
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (might need to verify `SessionTag` import path — check what `useTaskCenterData.ts` exports)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/taskCenter/
git commit -m "feat(ui): add SessionCard component for kanban view"
```

---

### Task 6: Create BoardColumn Component

**Files:**
- Create: `src/renderer/components/taskCenter/BoardColumn.tsx`

- [ ] **Step 1: Create the column component**

Create `src/renderer/components/taskCenter/BoardColumn.tsx`:

```typescript
import React, { memo } from 'react';
import type { SessionMetadata, SessionStatus } from '../../../shared/types/session';
import type { SessionTag } from '@/hooks/useTaskCenterData';
import { SessionCard } from './SessionCard';

interface BoardColumnProps {
  title: string;
  sessions: SessionMetadata[];
  statusMap: Map<string, SessionStatus>;
  tagsMap: Map<string, SessionTag[]>;
  showWorkspace: boolean;
  statusDot?: { color: string; hollow?: boolean };
  onSessionClick: (agentDir: string, sessionId: string) => void;
}

export const BoardColumn = memo(function BoardColumn({
  title,
  sessions,
  statusMap,
  tagsMap,
  showWorkspace,
  statusDot,
  onSessionClick,
}: BoardColumnProps) {
  return (
    <div className="w-[280px] min-w-[280px] flex flex-col max-h-full flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2 text-[13px] font-semibold text-[var(--ink)]">
        {statusDot && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: statusDot.hollow ? 'transparent' : statusDot.color,
              border: statusDot.hollow ? `1.5px solid ${statusDot.color}` : 'none',
            }}
          />
        )}
        <span>{title}</span>
        <span className="text-[11px] font-normal text-[var(--ink-tertiary)] bg-[var(--hover)] px-1.5 py-0.5 rounded-full">
          {sessions.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pb-2 px-1">
        {sessions.length === 0 ? (
          <div className="text-center text-[12px] text-[var(--ink-tertiary)] py-5">
            暂无对话
          </div>
        ) : (
          sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              status={statusMap.get(session.id) ?? 'inactive'}
              tags={tagsMap.get(session.id)}
              showWorkspace={showWorkspace}
              onClick={() => onSessionClick(session.agentDir, session.id)}
            />
          ))
        )}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/taskCenter/BoardColumn.tsx
git commit -m "feat(ui): add BoardColumn component for kanban view"
```

---

### Task 7: Create BoardView Component

**Files:**
- Create: `src/renderer/components/taskCenter/BoardView.tsx`

- [ ] **Step 1: Create the board component with grouping logic**

Create `src/renderer/components/taskCenter/BoardView.tsx`:

```typescript
import React, { useMemo, memo } from 'react';
import type { SessionMetadata, SessionStatus } from '../../../shared/types/session';
import type { SessionTag } from '@/hooks/useTaskCenterData';
import { computeSessionStatus, STATUS_CONFIG } from '@/utils/sessionStatus';
import { BoardColumn } from './BoardColumn';

export type GroupBy = 'workspace' | 'status' | 'time';

interface BoardViewProps {
  sessions: SessionMetadata[];
  groupBy: GroupBy;
  activeSidecarSessionIds: Set<string>;
  sessionTagsMap: Map<string, SessionTag[]>;
  onSessionClick: (agentDir: string, sessionId: string) => void;
}

interface ColumnDef {
  key: string;
  title: string;
  sessions: SessionMetadata[];
  statusDot?: { color: string; hollow?: boolean };
}

// Sort sessions within a column: lastActiveAt descending
function sortByLastActive(sessions: SessionMetadata[]): SessionMetadata[] {
  return [...sessions].sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
  );
}

function groupByWorkspace(
  sessions: SessionMetadata[]
): ColumnDef[] {
  const groups = new Map<string, SessionMetadata[]>();
  for (const s of sessions) {
    const key = s.agentDir;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  return Array.from(groups.entries())
    .map(([dir, items]) => ({
      key: dir,
      title: dir.split('/').filter(Boolean).pop() ?? dir,
      sessions: sortByLastActive(items),
    }))
    .sort((a, b) => {
      // Sort columns by most recent session
      const aTime = new Date(a.sessions[0]?.lastActiveAt ?? 0).getTime();
      const bTime = new Date(b.sessions[0]?.lastActiveAt ?? 0).getTime();
      return bTime - aTime;
    });
}

function groupByStatus(
  sessions: SessionMetadata[],
  statusMap: Map<string, SessionStatus>
): ColumnDef[] {
  const order: SessionStatus[] = ['active', 'approval', 'inactive', 'archived'];
  const groups: Record<string, SessionMetadata[]> = {
    active: [], approval: [], inactive: [], archived: [],
  };

  for (const s of sessions) {
    const status = statusMap.get(s.id) ?? 'inactive';
    groups[status].push(s);
  }

  return order.map(status => {
    const cfg = STATUS_CONFIG[status];
    return {
      key: status,
      title: cfg.label,
      sessions: sortByLastActive(groups[status]),
      statusDot: {
        color: status === 'inactive' ? 'var(--ink-tertiary)' : cfg.color,
        hollow: status === 'inactive',
      },
    };
  });
}

function groupByTime(sessions: SessionMetadata[]): ColumnDef[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  // Monday of this week
  const dayOfWeek = todayStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(todayStart.getTime() - mondayOffset * 86400000);

  const buckets: { key: string; title: string; sessions: SessionMetadata[] }[] = [
    { key: 'today', title: '今天', sessions: [] },
    { key: 'yesterday', title: '昨天', sessions: [] },
    { key: 'thisWeek', title: '本周', sessions: [] },
    { key: 'earlier', title: '更早', sessions: [] },
  ];

  for (const s of sessions) {
    const t = new Date(s.lastActiveAt);
    if (t >= todayStart) buckets[0].sessions.push(s);
    else if (t >= yesterdayStart) buckets[1].sessions.push(s);
    else if (t >= weekStart) buckets[2].sessions.push(s);
    else buckets[3].sessions.push(s);
  }

  return buckets
    .filter(b => b.sessions.length > 0) // hide empty time columns
    .map(b => ({ ...b, sessions: sortByLastActive(b.sessions) }));
}

export const BoardView = memo(function BoardView({
  sessions,
  groupBy,
  activeSidecarSessionIds,
  sessionTagsMap,
  onSessionClick,
}: BoardViewProps) {
  // Compute status for all sessions
  const statusMap = useMemo(() => {
    const map = new Map<string, SessionStatus>();
    for (const s of sessions) {
      map.set(s.id, computeSessionStatus(s, activeSidecarSessionIds));
    }
    return map;
  }, [sessions, activeSidecarSessionIds]);

  // Build columns based on groupBy mode
  const columns = useMemo((): ColumnDef[] => {
    switch (groupBy) {
      case 'workspace':
        return groupByWorkspace(sessions);
      case 'status':
        return groupByStatus(sessions, statusMap);
      case 'time':
        return groupByTime(sessions);
    }
  }, [sessions, groupBy, statusMap]);

  const showWorkspace = groupBy !== 'workspace';

  return (
    <div className="flex-1 flex gap-3 p-4 overflow-x-auto min-h-0 bg-[var(--surface)]">
      {columns.map(col => (
        <BoardColumn
          key={col.key}
          title={col.title}
          sessions={col.sessions}
          statusMap={statusMap}
          tagsMap={sessionTagsMap}
          showWorkspace={showWorkspace}
          statusDot={col.statusDot}
          onSessionClick={onSessionClick}
        />
      ))}
    </div>
  );
});
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/taskCenter/BoardView.tsx
git commit -m "feat(ui): add BoardView component with workspace/status/time grouping"
```

---

### Task 8: Extend useTaskCenterData with Active Sidecar Polling

**Files:**
- Modify: `src/renderer/hooks/useTaskCenterData.ts`

- [ ] **Step 1: Add activeSidecarSessionIds to the hook**

Extend the `TaskCenterData` interface with:
```typescript
  activeSidecarSessionIds: Set<string>;
```

Add a `pollingEnabled` parameter to the hook (default `true`) so the caller can disable polling when not in board view:

```typescript
export function useTaskCenterData(pollingEnabled = true): TaskCenterData {
```

Add state and polling logic inside the hook:

```typescript
const [activeSidecarSessionIds, setActiveSidecarSessionIds] = useState<Set<string>>(new Set());

// Poll active sidecars every 5 seconds (only when pollingEnabled)
// Note: cmd_list_running_sidecars returns [sidecar_id, agent_dir, port].
// sidecar_id IS the session_id because cmd_start_session_sidecar passes
// session_id as the instance key to start_sidecar().
useEffect(() => {
  if (!pollingEnabled) return;

  let interval: ReturnType<typeof setInterval> | null = null;

  const fetchActiveSidecars = async () => {
    try {
      const running: [string, string | null, number][] = await invoke('cmd_list_running_sidecars');
      const ids = new Set(running.map(([sidecarId]) => sidecarId));
      setActiveSidecarSessionIds(ids);
    } catch {
      // Ignore errors — sidecars might not be available
    }
  };

  fetchActiveSidecars(); // Initial fetch
  interval = setInterval(fetchActiveSidecars, 5000);

  return () => {
    if (interval) clearInterval(interval);
  };
}, [pollingEnabled]);
```

Make sure to add `import { invoke } from '@tauri-apps/api/core';` at the top if not already imported.

Return `activeSidecarSessionIds` from the hook.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useTaskCenterData.ts
git commit -m "feat(data): add active sidecar polling to useTaskCenterData hook"
```

---

### Task 9: Modify TaskCenterView — Add Toolbar and Board View

**Files:**
- Modify: `src/renderer/pages/TaskCenterView.tsx`

This is the largest task. It modifies the existing `TaskCenterView` to add:
1. View mode toggle (kanban/list)
2. Group mode segmented control
3. Conditional rendering of BoardView vs existing list
4. `lastViewedAt` update on session click

- [ ] **Step 1: Add view state, imports, and update hook destructuring**

At the top of `TaskCenterView.tsx`, add imports:

```typescript
import { BoardView, type GroupBy } from '@/components/taskCenter/BoardView';
import { LayoutGrid, List } from 'lucide-react';
```

Add state variables inside the component:

```typescript
const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
const [groupBy, setGroupBy] = useState<GroupBy>('workspace');
```

Update the `useTaskCenterData` destructuring to include `activeSidecarSessionIds` and pass `pollingEnabled`:

```typescript
const { sessions, scheduledTasks, cronSessionIds, sessionTagsMap, isLoading, refresh, activeSidecarSessionIds } =
  useTaskCenterData(viewMode === 'board');
```

- [ ] **Step 2: Add toolbar UI**

Replace the current filter bar area (the section with "最近任务" header + search + status/workspace filters) with a new toolbar that includes view switching AND the existing filters. The toolbar should be rendered above the main content area:

```tsx
{/* Toolbar */}
<div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
  <span className="text-[14px] font-semibold text-[var(--ink)] mr-1">任务中心</span>

  {/* View tabs */}
  <div className="flex border border-[var(--border)] rounded-lg overflow-hidden">
    <button
      className={`px-3.5 py-1.5 text-[12px] transition-colors ${
        viewMode === 'board'
          ? 'bg-[var(--accent)] text-white font-medium'
          : 'text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
      }`}
      onClick={() => setViewMode('board')}
    >
      <LayoutGrid size={14} className="inline mr-1" />
      看板
    </button>
    <button
      className={`px-3.5 py-1.5 text-[12px] border-l border-[var(--border)] transition-colors ${
        viewMode === 'list'
          ? 'bg-[var(--accent)] text-white font-medium'
          : 'text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
      }`}
      onClick={() => setViewMode('list')}
    >
      <List size={14} className="inline mr-1" />
      列表
    </button>
  </div>

  {/* Separator */}
  <div className="w-px h-5 bg-[var(--border)]" />

  {/* Group segment control — only in board mode */}
  {viewMode === 'board' && (
    <div className="flex border border-[var(--border)] rounded-lg overflow-hidden">
      {(['workspace', 'status', 'time'] as const).map((g, i) => (
        <button
          key={g}
          className={`px-3 py-1.5 text-[12px] transition-colors ${
            i > 0 ? 'border-l border-[var(--border)]' : ''
          } ${
            groupBy === g
              ? 'bg-[var(--surface)] text-[var(--ink)] font-medium'
              : 'text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
          }`}
          onClick={() => setGroupBy(g)}
        >
          {{ workspace: '工作区', status: '状态', time: '时间' }[g]}
        </button>
      ))}
    </div>
  )}

  {/* Search (pushed to right) */}
  {/* Reuse existing search input, move to ml-auto position */}
</div>
```

- [ ] **Step 3: Conditional rendering — Board vs List**

Below the toolbar, conditionally render:

```tsx
{viewMode === 'board' && !isSearching ? (
  <BoardView
    sessions={filteredSessions}
    groupBy={groupBy}
    activeSidecarSessionIds={activeSidecarSessionIds}
    sessionTagsMap={sessionTagsMap}
    onSessionClick={handleSessionClick}
  />
) : (
  /* Existing list view JSX — keep as-is */
)}
```

Add a `handleSessionClick` handler that works for both board and list views. The existing list view's click handler calls `onNavigateToSession(session.agentDir, session.id)` — wrap it:

```typescript
const handleSessionClick = async (agentDir: string, sessionId: string) => {
  // Mark as viewed (fire-and-forget)
  globalApiPutJson(`/chat/sessions/${sessionId}/viewed`, {}).catch(() => {});
  // Navigate to session
  onNavigateToSession(agentDir, sessionId);
};
```

Update the existing list view's `onClick` to use this handler too:
```tsx
onClick={() => handleSessionClick(session.agentDir, session.id)}
```

- [ ] **Step 4: Remove right-side scheduled tasks panel**

The current layout has a right column for scheduled tasks (300px). In the kanban redesign, this panel is removed. The scheduled tasks panel is accessible via the left sidebar "定时任务" menu item.

Remove the right-side `<div>` that renders the scheduled tasks quick list (the section with "定时任务" header, "+ 新建定时任务" button, and the sorted task items). Keep the `ScheduledTaskContext` imports as they may still be used elsewhere.

- [ ] **Step 5: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pages/TaskCenterView.tsx
git commit -m "feat(ui): add kanban board view to task center with view/group switching"
```

---

### Task 10: Integration — Mark Viewed on Session Open

**Files:**
- Modify: `src/renderer/pages/TaskCenterView.tsx` (if not already done in Task 9)
- Modify: `src/renderer/context/TabProvider.tsx` (to update lastViewedAt when receiving assistant message in open tab)

- [ ] **Step 1: Update lastViewedAt when assistant message completes in open session**

In `src/renderer/context/TabProvider.tsx`, find the `sse.on('chat:message-complete', ...)` handler (line ~377). This fires when an assistant turn finishes. At the end of this handler (after `setIsRunning(false)` around line ~436), add:

```typescript
// Mark session as viewed so it doesn't show "Approval" in task center
const sid = sessionIdRef.current;
const url = serverUrlRef.current;
if (sid && url) {
  apiPutJson(url, `/chat/sessions/${sid}/viewed`, {}).catch(() => {});
}
```

Use `apiPutJson` (the sidecar-scoped version) since `TabProvider` already uses it. The `sessionIdRef` and `serverUrlRef` are already available in this scope.

This ensures that if the user is watching the session when the assistant replies, `lastViewedAt` is updated so it doesn't show as "Approval" when they go back to the task center.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(session): auto-update lastViewedAt when viewing assistant replies"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Full typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS with no errors

- [ ] **Step 2: Manual testing checklist**

Start the app with `npm run tauri:dev` and verify:

1. Task center opens in kanban mode by default
2. Workspace grouping shows one column per workspace
3. Click "状态" → switches to 4 fixed columns (Active/Approval/Inactive/Archived)
4. Click "时间" → switches to time-based columns (今天/昨天/本周/更早)
5. Click "列表" → switches back to existing list view
6. Session cards show status dot, title, time, message count
7. Cards with cron tags show "定时" badge
8. Clicking a card navigates to the session
9. After navigating back, the card's blue dot (Approval) is gone
10. Active sessions show green dot
11. Horizontal scrolling works when many columns exist
12. Search works and hides kanban during search
13. Right-side scheduled task panel is removed
14. Scheduled tasks accessible via left sidebar

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(kanban): address issues found during manual testing"
```
