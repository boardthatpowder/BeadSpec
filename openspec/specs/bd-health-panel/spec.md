# BD Health Panel Specification

### Requirement: Project health view accessible from navigation
The app SHALL provide a "Health" view accessible from the top navigation area. The view executes `bd preflight`, `bd doctor`, `bd lint`, `bd stale`, and `bd orphans` sequentially against the active project root and renders each result as a named section showing the command's stdout and stderr output.

#### Scenario: User opens Health view
- **WHEN** the user navigates to the Health view
- **THEN** the view runs all five checks in order and displays a named section for each with its output

#### Scenario: All checks pass
- **WHEN** all five commands exit with code 0 and no issues
- **THEN** the view shows a green "All checks passed" summary

#### Scenario: One check fails
- **WHEN** a check exits with a non-zero exit code
- **THEN** its section is rendered with an error indicator and the full stdout/stderr output visible

#### Scenario: No project connected
- **WHEN** the user opens Health view with no project connected
- **THEN** the view shows "Connect a project to run health checks"

#### Scenario: bd binary is not found
- **WHEN** the `bd` binary cannot be resolved on PATH
- **THEN** the Health view SHALL display an instructional "bd CLI not found" message and no check sections

### Requirement: All checks passed banner
The system SHALL display a green "All checks passed" banner when all five checks complete with exit code 0.

#### Scenario: All five checks pass
- **WHEN** all five checks return exit code 0
- **THEN** a green "All checks passed" banner is shown

#### Scenario: At least one check fails
- **WHEN** any check returns a non-zero exit code
- **THEN** individual sections are shown and the green banner is NOT shown

### Requirement: Structured check results with actionable suggestions
Each `bd` check's output SHALL be rendered as a named section (e.g. "Preflight", "Lint", "Stale Issues", "Orphaned Dependencies") with individual findings listed. Findings that reference a specific issue id SHALL render the id as a clickable chip that navigates to that task's detail pane.

#### Scenario: Lint finds issues with missing description sections
- **WHEN** `bd lint` returns a list of issue ids with missing description sections
- **THEN** each id is shown as a clickable chip; clicking one opens that task in the detail pane

#### Scenario: Stale issues listed with last-activity date
- **WHEN** `bd stale` returns issues with no recent activity
- **THEN** each is shown with its title, id chip, and last-activity date

### Requirement: Issue ID chips in check output
The system SHALL render any token matching the pattern `[A-Z]+-[a-z0-9]+` appearing in check output as a clickable chip that navigates to the corresponding task detail view.

#### Scenario: Issue ID appears in stdout
- **WHEN** a check's stdout contains an issue ID token (e.g. `BUI-abc123`)
- **THEN** that token SHALL be rendered as a clickable chip

#### Scenario: Chip navigation
- **WHEN** the user clicks an issue ID chip
- **THEN** the app SHALL navigate to the task detail view for that issue ID

#### Scenario: Non-matching text is plain
- **WHEN** check output contains text that does not match the issue ID pattern
- **THEN** that text SHALL be rendered as plain text without chip styling

### Requirement: Re-run checks on demand
The Health view SHALL include a "Re-run" button that re-executes all checks and refreshes the report. The button is disabled while checks are running. Results are not auto-refreshed.

#### Scenario: User re-runs checks after fixing an issue
- **WHEN** the user closes a stale issue in the task list and then clicks "Re-run" in the Health view
- **THEN** the health report refreshes and the previously stale issue no longer appears

#### Scenario: Re-run while checks are in progress
- **WHEN** checks are already running
- **THEN** the "Re-run" button SHALL be disabled until all checks complete

### Requirement: Progressive section rendering
The system SHALL render each check section as soon as its result resolves, without waiting for all five checks to complete.

#### Scenario: First check completes before second
- **WHEN** the first check (`bd preflight`) returns a result
- **THEN** its section SHALL be visible immediately even if the remaining four checks are still running

### Requirement: Graceful timeout handling
The system SHALL enforce a 10-second timeout per check; if exceeded, the section SHALL display a timeout error and the result SHALL count as a failure.

#### Scenario: Check exceeds timeout
- **WHEN** a check does not complete within 10 seconds
- **THEN** its section SHALL display a timeout error message and the check SHALL be marked as failed
