## MODIFIED Requirements

### Requirement: Project health view accessible from navigation
The app SHALL provide a "Health" view accessible from the top navigation area. The view SHALL present its content under a tab strip with two sub-tabs: "Checks" (default active) and "Sessions". The Checks tab SHALL execute `bd preflight`, `bd doctor`, `bd lint`, `bd stale`, and `bd orphans` sequentially against the active project root and render each result as a named section showing the command's stdout and stderr output. The Sessions tab SHALL render the session-snapshot timeline as defined by the `session-snapshot-timeline` capability.

#### Scenario: User opens Health view
- **WHEN** the user navigates to the Health view
- **THEN** the Checks tab is shown by default
- **AND** the tab strip exposes a "Sessions" tab the user can switch to without leaving the view

#### Scenario: User switches to Sessions sub-tab
- **WHEN** the user clicks the "Sessions" tab
- **THEN** the Checks markup is hidden and the Sessions timeline is rendered in its place
- **AND** the "Re-run" button is hidden (each tab owns its own refresh control)

#### Scenario: User switches back to Checks sub-tab
- **WHEN** the user clicks the "Checks" tab while on Sessions
- **THEN** the Sessions content is hidden, the Checks content and the "Re-run" button are shown again

#### Scenario: No project connected (shared guard)
- **WHEN** the user opens Health view with no project connected
- **THEN** both sub-tabs SHALL display the "Connect a project" message rather than attempting to run checks or fetch snapshots
