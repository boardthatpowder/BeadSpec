## Why

The Changes browser shows per-change progress as a percentage and a tiny artifact-link row, but a change card is a dead-end past that. Implementers running the OpenSpec/Beads loop have to leave the Changes view, open `TaskDetailPanel` on the imported epic, drill into the dependency-graph tab, run `bd ready --mol <epic-id>` in a terminal, and re-cross-reference paused tasks by hand. Every signal the workflow already produces for an epic — ready-task parallelism, blocker chain, claim affordance, `Paused:` note, validation status, artifact docs — already exists; it's just not assembled in one place.

An Epic Dashboard pane, opened by clicking a `ChangeCard`'s body, collapses that workflow into a single in-app surface and slots into the existing pane tree so users can pin it, split it, and tab between it and the underlying artifacts.

## What Changes

- Clicking a `ChangeCard` outside its existing affordances (artifact links, "imported → EPIC-ID" pill, dependency chips, status pill) SHALL open an Epic Dashboard pane.
- The dashboard SHALL render: (a) a live ready-task count derived from a new `get_epic_ready_snapshot` IPC, (b) a "Currently blocked by" chain showing the upstream epic-task blockers for the first non-ready task, (c) a per-task list grouping epic children by status with a "Claim" action that calls `bd update <id> --claim`, (d) a "Paused" indicator on any task whose latest note begins with `Paused:`, linking to the scope-change child issue if one is referenced, (e) a validation status pill that calls the existing `runOpenspecValidate` and shows pass/fail/last-run-age, (f) tab links to `proposal.md`, `design.md`, and `tasks.md` that open via the existing `OpenSpecDocPanel`.
- A new Tauri command `get_epic_ready_snapshot(project_path, epic_id)` SHALL shell out to `bd ready --mol <epic_id> --json` and return a typed snapshot (ready task IDs, blocker chain, total open, total in-progress). Falls back to a direct Dolt query if the CLI is unavailable.
- A new workspace tab kind `epic` SHALL be added to `paneTree.ts` and registered in `LeafPane.tsx` so the dashboard participates in the existing tab/split/pin model.
- The change card's body becomes a click target; existing inner affordances (links, chips, pill) STOP propagation so they retain their current behaviour.

Non-goals (explicit):
- No write surface for editing tasks, dependencies, labels, or `Paused:` notes — only the claim action mutates Beads.
- No real-time live-tail of `bd ready --mol` output. Snapshot is refetched on focus and on `useTasks` cache invalidation.
- No validation history. The pill shows the latest result only; persistent history is a separate change (`openspec-validation-history`).
- No re-design of the dependency graph. Blocker chain is a flat upstream-only list at depth 1, with an "Open dependency graph" link.
- No batch claim or multi-select.

## Capabilities

### New Capabilities
- `epic-progress-dashboard`: a per-change Epic Dashboard pane that aggregates ready-task count, blocker chain, per-task claim/paused/status, validation status, and artifact navigation for a single OpenSpec change's imported Beads epic.

### Modified Capabilities
- `openspec-change-browser`: the change card body becomes a click target that opens the Epic Dashboard; existing inner affordances continue to handle their own clicks.
- `task-workspace`: a new tab kind `epic` is added to the pane-tree tab discriminator and rendered by `LeafPane`.

## Impact

- **Tauri command** (new): `get_epic_ready_snapshot` in `src-tauri/src/commands/bd_mol.rs`. Shells out to `bd ready --mol <epic_id> --json`. Result is wrapped in a typed `EpicReadySnapshot { ready: Vec<String>, blocked: Vec<BlockerLink>, total_open: u32, total_in_progress: u32, source: SnapshotSource }`. Falls back to a direct Dolt query (joins `issues`, `dependencies`, `parent_children`) if the CLI returns non-zero or the binary is missing.
- **Type bindings**: new `EpicReadySnapshot`, `BlockerLink`, and `SnapshotSource` types auto-generated via `specta` into `src/bindings.ts`.
- **Frontend IPC**: new `getEpicReadySnapshot(projectPath, epicId)` wrapper in `src/ipc.ts`.
- **React components**:
  - `src/components/changes-browser/ChangeCard.tsx` — body becomes a click target; inner controls call `stopPropagation`.
  - `src/components/changes-browser/ChangesBrowser.tsx` — passes the open-dashboard handler down.
  - `src/components/epic-dashboard/EpicDashboard.tsx` (new) — the pane itself.
  - `src/components/epic-dashboard/EpicTaskRow.tsx` (new) — per-task row with status pill, claim button, paused indicator.
  - `src/components/epic-dashboard/EpicValidationPill.tsx` (new) — wraps the existing `runOpenspecValidate` IPC with a last-run state.
- **Pane tree**:
  - `src/utils/paneTree.ts` — adds `EpicTab { kind: 'epic'; id: string; change: string; epicId: string }` and `epicTabId(change)` helper.
  - `src/stores/workspace.ts` — adds `openEpicTab(change, epicId)` action mirroring `openDocTab`.
  - `src/components/workspace/LeafPane.tsx` — registers the new tab kind and renders `<EpicDashboard>` for it.
- **No new persistence**. All state is derived from Beads + filesystem on demand.
- **Hook into existing real-time signal**: re-fetch `getEpicReadySnapshot` when `allTasks` changes, so `dolt_log` polling automatically refreshes the dashboard.
