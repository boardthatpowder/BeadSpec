## Context

`ChangesBrowser` renders a flex-wrapped grid of `ChangeCard`s. Each card today shows: title, status pill, progress bars (proposal + Beads), artifact links, an `imported → EPIC-ID` pill, and the new "Blocked by / Blocking" chip rows from change `changes-browser-dep-chips`. The card body itself is non-interactive — clicking empty space does nothing.

The workspace already supports multi-tab panes with two existing tab kinds: `task` (a Beads issue rendered by `TaskDetailPanel`) and `doc` (an OpenSpec artifact rendered by `OpenSpecDocPanel`). Tab kinds are a discriminated union in `src/utils/paneTree.ts` and dispatched in `src/components/workspace/LeafPane.tsx`. The store exposes `openDocTab(change, artifact)` as the canonical way to open a doc tab.

`bd ready --mol <epic-id>` is the canonical CLI for "what's ready to claim under this epic", honoring dependency edges. The Dolt schema also exposes the data directly via the `issues`, `dependencies`, and `parent_children` tables. Issue notes with the prefix `Paused: <reason>` indicate a task paused by `openspec-beads-scope-change`; the same flow tags the issue with `openspec:paused` and creates a scope-change child issue whose ID is recorded in the note body. `runOpenspecValidate(projectPath, changeSlug)` already exists and returns `{ ok, output }`.

## Goals / Non-Goals

**Goals:**
- One-click path from a change card to a focused Epic Dashboard, opened as a tab in the active pane (mirroring `openDocTab`).
- Live ready-task count and blocker chain backed by `bd ready --mol`, with a Dolt-direct fallback so the feature stays functional if `bd` is missing.
- Per-task list reuses existing task-row visual language (status pill, label chips) and adds two new affordances: a "Claim" button calling `bd update <id> --claim`, and a "Paused" pill linking to the scope-change child when the latest note prefix is `Paused:`.
- Validation pill uses the already-shipped `runOpenspecValidate` IPC; surfaces last-run age (`just now` / `2m ago`).
- Artifact tab links reuse `openDocTab` — no duplication.
- New tab kind `epic` integrates with split, drag, pin, close, and persistence pipelines without bespoke handling.

**Non-Goals:**
- No streaming / websocket data. We piggyback on the existing `useTasks` cache-invalidation pulse driven by `dolt_log` polling.
- No multi-level blocker traversal. Blocker chain is depth-1 upstream of the highest-priority non-ready task. A link to the existing dependency-graph tab covers the rest.
- No persistent validation history (handled by the separate `openspec-validation-history` change).
- No batch / multi-select claim action.
- No editing of the `Paused:` reason text from the dashboard.
- No new visual chrome — palette and chip styles match existing `TaskListItem` and `ChangeCard` patterns.

## Decisions

### 1. Tab kind: extend `paneTree.ts` rather than overloading `doc`

Add an `EpicTab { kind: 'epic'; id: string; change: string; epicId: string }` variant alongside `TaskTab` and `DocTab`. `id` is formed by a helper `epicTabId(change) → 'epic:<change-slug>'`. `change` is the change slug, `epicId` is the Beads issue ID resolved at open time.

**Alternative considered:** reuse the `doc` kind with an artifact value of `__dashboard__`. Rejected because (a) doc tabs assume a real file in `OpenSpecDocPanel`, (b) future epic-tab features (like the validation pill auto-refresh) belong to a distinct kind, (c) discriminated unions are the project's stated pattern.

`LeafPane.tsx` switches on `tab.kind` and renders `<EpicDashboard change={tab.change} epicId={tab.epicId} />` for `epic` tabs. `useTabTitles` extends to label the tab as `<change-slug> · dashboard`.

### 2. Open trigger: click on card body, stop-propagation on inner controls

Make the `ChangeCard` root element a `<button>` (or a `div` with `role="button"` and `tabIndex={0}`) whose `onClick` calls `openEpicTab(change.name, beadsProgress.epic_id)` *only when `beadsProgress.epic_id` is non-null*. All existing inner clickable elements — `ArtifactLink`, the `imported → EPIC-ID` pill, the status pill (if/when interactive), and the new dependency chips from `changes-browser-dep-chips` — call `e.stopPropagation()` in their handlers.

