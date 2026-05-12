## Why

As beads projects grow — especially multi-worktree OpenSpec initiatives — the flat task list becomes hard to navigate. Users scroll past dozens of unrelated issues to find work grouped by status, epic, or worktree. The `usability-initiative` design established that grouping is the foundational capability that the workspace-tag-auto-scope and openspec epic-rollup UX features both depend on. Without grouped sections, those UX affordances have nowhere to attach.

A flat list also makes it impossible to quickly gauge "how many tasks are still open in the `openspec:configurable-list-groupings` epic?" without manually filtering. Named collapsible sections with live count badges answer that question at a glance.

## What Changes

- **`GroupConfig` type** — discriminated union: `{ type: 'field'; field: 'status' | 'priority' | 'assignee' | 'task_type' }` | `{ type: 'label-prefix'; prefix: string }` | `null` (flat list, default)
- **`groupTasks(tasks, config)` transform** in `filterParser.ts` — pure JS function that returns `GroupedSection[]` where each section = `{ key: string; label: string; tasks: Task[] }`. No SQL changes.
- **`HashStateContext`** gains a `groupBy: string | null` field — serialized as `"field:status"`, `"label:openspec"`, etc. Defaults to `null`.
- **`layout.json` persistence** — `groupBy` value written to and read from the Tauri store so it survives hard refresh.
- **`TaskList.tsx` virtual list** — extended with mixed-item-type support. The virtual list items are a discriminated union `TaskRow | GroupHeader`. Section headers are rendered as distinct row types with their own estimated height.
- **`FilterBar.tsx`** gains a compact "Group by" dropdown next to the existing filter controls. Field options: None, Status, Priority, Assignee, Type. Below a divider: "By label prefix:" sub-menu listing prefixes derived from `useAllLabels()` split on the first colon.
- **Collapsible sections** — collapse state held in `useState<Set<string>>(new Set())` (collapsed group keys). State is local to `TaskList`, not URL-persisted (too ephemeral). Section header renders a count badge showing how many tasks are in the group, with a dim "(N hidden)" when collapsed.
- **Bulk selection across groups** — existing shift-click range selection operates on the flat flattened index of visible task rows. Tasks in collapsed sections are not included in the flat index; range selection cannot span a collapsed section boundary. Test coverage required.

## Non-Goals

- No server-side GROUP BY — grouping is a pure frontend transform.
- No drag-and-drop between groups in v1.
- No multi-level (nested) grouping in v1.
- No collapsing of group state to URL hash (too noisy; in-session state only).
- No aggregate badges beyond count in v1 (no SUM priority, no progress bar — that belongs to openspec-spec-panel).

## Capabilities

### New Capabilities

- `list-grouping`: group-by control on the task list, supports grouping by status, priority, assignee, task_type, or any label-prefix. Collapsible sections with count badge. Persists group-by choice in URL hash and Tauri layout store.

### Modified Capabilities

- `task-list`: grouped rendering changes the virtual list contract; mixed-item-type virtual list replaces the current homogeneous row virtualizer.
- `task-list`: bulk selection range must correctly compute flat indices across group headers.

## Impact

**Frontend only — no new Tauri commands.**

- `src/lib/filterParser.ts` — add `GroupConfig` type, `groupTasks()`, `serializeGroupConfig()`, `deserializeGroupConfig()`
- `src/hooks/useHashState.ts` — add `groupBy: string | null` to `AppHashState`
- `src/contexts/HashStateContext.tsx` — unchanged (types flow from `AppHashState`)
- `src/hooks/useTasks.ts` — re-export or integrate `groupBy` from hash state
- `src/components/task-list/TaskList.tsx` — mixed-item virtual list, section headers, collapse state
- `src/components/filters/FilterBar.tsx` — "Group by" dropdown
- `src/store/layoutStore.ts` (new or existing) — persist `groupBy` to Tauri store `layout.json`
