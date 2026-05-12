## Why

`ReadyToStartView` tells users which tasks they can start, but not why a task just became available. Without dependency lineage, users cannot tell whether a newly-unblocked task is urgent (it was the last thing blocking a release) or routine. They must mentally cross-reference task IDs to reconstruct the dependency chain—work that the UI already has the data to do.

## What Changes

- **New React hook** `useDependencyLineage` that batch-fetches `TaskDetail` for each visible ready task and extracts `dependencies[]` (recently-closed blockers) and `dependents[]` (tasks this one will unblock) into a typed lineage map.
- **`ReadyToStartView.tsx`** gains a lineage row per task item:
  - "Unblocked by:" chip row — one chip per recently-closed blocking dependency (shows task ID + title truncated to 24 chars).
  - "Unblocks: N tasks" — collapsed count that expands inline to show dependent task chips.
  - Tasks with no dependencies and no dependents show no lineage row.
- **Chip navigation** — each chip calls the existing task-selection navigation pattern to open that task in the detail pane.
- **Performance** — lineage is fetched only for tasks visible in the viewport via an IntersectionObserver callback; off-screen tasks are skipped until scrolled into view.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `smart-views`: `ReadyToStartView` now displays inline dependency lineage (unblocked-by chips, unblocks count/expand) for each ready task. Only tasks with dependencies or dependents show the lineage row.

## Impact

- **New file**: `src/hooks/useDependencyLineage.ts` — batch-fetches task details for visible ready tasks; returns a `Record<string, { unblockedBy: TaskSummary[], unblocks: TaskSummary[] }>` map.
- **Modified file**: `src/components/smart-views/ReadyToStartView.tsx` — integrates `useDependencyLineage`, renders lineage row with unblocked-by chips and collapsible unblocks section.
- **No new Tauri commands required** — reuses the existing `get_task` IPC command via TanStack Query.
- **No new npm dependencies** required.

## Non-Goals

- Showing full multi-hop dependency chains (only direct dependencies/dependents are surfaced).
- Lineage in other views (Focus, task list) — scoped to `ReadyToStartView` only.
- Persisting expanded/collapsed state across sessions.