When the card has no imported epic, the body click is a no-op and the cursor stays `default`. A tooltip on hover reads "Import to Beads to enable dashboard".

**Alternative considered:** add an explicit "Open dashboard" button to the card footer. Rejected because the card already has dense affordances; the brief says "clicked outside its existing affordances" and a whole-card click target is the principled minimum-chrome answer.

### 3. Backend: shell out first, Dolt-direct as fallback

`get_epic_ready_snapshot(project_path, epic_id)` first runs `bd ready --mol <epic_id> --json` with cwd = project_path. On success, parse the JSON into `EpicReadySnapshot { ready: Vec<String>, blocked: Vec<BlockerLink>, paused_task_ids: Vec<String>, total_open: u32, total_in_progress: u32, source: SnapshotSource::BdCli }`. On non-zero exit or missing binary, fall back to a SQL query that:
1. Pulls all child issue IDs of the epic from `parent_children`.
2. Joins to `issues` for status, type, and `closed_at`.
3. Joins to `dependencies` to compute "blockers per child" — a child is "ready" iff its status is `open` AND it has zero unresolved blockers among the epic's child set.
4. Returns the same `EpicReadySnapshot` shape with `source: SnapshotSource::Dolt`.

The frontend surfaces `source` as a small caption ("snapshot via bd" / "snapshot via dolt") so a user debugging missing `bd` understands which path produced the numbers.

**Alternative considered:** Dolt-direct only. Rejected because `bd ready --mol` already encodes the canonical "ready" logic; we'd be re-implementing it and risk drift. CLI-first with SQL fallback gives correctness today and resilience tomorrow.

**Alternative considered:** call `bd` from the frontend via shellExec. Rejected because the project already standardises on Tauri commands for any external work.

### 4. Blocker chain: depth-1 upstream of the highest-priority non-ready task

Compute the first non-ready child (status `open`, `blocked`, or `in_progress`) sorted by `priority ASC, created_at ASC`, and return its direct upstream dependencies as `BlockerLink { blocker_id, blocker_title, blocker_status }`. The dashboard renders this as a horizontal chain (e.g., `bd-37 → bd-42 → bd-51`). A trailing "View full graph →" link opens `TaskDetailPanel` on the epic with the dependency-graph tab pre-selected (existing nav contract).

Depth-1 is enough to answer "what should I unblock first?" without re-implementing the dependency-graph view.

### 5. Per-task list: group by status, claim button, paused indicator

The dashboard pulls all child issues by `parent_children.parent_id = epic_id` from the existing `allTasks` cache (no extra IPC). Groups: `Ready` (from snapshot.ready), `In progress`, `Blocked`, `Open (not ready)`, `Closed`. Each row uses the existing `TaskListItem` visual vocabulary (status pill, label chips, title) plus:
- **Claim button** — visible on rows where the issue is `open` and unclaimed. Calls a new IPC `claimTask(projectPath, taskId)` which shells out to `bd update <id> --claim`. Disabled and shows "Claim" spinner during the call.
- **Paused indicator** — when the issue's latest note (read from the existing notes accessor in `TaskDetailPanel`'s data path; if not in `allTasks` we add a `latest_note_prefix` field to the snapshot DTO) begins with `Paused:`, render an amber "Paused" chip. If the note body contains `bd-<digits>`, the chip links to that scope-change child issue (opens a task tab); otherwise the chip is non-interactive.

`claimTask` is added rather than reusing existing write IPCs because no current IPC matches the `bd update --claim` contract exactly. It returns the updated `Task` so the cache can be patched optimistically.

### 6. Validation pill: latest-only, calls existing IPC

Reuse `runOpenspecValidate(projectPath, changeSlug)`. State machine: `idle | running | pass | fail`. Show last-run age via `Date.now() - lastRunTs` rendered as `just now / Nm ago / Nh ago` using the existing `relativeTime` helper in `ChangeCard.tsx`. Clicking the pill re-runs validation. On fail, expanding the pill shows the raw output in a collapsible code block (re-uses `<pre>` styling from `OpenSpecPanel`).

Persistent history (`type:validate-history` in Ruflo memory) is explicitly deferred to `openspec-validation-history`.

### 7. Artifact tabs: re-use `openDocTab`

