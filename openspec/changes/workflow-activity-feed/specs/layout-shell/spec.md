## MODIFIED Requirements

### Requirement: Activity view entry in top navigation

The top navigation bar SHALL include an "Activity" entry that renders the workflow activity feed view. It SHALL appear alongside the existing entries (All, Focus, Ready, Health, Changes) and follow the same active/inactive visual treatment applied to those entries. It SHALL be visible whenever a project is connected — it requires no feature flag and is not gated on any settings toggle.

#### Scenario: Activity nav entry visible with project connected

- **WHEN** a project is connected
- **THEN** the "Activity" entry SHALL appear in the top navigation bar and be clickable

#### Scenario: Activity view replaces list pane content

- **WHEN** the user clicks "Activity" in the navigation bar
- **THEN** the Activity feed view SHALL render in the main content area
- **AND** the detail pane SHALL remain visible if a task tab was already open

#### Scenario: Activity entry hidden or disabled when no project connected

- **WHEN** no project is connected
- **THEN** the "Activity" entry SHALL be either hidden or rendered in a visually disabled state (consistent with the treatment of other view entries in that state)

#### Scenario: Selected view persists across reload

- **WHEN** the user navigates to the Activity view and reloads the app
- **THEN** the URL hash SHALL contain `view=activity`
- **AND** the Activity view SHALL be the active view on reload
