## MODIFIED Requirements

### Requirement: Project health view accessible from navigation

The app SHALL provide a "Health" view accessible from the top navigation area. The view SHALL host a tab strip with two tabs: `Checks` (default) and `Worker findings`. The `Checks` tab executes `bd preflight`, `bd doctor`, `bd lint`, `bd stale`, and `bd orphans` sequentially against the active project root and renders each result as a named section. The `Worker findings` tab is defined by the `worker-findings` capability.

#### Scenario: User opens Health view
- **WHEN** the user navigates to the Health view
- **THEN** the `Checks` tab SHALL be active by default
- **AND** the tab SHALL run all five checks in order and display a named section for each with its output

#### Scenario: User switches to Worker findings tab
- **WHEN** the user clicks the `Worker findings` tab
- **THEN** the `WorkerFindingsPanel` SHALL render and fetch findings via `list_worker_findings`
- **AND** the `Re-run` button SHALL be hidden while this tab is active

#### Scenario: User switches back to Checks
- **WHEN** the user clicks the `Checks` tab after viewing `Worker findings`
- **THEN** the previous check results SHALL be re-shown without re-running
- **AND** the `Re-run` button SHALL be visible again

#### Scenario: All checks pass
- **WHEN** all five commands exit with code 0 and no issues
- **THEN** the `Checks` tab SHALL show a green "All checks passed" summary

#### Scenario: One check fails
- **WHEN** a check exits with a non-zero exit code
- **THEN** its section is rendered with an error indicator and the full stdout/stderr output visible

#### Scenario: No project connected
- **WHEN** the user opens Health view with no project connected
- **THEN** both tabs SHALL show "Connect a project to run health checks"

#### Scenario: bd binary is not found
- **WHEN** the `bd` binary cannot be resolved on PATH
- **THEN** the `Checks` tab SHALL display an instructional "bd CLI not found" message and no check sections
- **AND** the `Worker findings` tab SHALL still function (it does not depend on `bd`)
