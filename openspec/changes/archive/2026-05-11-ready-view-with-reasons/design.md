## Context

`ReadyToStartView` renders a list of tasks whose dependency chain is entirely closed. It already receives a `tasks: Task[]` prop (or fetches via `list_tasks` filtered to ready tasks). The existing `get_task` Tauri command returns `TaskDetail` which includes `dependencies: TaskSummary[]` and `dependents: TaskSummary[]` arrays. No new backend commands are needed.

## Goals / Non-Goals

**Goals:**
- Each visible ready-task row shows which recently-closed tasks unblocked it and how many tasks it will in turn unblock.
- Chips navigate to the referenced task in the detail pane.
- Lineage is only fetched for rows visible in the viewport.
- No noticeable latency on the ready-task list itself (lineage loads asynchronously per row).

**Non-Goals:**
- Multi-hop dependency traversal.
- Lineage display in any view other than `ReadyToStartView`.
- Server-side aggregation — all data comes from per-task `get_task` calls already cached by TanStack Query.

## Decisions

### Decision: Fetch strategy — per-task `get_task` via TanStack Query with intersection observer gating

Each ready task already has its `Task` (ID, title, status). To get `dependencies[]` and `dependents[]` we need `TaskDetail` per task. We reuse the existing `useQuery(['task', id], () => invoke('get_task', { id }))` pattern; TanStack Query deduplicates concurrent fetches and caches results.

**Why not extend `list_tasks` to include dependency IDs?** That would require a new Tauri command or schema change, adds payload size for all views, and couples a general-purpose command to a specific view's needs.

**Why not a single batch command?** No batch-fetch Tauri command exists today. Adding one would be a scope expansion. TanStack Query's parallel `useQueries` achieves equivalent concurrency with existing infrastructure.

### Decision: Intersection observer to gate lineage fetches

A ready-task list can have 50+ items. Fetching `TaskDetail` for all of them on mount would spike Dolt query load. We use an `IntersectionObserver` inside `useDependencyLineage` (or a `useInView` wrapper per row) to trigger the per-task query only when the row enters the viewport.

Implementation: Each `ReadyTaskRow` calls a `useLineageForTask(id, { enabled: inView })` hook where `inView` is tracked by a `ref` + `IntersectionObserver`. The hook is a thin `useQuery` wrapper that sets `enabled: inView`.

### Decision: "Unblocked by" shows all closed direct dependencies

`TaskDetail.dependencies` lists all direct dependencies regardless of status. We filter client-side to those with `status === 'closed'` before rendering unblocked-by chips. This is exactly the set of tasks that make this task "ready."

### Decision: "Unblocks" collapsed by default, expands inline

"Unblocks: N tasks" is a button. Clicking it toggles a `useState` and renders the dependent chips inline below the row without a modal or separate pane. State is local to the row component — no global state needed.

### Decision: Chip appearance and navigation

Chips reuse the existing `TaskChip` component pattern (if one exists) or a new `<TaskLinkChip id={id} title={title} />` that calls `useNavigateToTask()(id)` (the same navigation helper used in the dependency graph). Chips show `ID · Title (truncated)` inline.

## Data Flow

```
ReadyToStartView
  └─ for each Task in readyTasks:
       ReadyTaskRow (ref attached for IntersectionObserver)
         ├─ renders task title, priority, status as before
         └─ useLineageForTask(task.id, { enabled: inView })
              └─ useQuery(['task', task.id], get_task)
                   └─ on success: render lineage row
                        ├─ "Unblocked by:" [chip][chip]
                        └─ "Unblocks: N" [expand button → chips]
```

## Risks / Trade-offs

- **TanStack Query cache miss on first view** — First time a ready task is viewed, `get_task` is called. The Dolt query is fast (<10ms), but 10 concurrent calls on scroll could cause mild jank. Mitigation: stagger with intersection observer threshold (0.1) so calls don't all fire simultaneously.
- **Dependencies list includes non-closed deps** — The filter `status === 'closed'` is done client-side after fetching. If a dep has no status in the summary, treat as non-closed (defensive default).
- **`TaskDetail` schema** — Confirm that `dependencies` and `dependents` arrays in `TaskDetail` include at minimum `id`, `title`, and `status` fields. If only IDs are present, a second-level fetch per dep would be needed — but current Rust code includes full `TaskSummary` objects.

## Open Questions

- Does `TaskDetail.dependencies` always include `status`? Check `src-tauri/src/commands/project.rs` `get_task` handler and the `TaskDetail` struct definition during implementation.
- Is there an existing `TaskChip` or `TaskLinkChip` component to reuse? Check `src/components/` before creating a new one.
