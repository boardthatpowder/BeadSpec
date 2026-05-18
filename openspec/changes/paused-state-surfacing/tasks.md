## 1. Helpers in `src/lib/`

- [x] 1.1 Create `src/lib/parsePausedNote.ts` exporting `parsePausedNote(notes: string | null): string | null` — scans lines for the last `/^Paused:\s*(.+)$/` match, returns the trimmed capture or `null`.
- [x] 1.2 Create `src/lib/findScopeChangeChild.ts` exporting `findScopeChangeChild(currentTask: Task, allTasks: Task[], blockingIds: string[]): Task | null` — checks Signal A (`Resolves:` note prefix) then Signal B (shared `openspec:<change>` label + `blocks` dependency).
- [x] 1.3 Add Vitest unit tests for `parsePausedNote`: null input, no match, single match, multi-match (last wins), trailing whitespace, lowercase `paused:` (no match), colon with no text (null).
- [x] 1.4 Add Vitest unit tests for `findScopeChangeChild`: Signal A present, Signal A absent + Signal B present, neither signal (null), multiple Signal B candidates (most recent wins), sibling with wrong `openspec:` label excluded.

## 2. `TaskListItem` paused pill

- [x] 2.1 Add `STATUS_BADGE_PAUSED` constant in `src/components/task-list/TaskListItem.tsx` with the `bg-violet-900/40 text-violet-300 border border-violet-800/40` palette.
- [x] 2.2 In the badge render path, add a branch: when `task.labels.includes('openspec:paused')`, render `STATUS_BADGE_PAUSED` with text `"⏸ paused"` and a `title` attribute set to the parsed pause reason; otherwise render the existing `STATUS_BADGE[task.status]` unchanged.
- [x] 2.3 Confirm the status dot (leading coloured circle) remains driven by `task.status` — no change to the dot logic.
- [x] 2.4 Add a render test (Vitest + React Testing Library or snapshot): task with `openspec:paused` label renders pause pill; task without the label renders normal badge; tooltip attribute matches parsed reason.

## 3. `KpiBar` Paused chip

- [x] 3.1 In `src/components/filters/KpiBar.tsx`, compute `pausedCount` as `allTasks.filter(t => t.labels.includes('openspec:paused')).length`.
- [x] 3.2 Render a thin divider and a `⏸ N Paused` chip after the `STATUS_CONFIG.map(...)` output, gated on `pausedCount > 0 || state.filters.labels?.includes('openspec:paused')`.
- [x] 3.3 Implement click handler: toggle `openspec:paused` in `state.filters.labels` (add if absent, remove if present); apply the same `ring-1 ring-violet-500` active treatment used by other chips.
- [x] 3.4 Add unit tests: zero paused + no active filter → chip hidden; non-zero paused → chip visible with count; filter active with zero paused → chip visible; click adds label to filter; second click removes label.

## 4. `OpenSpecPanel` Paused banner

- [x] 4.1 Add `<PausedBanner>` sub-component in `src/components/task-detail/OpenSpecPanel.tsx` (inline or extracted) that accepts `task: Task` and `scopeChangeChild: Task | null`.
- [x] 4.2 Render the banner as the first child of `OpenSpecPanelBody`, before `DriftWarning`, conditioned on `task.labels.includes('openspec:paused')`.
- [x] 4.3 Display the parsed reason from `parsePausedNote(task.notes)`, falling back to `"(no reason recorded)"` when null.
- [x] 4.4 When `scopeChangeChild` is non-null, render a `Resolves: <child.id> — <child.title>` button that calls `setState({ view: 'all', taskId: child.id })`.
- [x] 4.5 When `scopeChangeChild` is null, render a muted `"No scope-change child detected yet"` note.
- [x] 4.6 Add render tests: paused + reason + child → banner with reason + link; paused + no reason + child → fallback copy + link; paused + no child → muted note; not paused → no banner.

## 5. Wire `task.notes` and dependency data into the data flow

- [x] 5.1 Inspect the TanStack Query selector used by `useTasks` (or equivalent) and confirm `notes` is included on the `Task` type in `src/bindings.ts`; if the selector strips it, update the selector to retain `notes`.
- [x] 5.2 Confirm `Task.labels` is already an `string[]` field on the frontend `Task` type; if it is `string | null` or missing, update the selector / bindings mapping.
- [x] 5.3 In `OpenSpecPanel` (or its parent `TaskDetailPanel`), add a `useTaskBlockers(task.id)` call — either reusing the result of the existing `get_task_dependencies` query or adding a narrow hook — to supply `blockingIds` to `findScopeChangeChild`. No new Rust command required; `get_task_dependencies` already returns the dependency rows.

## 6. Verification

- [x] 6.1 `bun run typecheck` (`tsc --noEmit`) passes with no new errors.
- [x] 6.2 `bun test` passes — all new unit and render tests green.
- [x] 6.3 `bun run lint` passes — no new ESLint warnings.
- [x] 6.4 Manual smoke test: pause an issue via `openspec-beads-scope-change`, reload the UI, confirm (a) pause pill appears on the task row, (b) KPI bar shows `⏸ 1 Paused`, (c) opening the task's panel shows the banner with the reason. Resume the issue (`bd untag <id> openspec:paused`), confirm all three surfaces clear.
- [x] 6.5 Manual: create a scope-change child issue with `bd link <paused-id> <child-id>`, confirm the banner shows the `Resolves:` link and clicking it navigates to the child.
- [x] 6.6 `openspec validate paused-state-surfacing` PASS.
