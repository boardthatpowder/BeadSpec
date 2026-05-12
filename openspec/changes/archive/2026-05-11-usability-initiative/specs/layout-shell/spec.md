## ADDED Requirements

### Requirement: Changes view entry in top navigation
The top navigation bar SHALL include a "Changes" navigation entry that renders the `openspec-change-browser` view. It SHALL appear alongside the existing view entries (task list, smart views, etc.) and follow the same active/inactive visual treatment. The entry SHALL only be enabled when a project is connected.

#### Scenario: Changes nav entry visible with project connected
- **WHEN** a project is connected
- **THEN** the "Changes" entry appears in the top navigation bar and is clickable

#### Scenario: Changes nav entry disabled without project
- **WHEN** no project is connected
- **THEN** the "Changes" entry is either hidden or shown in a disabled state

#### Scenario: Changes view replaces list pane content
- **WHEN** the user clicks "Changes" in the navigation bar
- **THEN** the Changes browser view renders in the main content area; the detail pane remains visible if a task was open

### Requirement: KPI bar mode switching
The KPI bar SHALL support multiple display modes (counts, burndown, velocity) via a compact mode control. See the `velocity-burndown` spec for full chart requirements. The control SHALL not break the existing counts display — counts mode must remain the default and fully functional.

#### Scenario: Mode control renders without breaking existing counts display
- **WHEN** the app is opened and `velocity-burndown` feature is active
- **THEN** the KPI bar shows the existing count tiles with a mode toggle control appended; the counts are unchanged

#### Scenario: Mode selection persisted across sessions
- **WHEN** the user selects velocity mode and restarts the app
- **THEN** the KPI bar opens in velocity mode (read from `layout.json` via Tauri store)

### Requirement: Health view entry in navigation
The top navigation or a secondary navigation area SHALL provide access to the Health view (health checks + formulas browser). This MAY be implemented as a dedicated nav entry or as a sub-item under a "Tools" menu — the exact placement is left to implementation, but it SHALL be discoverable without opening the command palette.

#### Scenario: Health view reachable from navigation
- **WHEN** the user wants to access `bd preflight` / health checks
- **THEN** they can reach the Health view in at most 2 clicks from any state without using the command palette
