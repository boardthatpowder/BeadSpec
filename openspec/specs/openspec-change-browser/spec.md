# OpenSpec Change Browser Specification

### Requirement: Changes view as top-level navigation entry
The app SHALL expose a "Changes" view accessible from the top navigation bar alongside the existing list/detail views, **only when the OpenSpec feature flag is enabled**. The view reads `openspec/changes/` in the current project root (resolved from `AppState::current_project()`). When no project is open, the view shows an empty state. When the OpenSpec feature flag is disabled, the Changes view and all related components are not mounted and make no Tauri IPC calls.

#### Scenario: User opens Changes view
- **WHEN** the user clicks "Changes" in the top navigation bar
- **THEN** the Changes view replaces the task list pane content and shows all detected OpenSpec changes

#### Scenario: No project open
- **WHEN** the user navigates to the Changes view with no project connected
- **THEN** an empty state is shown: "Connect a project to see its OpenSpec changes"

#### Scenario: ChangesBrowser not mounted when OpenSpec disabled
- **WHEN** OpenSpec is disabled in Settings
- **THEN** the ChangesBrowser component is not mounted in the layout and makes no Tauri IPC calls

#### Scenario: OpenSpec doc panel not openable when OpenSpec disabled
- **WHEN** OpenSpec is disabled in Settings
- **THEN** the LeafPane does not offer the "OpenSpec Doc" panel type and any existing workspace state referencing it is ignored

### Requirement: Change cards with progress and artifact links
Each OpenSpec change SHALL be rendered as a card showing: change name, progress bar (done/total from `tasks.md`), list of artifact links (proposal, design, specs, tasks — greyed out if absent), and last-modified timestamp. Clicking an artifact link opens it in the system editor.

#### Scenario: Change card displays progress
- **WHEN** a change with `tasks.md` containing 10 tasks (3 done) is shown in the browser
- **THEN** the card shows a progress bar filled to 30% and "3 / 10 tasks"

#### Scenario: Change with no tasks.md
- **WHEN** a change has `proposal.md` and `design.md` but no `tasks.md`
- **THEN** the card shows "No tasks yet" instead of a progress bar

#### Scenario: User opens an artifact from a card
- **WHEN** the user clicks "proposal.md" on a change card
- **THEN** the file opens in the system default editor

### Requirement: Import change to beads action
Each change card SHALL include an "Import to beads" button. When clicked it SHALL shell `openspec-beads-import <change-name>` and show streaming output in a modal until the command exits. On success it SHALL show a "Done — N issues created" summary and navigate to the newly created epic in the task list. On failure it SHALL show the stderr output.

#### Scenario: Successful import
- **WHEN** the user clicks "Import to beads" on a change card
- **THEN** a modal opens showing streaming output, and on completion the modal shows the count of issues created with a "Go to epic" button

#### Scenario: Import already run (epic exists)
- **WHEN** the change already has a corresponding epic in beads (detected by `openspec:<change-name>` label on an existing epic)
- **THEN** the button changes to "Already imported — view epic" and navigates to it on click

#### Scenario: Import fails
- **WHEN** `openspec-beads-import` exits with a non-zero code
- **THEN** the modal shows the stderr output with a "Retry" button

### Requirement: Archived changes section
The Changes view SHALL include a collapsible "Archived" section at the bottom that lists changes from `openspec/changes/archive/`. Archived changes are read-only: artifact links work, but "Import to beads" is hidden.

#### Scenario: Archived section collapsed by default
- **WHEN** the user opens the Changes view for the first time
- **THEN** the archived section is collapsed, showing only a count ("12 archived changes")

#### Scenario: User expands archived section
- **WHEN** the user clicks the archived section header
- **THEN** archived change cards appear with artifact links but no import button

### Requirement: Filesystem-watched change list
The Changes view SHALL use Tauri's filesystem watcher to detect new changes added or removed in `openspec/changes/` while the view is open. The card list SHALL update without requiring a manual refresh.

#### Scenario: New change added while browser is open
- **WHEN** a new directory appears in `openspec/changes/` (e.g. via `openspec new change` in the terminal)
- **THEN** a new card appears in the Changes view within 2 seconds without any user interaction
