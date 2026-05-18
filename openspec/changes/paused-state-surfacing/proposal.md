## Why

The `openspec-beads-scope-change` skill pauses a Beads issue mid-implementation by appending a `Paused: <reason>` line to the issue's notes and applying the `openspec:paused` label. This records that a spec gap was discovered and work cannot continue until a scope-change child issue is resolved. Today, paused issues are visually identical to normal open issues: the KPI bar does not count them separately, the task list shows the same status badge, and the pause reason is buried in the notes blob. The consequence is fragile resumption — a new session may claim a "ready" issue without realising it is paused, or may not know why it was paused or which scope-change child resolves it.

## What Changes

- `TaskListItem` SHALL render a distinct **⏸ paused** violet pill in place of the regular status badge whenever an issue carries the `openspec:paused` label. The status dot (colour-coded by Beads status) SHALL be preserved so the underlying status remains scannable.
- `KpiBar` SHALL render a **⏸ N Paused** counter chip after the Closed chip, showing the count of tasks labelled `openspec:paused`. The chip SHALL be hidden when no tasks carry the label AND no paused filter is active. Clicking it SHALL toggle `openspec:paused` in the `labels` filter dimension.
- `OpenSpecPanel`'s body SHALL render a **Paused banner** above the drift warning whenever the active task carries `openspec:paused`. The banner SHALL display the most recent `Paused: <reason>` line parsed from `task.notes`, and — if a scope-change child issue can be detected — a clickable `Resolves: <id> — <title>` link that navigates to that child.
- Scope-change child detection uses two signals in priority order: (a) a sibling issue whose notes contain a line `Resolves: <paused-id>`; (b) among sibling issues sharing the same `openspec:<change>` label, the most recently created issue whose Beads `blocks` dependency points at `<paused-id>`. If neither resolves, the banner renders the reason only with a muted "No scope-change child detected yet" note.

Non-goals (explicit):
- No write path — pausing and resuming remain skill commands (`openspec-beads-scope-change`, `bd untag`).
- No auto-resume button — resumption stays explicit.
- No historical pause timeline or audit log of past pause events.
- No cross-window notifications or toast for newly paused issues.
- No Beads schema changes — `Task.notes` and `Task.labels` are already available via the existing `list_tasks` Tauri command.
- No update to the `openspec-beads-scope-change` skill itself — enforcing a canonical `Resolves:` note is a separate follow-up change.

## Capabilities

### New Capabilities
<!-- None — this change extends three existing capabilities. -->

### Modified Capabilities
- `task-list`: adds paused pill on `TaskListItem` and a Paused counter chip on `KpiBar`.
- `openspec-panel`: adds a Paused banner sub-component inside `OpenSpecPanelBody`.
- `smart-views`: registers `openspec:paused` as a recognised label-filter value integrated with the KPI bar.

## Impact

- **Frontend-only** — no new Tauri command, no Rust change, no Dolt schema change.
- **New helpers** in `src/lib/`: `parsePausedNote(notes: string | null): string | null` and `findScopeChangeChild(currentTask, allTasks, dependencies): Task | null`. Both are pure functions with Vitest unit tests.
- **Modified components**: `TaskListItem.tsx` (new pill constant + render branch), `KpiBar.tsx` (new chip after status map), `OpenSpecPanel.tsx` (new `<PausedBanner>` sub-component inserted as first child of `OpenSpecPanelBody`).
- **Data threading**: `Task.notes` must be confirmed available on the props chain reaching `OpenSpecPanel`; if it is not already selected by the TanStack Query selector, a selector update is required (no Rust change needed — the `notes` column is already returned by the existing `list_tasks` command).
