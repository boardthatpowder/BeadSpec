## ADDED Requirements

### Requirement: Worker-finding detection from Beads notes

The system SHALL detect Beads issues filed by Ruflo background workers by matching the issue's notes against the anchored pattern `^Auto-filed by ruflo-(?P<worker>[a-z0-9-]+) on `. The captured `<worker>` token is the canonical worker identifier (e.g. `security-audit`, `test-gap-detector`, `cost-tracker`). The same pattern SHALL be implemented in both the Rust backend helper `parse_worker_from_notes` and the frontend helper `parseWorkerProvenance` so chip detection and dashboard listing always agree.

#### Scenario: Canonical worker-filed note matches
- **WHEN** an issue's notes begin with `Auto-filed by ruflo-security-audit on 2026-05-17T10:00Z. Branch: main`
- **THEN** the pattern matches
- **AND** the captured worker is `security-audit`

#### Scenario: Hyphenated worker name matches
- **WHEN** an issue's notes begin with `Auto-filed by ruflo-test-gap-detector on …`
- **THEN** the pattern matches
- **AND** the captured worker is `test-gap-detector`

#### Scenario: Non-canonical prefix does not match
- **WHEN** an issue's notes begin with `Filed by ruflo-security-audit on …` (missing the `Auto-` prefix)
- **THEN** the pattern does not match
- **AND** the issue is treated as a non-worker-filed issue

#### Scenario: Empty or missing notes
- **WHEN** an issue's notes are empty, null, or whitespace-only
- **THEN** the pattern does not match
- **AND** no worker-finding state is associated with the issue

### Requirement: list_worker_findings Tauri command

The system SHALL expose a Tauri command `list_worker_findings(project_path: string): Promise<WorkerFinding[]>` that returns every open or in-progress Beads issue whose notes match the worker-finding pattern. The command SHALL query the Dolt SQL pool directly (no `bd` CLI shellout) and parse the worker token in Rust. Returned findings SHALL be ordered by `created_at` descending.

#### Scenario: Project has at least one worker-filed open issue
- **WHEN** the command is invoked for a project with three matching open issues filed by two different workers
- **THEN** the response SHALL contain three `WorkerFinding` entries
- **AND** each entry's `worker` field SHALL be the parsed worker token
- **AND** entries SHALL be ordered by `created_at` descending

#### Scenario: Closed worker-filed issue is excluded
- **WHEN** a worker-filed issue has status `closed`
- **THEN** that issue SHALL NOT appear in the response

#### Scenario: Non-worker-filed issue is excluded
- **WHEN** an issue's notes do not match the worker-finding pattern
- **THEN** that issue SHALL NOT appear in the response

#### Scenario: Project not connected
- **WHEN** the command is invoked for a `project_path` with no active Dolt pool
- **THEN** the command SHALL return an error consistent with other openspec commands' `project_not_connected` behaviour

### Requirement: Worker Findings tab in BD Health Panel

The `BdHealthPanel` SHALL render a `Worker findings` tab that lists every finding returned by `list_worker_findings` for the active project, grouped by worker name. Each group SHALL show a header containing the worker name (rendered with the teal `worker:` chip palette), a total count, and a severity breakdown derived from each finding's `priority`.

#### Scenario: Findings grouped by worker
- **WHEN** the `Worker findings` tab is active and the response contains findings from `security-audit` (×3) and `cost-tracker` (×1)
- **THEN** two group sections SHALL render in alphabetical worker order
- **AND** the `security-audit` header SHALL show `3 findings` plus a severity breakdown computed from its findings' priorities
- **AND** the `cost-tracker` header SHALL show `1 finding`

#### Scenario: Severity breakdown maps priority to label
- **WHEN** a group contains findings with priorities `[1, 2, 2, 3]`
- **THEN** the breakdown SHALL read `(1 critical, 2 high, 1 medium)` and SHALL omit zero-count severities

#### Scenario: Finding row click opens the issue
- **WHEN** the user clicks a finding row
- **THEN** the workspace SHALL receive an `openPinned(issue_id)` call for that finding's issue ID
- **AND** the issue SHALL open as a pinned tab in the active pane

#### Scenario: No findings present
- **WHEN** `list_worker_findings` returns an empty array
- **THEN** the tab SHALL render an empty state message instructing the user to run `/audit`, `/ruflo-loop testgaps`, or `/ruflo-cost`
- **AND** no group sections SHALL render

#### Scenario: Tab refreshes via task-cache cycle
- **WHEN** a worker-filed issue is closed, deleted, or updated while the `Worker findings` tab is visible
- **THEN** the tab's contents SHALL refresh within one task-cache refresh cycle (driven by the existing `dolt_log()` polling)
- **AND** no manual reload SHALL be required

#### Scenario: Re-run button hidden on Worker findings tab
- **WHEN** the `Worker findings` tab is active
- **THEN** the panel's `Re-run` button SHALL NOT be visible
- **AND** switching back to the `Checks` tab SHALL restore the button
