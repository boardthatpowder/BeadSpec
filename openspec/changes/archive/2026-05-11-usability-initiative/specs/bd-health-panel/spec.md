## ADDED Requirements

### Requirement: Project health view accessible from navigation
The app SHALL provide a "Health" view accessible from the top navigation area. The view executes `bd preflight`, `bd doctor`, `bd lint`, `bd stale`, and `bd orphans` against the current project and displays their combined output as a structured health report.

#### Scenario: User opens Health view
- **WHEN** the user navigates to the Health view
- **THEN** the view shows a loading state, runs all five `bd` health commands sequentially, and renders their results

#### Scenario: All checks pass
- **WHEN** all five commands exit with code 0 and no issues
- **THEN** the view shows a green "All checks passed" summary

#### Scenario: No project connected
- **WHEN** the user opens Health view with no project connected
- **THEN** the view shows "Connect a project to run health checks"

### Requirement: Structured check results with actionable suggestions
Each `bd` check's output SHALL be parsed and rendered as a named section (e.g. "Preflight", "Lint", "Stale Issues", "Orphaned Dependencies") with individual findings listed. Findings that reference a specific issue id SHALL render the id as a clickable chip that navigates to that task's detail pane.

#### Scenario: Lint finds issues with missing description sections
- **WHEN** `bd lint` returns a list of issue ids with missing description sections
- **THEN** each id is shown as a clickable chip; clicking one opens that task in the detail pane

#### Scenario: Stale issues listed with last-activity date
- **WHEN** `bd stale` returns issues with no recent activity
- **THEN** each is shown with its title, id chip, and last-activity date

### Requirement: Re-run checks on demand
The Health view SHALL include a "Re-run" button that re-executes all checks and refreshes the report. Results are not auto-refreshed (to avoid hammering the CLI on every render).

#### Scenario: User re-runs checks after fixing an issue
- **WHEN** the user closes a stale issue in the task list and then clicks "Re-run" in the Health view
- **THEN** the health report refreshes and the previously stale issue no longer appears
