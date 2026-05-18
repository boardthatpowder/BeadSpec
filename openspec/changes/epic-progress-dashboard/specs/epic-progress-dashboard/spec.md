## ADDED Requirements

### Requirement: Epic Dashboard pane for each imported OpenSpec change
The app SHALL provide a per-change Epic Dashboard pane that aggregates, for a single OpenSpec change whose Beads epic has been imported, the live ready-task count, blocker chain, per-task status list with claim and paused indicators, validation status, and links to the change's `proposal.md`, `design.md`, and `tasks.md`. The pane SHALL be opened by clicking a `ChangeCard`'s body and SHALL render in the active workspace pane as a tab of kind `epic`. Inner controls on the change card SHALL NOT trigger the dashboard.

#### Scenario: Open dashboard from change card
- **WHEN** the user clicks a `ChangeCard`'s body for a change whose Beads epic has been imported (i.e., `ChangeBeadsProgress.epic_id` is non-null)
- **THEN** the workspace opens a new tab of kind `epic` in the active pane
- **AND** the tab is titled `${change-slug} · dashboard`
- **AND** the tab pane renders the Epic Dashboard for that change's epic

#### Scenario: Card body click is suppressed for changes without an imported epic
- **WHEN** the user clicks the body of a `ChangeCard` whose change has no imported Beads epic
- **THEN** no tab is opened
- **AND** the cursor remains the default cursor on hover

#### Scenario: Inner card affordances do not open the dashboard
- **WHEN** the user clicks an artifact link, the `imported → EPIC-ID` pill, the status pill, or a dependency chip on a `ChangeCard`
- **THEN** the existing behaviour of that inner control is invoked
- **AND** the Epic Dashboard tab is NOT opened

#### Scenario: Live ready-task count via bd CLI
- **WHEN** the dashboard mounts and the `bd` CLI is available on `PATH`
- **THEN** the backend runs `bd ready --mol <epic-id> --json` and the dashboard header shows `${ready.length} ready` and `${total_in_progress} in progress`
- **AND** a small caption reads `via bd`

#### Scenario: Dolt-direct fallback when bd CLI is unavailable
- **WHEN** the dashboard mounts and `bd ready --mol` fails (missing binary, non-zero exit, unparseable JSON)
- **THEN** the backend computes ready and in-progress counts directly from the Dolt schema for the epic's children
- **AND** the dashboard caption reads `via dolt`
- **AND** the visible counts are equivalent to the bd-derived counts for the same data

#### Scenario: Blocker chain points to the next thing to unblock
- **WHEN** at least one child task is open or blocked and has unresolved depth-1 upstream dependencies
- **THEN** the dashboard renders `Currently blocked by: ${blocker chain}` for the highest-priority non-ready child task sorted by `priority ASC, created_at ASC`
- **AND** a "View full graph →" link opens the dependency-graph tab on the epic in `TaskDetailPanel`

#### Scenario: Per-task list groups children by status
- **WHEN** the epic has children of varying statuses
- **THEN** the dashboard renders groups in order `Ready`, `In progress`, `Blocked`, `Open (not ready)`, `Closed`
- **AND** each non-empty group shows the count next to the header
- **AND** empty groups are not rendered

#### Scenario: Claim a ready task from the dashboard
- **WHEN** the user clicks the "Claim" button on a row whose task status is `open` and that has no current assignee
- **THEN** the backend runs `bd update <task-id> --claim`
- **AND** on success the row moves to the "In progress" group within one `allTasks` cache refresh cycle
- **AND** on failure an inline error appears on the row with a retry affordance

#### Scenario: Paused task indicator with scope-change link
- **WHEN** a child task's latest note matches the prefix pattern `^Paused\s*[:\-]?\s*` and the note body contains a `bd-<digits>` identifier
- **THEN** the dashboard row shows an amber "Paused" chip
- **AND** clicking the chip opens that referenced scope-change issue as a task tab via `setState({ view: 'all', taskId: <matched-id> })`

#### Scenario: Paused task indicator without explicit scope-change reference
- **WHEN** a child task's latest note matches the paused prefix but contains no `bd-<digits>` identifier
- **THEN** the dashboard row still shows the amber "Paused" chip
- **AND** the chip is non-interactive (no click target)

#### Scenario: Validation status pill reflects latest openspec validate result
- **WHEN** the dashboard mounts
- **THEN** the validation pill state begins as `idle` until clicked or until a previous in-session run has populated it
- **WHEN** the user clicks the validation pill
- **THEN** the backend runs `openspec validate <change-slug>` via the existing `runOpenspecValidate` IPC
- **AND** the pill transitions to `running`, then `pass` or `fail` with a last-run-age caption rendered via the existing `relativeTime` helper
- **AND** on `fail` the pill expands to show the raw validator output

#### Scenario: Artifact links reuse existing doc-tab behaviour
- **WHEN** the user clicks `proposal.md`, `design.md`, or `tasks.md` in the dashboard header
- **THEN** the corresponding artifact opens as a `doc` tab via `openDocTab(change, '<artifact>')`
- **AND** the dashboard tab remains open and active in its pane

#### Scenario: Dashboard refreshes when the Beads cache changes
- **WHEN** a `dolt_log`-driven Tauri event invalidates the `allTasks` cache while a dashboard is open
- **THEN** the dashboard re-runs `get_epic_ready_snapshot` for its epic
- **AND** the per-task list, blocker chain, and counts re-render with the new data without user action

#### Scenario: Empty epic
- **WHEN** the dashboard opens for an epic that has no children
- **THEN** the dashboard renders an empty-state message "No tasks imported yet. Run `openspec-beads-import`."
- **AND** the validation pill and artifact links remain functional

#### Scenario: Snapshot fetch error
- **WHEN** both `bd ready --mol` and the Dolt-fallback query fail
- **THEN** the dashboard renders an inline error row with a "Retry" button
- **AND** the per-task list, validation pill, and artifact links continue to function using data already available from `allTasks`
