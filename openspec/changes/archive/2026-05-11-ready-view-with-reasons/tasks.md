## 1. useDependencyLineage Hook

- [x] 1.1 Create `src/hooks/useDependencyLineage.ts` exporting `useLineageForTask(taskId: string, options: { enabled: boolean })` — a thin wrapper around `useQuery(['task', taskId], () => invoke<TaskDetail>('get_task', { id: taskId }), { enabled: options.enabled })` that returns `{ unblockedBy: TaskSummary[], unblocks: TaskSummary[], isLoading: boolean }`
- [x] 1.2 In the hook, filter `TaskDetail.dependencies` to those with `status === 'closed'` for the `unblockedBy` array; use `TaskDetail.dependents` as-is for `unblocks`
- [x] 1.3 Verify the `TaskDetail` Rust struct (in `src-tauri/src/commands/project.rs`) includes `dependencies` and `dependents` with at minimum `id`, `title`, and `status`; document any missing fields as a follow-up issue rather than blocking this task

## 2. ReadyToStartView — Lineage Row Rendering

- [x] 2.1 In `src/components/smart-views/ReadyToStartView.tsx`, extract each ready-task item into a `ReadyTaskRow` sub-component (or update an existing row component) that accepts a `taskId` prop
- [x] 2.2 Attach an `IntersectionObserver` ref to each `ReadyTaskRow` to track viewport visibility; pass `inView` boolean as the `enabled` option to `useLineageForTask`
- [x] 2.3 When `unblockedBy.length > 0`, render an "Unblocked by:" label followed by a row of `<TaskLinkChip>` components — one per closed dependency
- [x] 2.4 When `unblocks.length > 0`, render an "Unblocks: N tasks" button; clicking it toggles a `useState(false)` to expand/collapse a row of `<TaskLinkChip>` components for each dependent
- [x] 2.5 When both `unblockedBy` and `unblocks` are empty (or lineage not yet loaded), render no lineage row — the task row layout must be identical to the original

## 3. TaskLinkChip Component

- [x] 3.1 Check `src/components/` for an existing chip or task-link component that can be reused; if one exists, use it directly and skip 3.2
- [x] 3.2 If no suitable chip exists, create `src/components/common/TaskLinkChip.tsx` that renders `<button>` styled as a pill chip showing `{id} · {title truncated to 24 chars}` and calls `useNavigateToTask()(id)` on click (reuse whatever navigation helper the dependency graph or task list uses)
- [x] 3.3 Verify chip navigation opens the correct task in the detail pane using the existing navigation pattern (check how the dependency graph navigates to tasks)

## 4. Performance — Intersection Observer Gating

- [x] 4.1 Confirm that lineage queries are NOT fired for off-screen rows on initial mount — inspect TanStack Query devtools or add a temporary `console.log` in the query function during development
- [x] 4.2 Confirm that scrolling a row into view triggers its lineage fetch (verify the IntersectionObserver fires correctly on the row ref)
- [x] 4.3 Set `staleTime: 60_000` on lineage queries so repeated scrolling doesn't re-fetch within the same session

## 5. Manual Test

- [x] 5.1 Create a test scenario: task A depends on task B (closed) and task C (closed); task D depends on task A. Verify A appears in Ready to Start with "Unblocked by: B · C" chips and "Unblocks: 1 task" that expands to show D
- [x] 5.2 Verify clicking an "Unblocked by" chip opens the correct task detail
- [x] 5.3 Verify clicking "Unblocks: N tasks" expands the list, then collapses on second click
- [x] 5.4 Verify a task with no dependencies and no dependents shows no lineage row
- [x] 5.5 Verify that scrolling a long ready-task list does not cause noticeable lag (lineage loads after scroll, not before)

## 6. Validate & Close

- [x] 6.1 Run `openspec validate ready-view-with-reasons` and confirm all checks pass
- [x] 6.2 Run `bun run build` (or `bun run tauri build`) and confirm no TypeScript errors
- [x] 6.3 Close this change in beads: `bd close <epic-id>`
