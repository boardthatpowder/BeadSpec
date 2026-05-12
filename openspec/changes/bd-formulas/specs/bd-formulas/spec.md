## ADDED Requirements

### Requirement: Formulas browser displays available formulas as cards
The system SHALL run `bd formula list --json` and render one card per formula showing the formula name and description. If the formula list is empty, a "No formulas available" empty state SHALL be displayed. If the JSON cannot be parsed, a "Formula list unavailable" error state SHALL be displayed with the raw output.

#### Scenario: Formula list loads successfully
- **WHEN** the user opens the Formulas browser
- **THEN** the system runs `bd formula list --json` and renders one card per returned formula with its name and description

#### Scenario: Formula list is empty
- **WHEN** `bd formula list --json` returns an empty JSON array
- **THEN** the system SHALL display a "No formulas available" empty state

#### Scenario: Formula list JSON is malformed
- **WHEN** `bd formula list --json` returns output that cannot be parsed as a JSON array
- **THEN** the system SHALL display a "Formula list unavailable" error state with the raw command output

#### Scenario: bd binary not found
- **WHEN** `AppState` has no resolved `bd` binary path
- **THEN** the Formulas browser SHALL display the same "bd CLI not found" instructional state as the Health panel

### Requirement: Pour button initiates mandatory confirmation dialog
Each formula card SHALL include a "Pour" button. Clicking the "Pour" button SHALL open a confirmation dialog displaying the formula name and a warning that the operation is irreversible before any pour is executed.

#### Scenario: User clicks Pour
- **WHEN** the user clicks the "Pour" button on a formula card
- **THEN** a modal confirmation dialog SHALL open showing the formula name and the message "This will modify your project and cannot be undone."

#### Scenario: User cancels pour
- **WHEN** the user clicks "Cancel" in the confirmation dialog
- **THEN** the dialog SHALL close and no pour command SHALL be executed

#### Scenario: User confirms pour
- **WHEN** the user clicks the "Pour" confirmation action in the dialog
- **THEN** `bd mol pour <name>` SHALL be executed via `run_bd_command`

### Requirement: Pour output is displayed with issue ID chips
After a pour is confirmed and executed, the system SHALL display the captured stdout and stderr in a scrollable output panel. Any `BUI-[a-z0-9]+` token in the output SHALL be rendered as a clickable chip navigating to the corresponding task detail view.

#### Scenario: Pour completes with output
- **WHEN** `bd mol pour <name>` completes
- **THEN** the captured output SHALL be displayed in a scrollable output panel

#### Scenario: Issue ID in pour output
- **WHEN** the pour output contains a token matching `BUI-[a-z0-9]+`
- **THEN** that token SHALL be rendered as a clickable chip

#### Scenario: Chip navigation
- **WHEN** the user clicks an issue ID chip in the pour output
- **THEN** the app SHALL navigate to the task detail view for that issue ID

#### Scenario: Pour fails with non-zero exit code
- **WHEN** `bd mol pour <name>` exits with a non-zero exit code
- **THEN** the output panel SHALL still be displayed with the full stdout/stderr and an error indicator

### Requirement: Pour confirmation button disabled during execution
Once pour is confirmed and the command is running, the system SHALL disable the "Pour" confirmation button and all other "Pour" buttons in the browser to prevent concurrent pours.

#### Scenario: Pour in progress
- **WHEN** a pour command is currently executing
- **THEN** all "Pour" buttons in the Formulas browser SHALL be disabled until the command completes

### Requirement: Issue chip utility is shared with Health panel
The `BUI-[a-z0-9]+` chip rendering logic SHALL be implemented as a shared utility importable by both `BdHealthPanel` and `FormulasBrowser`, ensuring consistent chip behavior.

#### Scenario: Chip behavior matches Health panel
- **WHEN** issue ID chips appear in Formulas browser output
- **THEN** their visual appearance and navigation behavior SHALL be identical to chips in the Health panel
