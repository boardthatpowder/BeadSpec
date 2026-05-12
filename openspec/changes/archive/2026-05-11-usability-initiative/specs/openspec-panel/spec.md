## ADDED Requirements

### Requirement: OpenSpec panel visible when task has openspec label
The task detail pane SHALL render an "OpenSpec" collapsible section when the open task has at least one label matching the pattern `openspec:<change-name>`. When no such label is present, the section SHALL not render (no empty placeholder).

#### Scenario: Task with openspec label — panel rendered
- **WHEN** the user opens a task that has the label `openspec:configurable-list-groupings`
- **THEN** the task detail pane shows an "OpenSpec" section below the existing content with the change name displayed as a header

#### Scenario: Task without openspec label — panel absent
- **WHEN** the user opens a task that has no `openspec:*` label
- **THEN** no OpenSpec section is rendered and no empty placeholder is shown

### Requirement: Artifact links open in system editor
The OpenSpec panel SHALL list the artifact files that exist for the detected change (`proposal.md`, `design.md`, `tasks.md`, and any `specs/**/*.md` files). Each listed file SHALL be a clickable link that opens the file in the OS default editor via Tauri's `open_path` (shell open). Files that do not yet exist for the change SHALL be listed in a muted/disabled style.

#### Scenario: All artifacts present — all links active
- **WHEN** the OpenSpec panel is rendered for a change that has all four artifact types
- **THEN** all four artifact links are clickable and opening one launches the system editor at that file

#### Scenario: Partial artifacts — missing files shown as disabled
- **WHEN** the change has only `proposal.md` (design and specs not yet written)
- **THEN** proposal link is active; design and specs links are visible but muted and non-clickable

#### Scenario: Multiple spec files listed
- **WHEN** the change has specs in `specs/list-grouping/spec.md` and `specs/workspace-context/spec.md`
- **THEN** each spec file is listed individually under a "Specs" sub-heading

### Requirement: Tasks.md progress bar
The OpenSpec panel SHALL display a progress bar showing `done / total` checkboxes parsed from the change's `tasks.md`. The bar SHALL refresh each time the panel is opened (lazy, not live-polled).

#### Scenario: Progress bar reflects checked tasks
- **WHEN** the OpenSpec panel is opened for a change whose `tasks.md` has 10 checkboxes of which 4 are checked
- **THEN** the progress bar shows "4 / 10" and fills to 40%

#### Scenario: No tasks.md — progress bar hidden
- **WHEN** the change does not yet have a `tasks.md`
- **THEN** no progress bar is rendered; instead a "Tasks not created yet" hint is shown

### Requirement: openspec validate status
The OpenSpec panel SHALL show the last-known `openspec validate` result for the change with a timestamp. A "Re-validate" button SHALL trigger `run_openspec_validate` and update the result in place. The validate call is on-demand only, not automatic.

#### Scenario: Validate result shown
- **WHEN** the user clicks "Re-validate" in the OpenSpec panel
- **THEN** the app runs `openspec validate --change <name> --json`, displays "Valid" or a list of errors, and records the timestamp

#### Scenario: Validate result cached across navigation
- **WHEN** the user navigates away from the task and back
- **THEN** the last validate result and timestamp are shown without re-running the command

### Requirement: Drift detection between issue status and tasks.md checkbox
The OpenSpec panel SHALL detect and surface mismatches between an issue's beads status and its corresponding checkbox state in `tasks.md`. A mismatch is: issue is `closed` but the matching checkbox is unchecked, or the issue is `open` / `in_progress` but the matching checkbox is checked. The match is by issue title against checkbox text (case-insensitive, trimmed).

#### Scenario: Issue closed but checkbox unchecked — drift warning shown
- **WHEN** the open task has status `closed` and the panel finds its title in `tasks.md` as an unchecked checkbox
- **THEN** the panel shows a yellow "Drift detected: issue closed but task unchecked" warning with a "Fix in tasks.md" link

#### Scenario: No drift — no warning shown
- **WHEN** the open task status and its tasks.md checkbox state are in sync
- **THEN** no drift warning is displayed
