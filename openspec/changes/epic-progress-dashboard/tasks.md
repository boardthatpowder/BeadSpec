## 1. Backend command & types

- [x] 1.1 Create `src-tauri/src/commands/bd_mol.rs` with structs `EpicReadySnapshot { ready: Vec<String>, blocked: Vec<BlockerLink>, paused_task_ids: Vec<String>, total_open: u32, total_in_progress: u32, source: SnapshotSource }`, `BlockerLink { blocker_id: String, blocker_title: String, blocker_status: String }`, and enum `SnapshotSource { BdCli, Dolt }`. All derive `serde::Serialize`, `serde::Deserialize`, `specta::Type`.
- [x] 1.2 Implement `get_epic_ready_snapshot(project_path: String, epic_id: String, registry: tauri::State<'_, ProjectRegistry>) -> Result<EpicReadySnapshot, String>` that:
  - Runs `bd ready --mol <epic_id> --json` with cwd = `project_path`.
  - Parses the JSON via a serde DTO; computes `paused_task_ids` separately by selecting child issues whose latest note matches `^Paused\s*[:\-]?\s*` (single SQL query joining `parent_children` → `issues` → `notes`).
  - On non-zero exit, missing binary, or parse failure, falls back to a Dolt-direct query that re-derives `ready` (status = `open` AND no unresolved blocker among epic children), `blocked` (depth-1 upstream of the highest-priority non-ready child sorted by `priority ASC, created_at ASC`), and the counts.
  - Sets `source` accordingly.
- [x] 1.3 Implement `claim_task(project_path: String, task_id: String) -> Result<Task, String>` in the same module that shells out `bd update <task_id> --claim` and on success re-reads the issue via the existing `read_task` helper.
- [x] 1.4 Register both new commands in `src-tauri/src/lib.rs` `tauri::generate_handler!` and `tauri_specta::collect_commands!`.
- [x] 1.5 Add `mod bd_mol;` to `src-tauri/src/commands/mod.rs` and re-export `get_epic_ready_snapshot`, `claim_task` alongside the existing `openspec::*` exports.

## 2. Backend tests

- [x] 2.1 Unit test the JSON parser for `bd ready --mol --json` against a captured-fixture string covering ready + blocked + empty cases.
- [x] 2.2 Unit test the Dolt-fallback ready-derivation against a seeded temp registry: epic with three children where one is blocked, one is in-progress, one is open with no deps.
- [x] 2.3 Unit test the `Paused` note-prefix detection with three notes (`Paused: foo` → match, `Paused - bar bd-99` → match + extracts `bd-99`, `Was paused yesterday` → no match).
- [x] 2.4 Unit test the source-fallback contract: when the CLI subprocess returns non-zero, `source == SnapshotSource::Dolt` and the result is non-empty for a known-seeded epic.
- [x] 2.5 Unit test `claim_task` against a seeded issue: claim sets `assignee` and returns the updated `Task`.

## 3. IPC + bindings

- [x] 3.1 Run `bun tauri build` (or the existing `specta` codegen script) to regenerate `src/bindings.ts` with `EpicReadySnapshot`, `BlockerLink`, `SnapshotSource`, and the two new commands.
- [x] 3.2 Add `getEpicReadySnapshot(projectPath, epicId): Promise<EpicReadySnapshot>` and `claimTask(projectPath, taskId): Promise<Task>` wrappers in `src/ipc.ts`, matching the existing style.

## 4. Pane-tree + workspace store wiring

- [x] 4.1 In `src/utils/paneTree.ts`, add `EpicTab { kind: 'epic'; id: string; change: string; epicId: string }` to the `TabId` union and export an `epicTabId(change: string): string` helper returning `epic:${change}`.
- [x] 4.2 In `src/stores/workspace.ts`, add `openEpicTab(change: string, epicId: string)` action mirroring `openDocTab` (focus-if-open semantics, otherwise append + pin in active pane).
- [x] 4.3 In `src/stores/workspacePersist.ts`, extend the rehydrator to round-trip the new `epic` variant. Drop unknown kinds rather than throwing.
- [x] 4.4 In `src/components/workspace/LeafPane.tsx`, dispatch on `tab.kind === 'epic'` and render `<EpicDashboard change={tab.change} epicId={tab.epicId} />`. Extend `useTabTitles` to label epic tabs as `${change} · dashboard`.
- [x] 4.5 Update `src/utils/paneTree.test.ts` to cover an `epic` tab in `findLeaf`, `replaceLeaf`, and `nextTabAfterClose`.
- [x] 4.6 Add a serialiser round-trip test in `src/stores/workspacePersist` (or its colocated test) for the `epic` variant.

## 5. EpicDashboard component

