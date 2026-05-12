## ADDED Requirements

### Requirement: Changes view as top-level navigation entry

The system SHALL expose a "Changes" view accessible from the top navigation bar. The view reads `openspec/changes/` from the current project root resolved via `AppState::current_project()`. When no project is open, the view shows an empty state.

#### Scenario: User opens Changes view

- **WHEN** the user clicks "Changes" in the top navigation bar
- **THEN** the Changes view SHALL replace the left panel content and show all detected OpenSpec changes as cards
- **AND** the right detail panel SHALL remain visible (showing the currently selected task or its empty state)
- **AND** the transition SHALL complete without a full page reload

#### Scenario: User reaches Changes view in 2 clicks or fewer

- **GIVEN** the user is on any other view (list, focus, ready)
- **WHEN** the user wants to navigate to Changes
- **THEN** it SHALL require at most 2 clicks (1 click on the "Changes" nav button)

#### Scenario: No project open

- **WHEN** the user navigates to the Changes view with no project connected
- **THEN** an empty state message SHALL be shown: "Connect a project to see its OpenSpec changes"
- **AND** no error SHALL be thrown

#### Scenario: Project has no openspec/changes/ directory

- **WHEN** the connected project has no `openspec/changes/` directory
- **THEN** the Changes view SHALL show: "No OpenSpec changes found in this project"
- **AND** no error state or error boundary SHALL be triggered

### Requirement: Change cards with progress and artifact links

Each active OpenSpec change SHALL be rendered as a card displaying: change name, last-modified timestamp (relative, e.g. "3 days ago"), progress bar derived from `tasks.md` checkbox counts, and artifact availability links for proposal, design, specs, and tasks.

#### Scenario: Change card displays progress bar

- **WHEN** a change with `tasks.md` containing 10 tasks (3 marked `[x]`) is shown
- **THEN** the card SHALL show a progress bar filled to 30%
- **AND** the card SHALL show the label "3 / 10 tasks"

#### Scenario: Change with no tasks.md

- **WHEN** a change has `proposal.md` and `design.md` but no `tasks.md`
- **THEN** the card SHALL show "No tasks yet" in place of the progress bar
- **AND** no error or crash SHALL occur

#### Scenario: User opens an artifact link

- **WHEN** the user clicks an artifact name link (e.g. "proposal.md") on a change card
- **THEN** the file SHALL open in the system default editor via `shell::open`
- **AND** BeadSpec SHALL remain open and responsive

#### Scenario: Artifact is absent

- **WHEN** a change has no `design.md`
- **THEN** the "design" artifact link SHALL be rendered but visually greyed out (reduced opacity, no cursor pointer)
- **AND** clicking it SHALL have no effect

### Requirement: Import change to beads action

Each active change card SHALL include an "Import to beads" button. When clicked it SHALL invoke the `import_change_to_beads` Tauri command and display a modal showing command output. On success the modal SHALL summarise the result and offer navigation to the newly created epic. On failure it SHALL show the error output with a retry option.

#### Scenario: Successful import

- **WHEN** the user clicks "Import to beads" on a change card
- **THEN** a modal SHALL open immediately showing a spinner and the label "Running openspec-beads-import…"
- **AND** when the command exits with code 0, the spinner SHALL be replaced with a success state showing stdout and a "Go to epic" button
- **AND** clicking "Go to epic" SHALL close the modal, set `state.view = 'list'`, and select the newly created epic in the task list

#### Scenario: Import already run — epic exists

- **WHEN** the task list contains an epic whose labels include `openspec:<change-name>`
- **THEN** the "Import to beads" button SHALL be replaced with "Already imported — view epic"
- **AND** clicking "Already imported — view epic" SHALL set `state.view = 'list'` and select the epic

#### Scenario: Import fails

- **WHEN** `import_change_to_beads` exits with a non-zero exit code
- **THEN** the modal SHALL display the `stderr` output
- **AND** a "Retry" button SHALL be visible that re-runs the command and resets the modal to spinner state

#### Scenario: openspec-beads-import not found on PATH

- **WHEN** the `openspec-beads-import` binary is not resolvable from the Tauri process PATH
- **THEN** the "Import to beads" button SHALL be disabled
- **AND** a tooltip on the button SHALL read: "openspec-beads-import not found — run from terminal"

#### Scenario: Import times out

- **WHEN** `import_change_to_beads` has not exited within 30 seconds
- **THEN** the modal SHALL show: "Timed out after 30s"
- **AND** any partial stdout captured SHALL be shown below the error message

### Requirement: Archived changes section

The Changes view SHALL include a collapsible "Archived" section at the bottom listing changes from `openspec/changes/archive/`. Archived cards are read-only: artifact links are present if the files exist, but the import button is absent.

#### Scenario: Archived section collapsed by default

- **WHEN** the user opens the Changes view for the first time in a session
- **THEN** the archived section SHALL be collapsed
- **AND** the section header SHALL show the count: "N archived change(s)"

#### Scenario: User expands archived section

- **WHEN** the user clicks the archived section header
- **THEN** the section SHALL expand to show all archived change cards
- **AND** each archived card SHALL show name, last-modified, progress (if `tasks.md` exists), and artifact links
- **AND** no import button SHALL be present on archived cards

#### Scenario: User collapses archived section

- **WHEN** the archived section is expanded and the user clicks the header again
- **THEN** the section SHALL collapse back to showing only the count header

### Requirement: Filesystem-watched change list

The Changes view SHALL use a Tauri filesystem watcher (`OpenSpecWatcher`) to detect directories added or removed in `openspec/changes/` while the view is open. The card list SHALL update without requiring a manual refresh.

#### Scenario: New change added while browser is open

- **WHEN** a new directory appears in `openspec/changes/`
- **THEN** a new change card SHALL appear in the Changes view within 2 seconds
- **AND** no manual refresh or user interaction SHALL be required

#### Scenario: Change directory removed while browser is open

- **WHEN** a change directory is deleted from `openspec/changes/`
- **THEN** the corresponding card SHALL disappear from the Changes view within 2 seconds

#### Scenario: Watcher not started when openspec/changes/ absent

- **WHEN** the project has no `openspec/changes/` directory at connect time
- **THEN** the `OpenSpecWatcher` SHALL gracefully no-op
- **AND** the Changes view SHALL not crash or show an error