Three buttons — `proposal.md`, `design.md`, `tasks.md` — each calling `openDocTab(change.name, '<artifact>')`. Same nav contract as `ArtifactLink` in `ChangeCard.tsx`. The dashboard tab does NOT close on artifact open; users routinely jump between dashboard and artifacts.

### 8. Refresh model: piggyback on `allTasks` and provide a manual refresh

The dashboard re-runs `getEpicReadySnapshot` when:
- The tab mounts.
- `allTasks` reference changes (existing TanStack-driven invalidation cascade triggered by `dolt_log` polling).
- The user clicks the manual refresh icon in the dashboard header.

This avoids a new polling loop and aligns with the project's "real-time signal: `dolt_log()` polls every 2s → Tauri events → TanStack Query invalidation" invariant.

### 9. UI design direction

- **Register**: `product`. Implementers use `impeccable craft` (product register), not the brand register.
- **Aesthetic**: minimalist-utility. Reuse `LABEL_CHIP_COLORS` from `src/components/task-list/TaskListItem.tsx`, the neutral palette of `ChangeCard`, and existing button/pill spacing. No card-shadow inflation, no animated splashes.
- **Anti-references**: no novelty chrome, no kpi-dashboard-stock gradient bars, no oversized hero numbers, no animated count-ups.
- **Skills used at implementation time**:
  - `impeccable craft` — draft `EpicDashboard.tsx`, `EpicTaskRow.tsx`, `EpicValidationPill.tsx`.
  - `impeccable audit` — review the diff against existing `ChangeCard.tsx` and `TaskListItem.tsx` so the new surface stays visually consistent.
  - `minimalist-ui` — reference when condensing the per-task list grouping.

ASCII mockup of the dashboard pane (the new surface):

```
┌── epic-progress-dashboard · dashboard ──────────────[refresh][x]┐
│ Epic: bd-117  •  3 ready  •  2 in progress  •  via bd          │
│ Validation: pass  •  2m ago                       [proposal] [design] [tasks]
│                                                                │
│ Currently blocked by:  bd-37 → bd-42       View full graph →   │
│                                                                │
│ Ready (3)                                                      │
│   bd-43 · Wire EpicDashboard into LeafPane           [Claim]   │
│   bd-44 · Add EpicTab to paneTree                    [Claim]   │
│   bd-46 · Add get_epic_ready_snapshot command        [Claim]   │
│                                                                │
│ In progress (2)                                                │
│   bd-41 · Backend snapshot fallback           Paused → bd-48   │
│   bd-45 · Frontend wiring                                      │
│                                                                │
│ Blocked (1)                                                    │
│   bd-50 · Bindings regen                                       │
└────────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

- **`bd ready --mol` schema drift** → If the JSON shape changes, the parser breaks. **Mitigation:** type the JSON struct as `#[serde(default)]`-friendly with `#[serde(deny_unknown_fields = false)]`; treat parse errors as a fallback trigger to the Dolt path.
- **Claim race** → Two windows on the same epic could try to claim the same task. `bd update --claim` is already atomic and idempotent on the database side; the loser sees an error and the row refreshes on next `allTasks` tick. We surface the error inline on the row.
- **Paused-note detection cost** → Inspecting every child issue's latest note isn't free. **Mitigation:** the snapshot DTO carries `paused_task_ids: Vec<String>` computed in Rust via a single `notes` query restricted to children of the epic; the frontend only does the link-extraction parse on those marked entries.
- **No imported epic** → Many changes have not been imported yet. The card body click is gated on `beadsProgress.epic_id`; without it, the click is a no-op and the cursor stays default. The new `epic` tab kind is never opened for an unimported change.
- **Tab persistence** → `workspacePersist.ts` round-trips `TabId` shapes. The new variant must be added to the persistence serialiser, otherwise restored sessions silently drop epic tabs. **Mitigation:** explicit serialiser test in the tasks list.
- **Click target collision** → Making the whole card a click target risks accidental opens when users meant to select text. **Mitigation:** use `onClick` not `onMouseDown`; respect `e.defaultPrevented`; inner interactive elements always call `stopPropagation`. Add a `cursor-pointer` only when `beadsProgress.epic_id` is non-null.
- **`Paused:` parser brittleness** → A user may write `Paused due to X` instead of `Paused: X`. **Mitigation:** match on `/^Paused\s*[:\-]?\s*/` and let the rendering degrade to "Paused" without a scope-change link if no `bd-<digits>` is found.
