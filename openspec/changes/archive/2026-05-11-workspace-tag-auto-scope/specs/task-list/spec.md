## ADDED Requirements

### Requirement: No-flash guarantee at mount
The system SHALL ensure that when a project with an active workspace scope is opened, the TaskList renders with the workspace filter already applied on its first paint — users SHALL NOT see an unscoped flash of all issues before the filter is applied.

#### Scenario: First render is scoped
- **GIVEN** a git project is opened and `workspaceScope` defaults to `'on'`
- **WHEN** the connected project view mounts for the first time
- **THEN** the TaskList SHALL display only tasks matching the workspace labels on its first render
- **AND** there SHALL be no intermediate render showing all tasks before the filter is applied

#### Scenario: Scope read synchronously from store at mount
- **GIVEN** `workspaceContext` and `workspaceScope` are stored in the Zustand store before the connected view renders
- **WHEN** TaskList's render function runs for the first time
- **THEN** it SHALL read `workspaceScope` and `workspaceContext` from the store synchronously
- **AND** pass them to `filterParser` before returning JSX

#### Scenario: Scope off — first render shows all tasks (no flash concern)
- **GIVEN** the URL hash encodes `workspaceScope=off`
- **WHEN** the connected project view mounts for the first time
- **THEN** the TaskList SHALL display all tasks (unscoped) from the first render
- **AND** this is the expected behaviour when scope is explicitly disabled
