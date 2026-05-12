## ADDED Requirements

### Requirement: Health view displays five bd check sections
The system SHALL run `bd preflight`, `bd doctor`, `bd lint`, `bd stale`, and `bd orphans` sequentially against the active project root and render each result as a named section showing the command's stdout and stderr output.

#### Scenario: All checks complete successfully
- **WHEN** the user opens the Health view
- **THEN** the system runs all five checks in order and displays a named section for each with its output

#### Scenario: One check fails
- **WHEN** a check exits with a non-zero exit code
- **THEN** its section is rendered with an error indicator and the full stdout/stderr output visible

#### Scenario: bd binary is not found
- **WHEN** `AppState` has no resolved `bd` binary path
- **THEN** the Health view SHALL display an instructional "bd CLI not found" message and no check sections

### Requirement: All checks passed banner
The system SHALL display a green "All checks passed" banner in place of the individual sections when all five checks complete with exit code 0.

#### Scenario: All five checks pass
- **WHEN** all five checks return exit code 0
- **THEN** a green "All checks passed" banner is shown and individual sections are not shown

#### Scenario: At least one check fails
- **WHEN** any check returns a non-zero exit code
- **THEN** individual sections are shown and the green banner is NOT shown

### Requirement: Re-run button refreshes all checks
The system SHALL provide a "Re-run" button that re-executes all five checks and replaces the existing output.

#### Scenario: User clicks Re-run
- **WHEN** the user clicks the "Re-run" button
- **THEN** all five checks are re-executed sequentially and their output sections are updated

#### Scenario: Re-run while checks are in progress
- **WHEN** checks are already running
- **THEN** the "Re-run" button SHALL be disabled until all checks complete

### Requirement: Issue ID chips in check output
The system SHALL render any token matching the pattern `BUI-[a-z0-9]+` appearing in check output as a clickable chip that navigates to the corresponding task detail view.

#### Scenario: Issue ID appears in stdout
- **WHEN** a check's stdout contains the text `BUI-abc123`
- **THEN** that token SHALL be rendered as a clickable chip

#### Scenario: Chip navigation
- **WHEN** the user clicks an issue ID chip
- **THEN** the app SHALL navigate to the task detail view for that issue ID

#### Scenario: Non-matching text is plain
- **WHEN** check output contains text that does not match `BUI-[a-z0-9]+`
- **THEN** that text SHALL be rendered as plain text without chip styling

### Requirement: Progressive section rendering
The system SHALL render each check section as soon as its result resolves, without waiting for all five checks to complete.

#### Scenario: First check completes before second
- **WHEN** the first check (`bd preflight`) returns a result
- **THEN** its section SHALL be visible immediately even if the remaining four checks are still running

### Requirement: Graceful timeout handling
The system SHALL enforce a 10-second timeout per check; if exceeded, the section SHALL display a timeout error and the overall result SHALL count as a failure.

#### Scenario: Check exceeds timeout
- **WHEN** a check does not complete within 10 seconds
- **THEN** its section SHALL display a timeout error message and the check SHALL be marked as failed