- [x] 5.1 Create `src/components/epic-dashboard/EpicDashboard.tsx` exporting `EpicDashboard({ change, epicId })`. Use TanStack Query keyed `['epicSnapshot', project, epicId]` calling `getEpicReadySnapshot`. Invalidate on `allTasks` change and on manual refresh.
- [x] 5.2 Render the header row: `Epic: ${epicId}  •  ${ready} ready  •  ${inProgress} in progress  •  via ${source}` (using a small caption for `source`). Right-aligned refresh icon.
- [x] 5.3 Render the validation row using a new `EpicValidationPill` component (see 5.5). To the right of the pill, render three `ArtifactLink`-style buttons that call `openDocTab(change, 'proposal.md' | 'design.md' | 'tasks.md')`.
- [x] 5.4 Render the blocker chain: `Currently blocked by: ${chain.join(' → ')}  View full graph →`. The "View full graph" link calls `setState({ view: 'all', taskId: epicId, taskTab: 'deps' })` (extending the existing `HashStateContext` taskTab param if needed; otherwise just `taskId: epicId`).
- [x] 5.5 Create `src/components/epic-dashboard/EpicValidationPill.tsx` that wraps `runOpenspecValidate`, holds `idle | running | pass | fail` + `lastRunTs`, renders age via the existing `relativeTime` helper, and expands the raw output on fail.
- [x] 5.6 Create `src/components/epic-dashboard/EpicTaskRow.tsx` rendering one task: status pill, title, label chips reusing `LABEL_CHIP_COLORS`. When `task.status === 'open'` and unclaimed, render a `Claim` button calling `claimTask`. When `task.id` is in `snapshot.paused_task_ids`, render an amber "Paused" chip; if the latest note body contains `/bd-(\d+)/`, the chip links to that issue via `setState({ view: 'all', taskId: matched })`.
- [x] 5.7 In `EpicDashboard.tsx`, group child issues (filtered from `allTasks` by `parent_children`) into `Ready`, `In progress`, `Blocked`, `Open (not ready)`, `Closed`. Render each group with a header showing the count; hide empty groups.
- [x] 5.8 Empty state: when `epicId` resolves but the epic has no children, render "No tasks imported yet. Run `openspec-beads-import`." with a copy-to-clipboard button.
- [x] 5.9 Error state: when `getEpicReadySnapshot` rejects, render an inline error row with a "Retry" button; the per-task list still renders from `allTasks`.

## 6. ChangeCard click target

- [x] 6.1 In `src/components/changes-browser/ChangeCard.tsx`, wrap the existing card body in a `<button>` (or `div role="button"`) whose `onClick` calls `openEpicTab(change.name, beadsProgress.epic_id)` only when `beadsProgress.epic_id` is non-null.
- [x] 6.2 Add `cursor-pointer` styling and an `aria-label="Open ${change.name} dashboard"` only when the click is enabled. When disabled, set a tooltip via the existing `<Tooltip>` wrapper: "Import to Beads to enable dashboard".
- [x] 6.3 Add `e.stopPropagation()` to every existing inner click handler in the card: `ArtifactLink.handleClick`, the `imported → EPIC-ID` pill, the status pill (if interactive), and the dependency chips added by `changes-browser-dep-chips`.
- [x] 6.4 In `src/components/changes-browser/ChangesBrowser.tsx`, no signature change is required (the card pulls `openEpicTab` from the workspace store directly), but add a wrapper unit test confirming a click on a stub `<ArtifactLink>` inside a `ChangeCard` does not trigger the open-dashboard handler.

## 7. Verification

- [x] 7.1 `cargo test -p beadspec_lib commands::bd_mol` passes.
- [x] 7.2 `bun tsc --noEmit` passes after bindings regeneration.
- [x] 7.3 `bun test src/components/epic-dashboard src/utils/paneTree.test.ts src/stores/workspacePersist` passes.
- [x] 7.4 Manual: `bun tauri dev`, click a `ChangeCard` whose change has an imported epic — Epic Dashboard pane opens in the active pane with `via bd` caption, ready count matches `bd ready --mol <epic> --json` output run from terminal.
- [x] 7.5 Manual: rename or `PATH`-hide the `bd` binary, refresh dashboard — pane re-renders with `via dolt` caption and identical ready set.
- [x] 7.6 Manual: pause a child task via `openspec-beads-scope-change`; refresh dashboard — that task shows the amber "Paused" chip linking to the scope-change child issue.
- [x] 7.7 Manual: click a ready task's "Claim" button — `bd update <id> --claim` runs, the task moves to "In progress" within one `allTasks` tick, no console errors.
- [x] 7.8 Manual: split the pane horizontally, drag the dashboard tab into the new leaf, reload the app — workspace persistence restores the dashboard tab in the same leaf.
- [x] 7.9 Manual: click the validation pill — runs `openspec validate <change-slug>`, shows pass/fail and the last-run age.
- [x] 7.10 `openspec validate epic-progress-dashboard` passes.
