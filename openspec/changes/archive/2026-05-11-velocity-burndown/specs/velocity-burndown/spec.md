## ADDED Requirements

### Requirement: KPI Bar Mode Switcher

The system SHALL provide a mode switcher control appended to the KPI bar that allows the user to toggle between `counts`, `burndown`, and `velocity` views.

#### Scenario: User switches KPI bar to burndown mode
- **WHEN** the user selects "Burndown" from the KPI bar mode dropdown
- **THEN** the status-count pills SHALL be replaced by the burndown line chart
- **AND** the mode SHALL be persisted to `layout.json` under the key `kpiMode`
- **AND** on the next app launch, the KPI bar SHALL restore to burndown mode

#### Scenario: User switches KPI bar to velocity mode
- **WHEN** the user selects "Velocity" from the KPI bar mode dropdown
- **THEN** the status-count pills SHALL be replaced by the velocity bar chart
- **AND** the mode SHALL be persisted to `layout.json` under the key `kpiMode`

#### Scenario: User switches KPI bar back to counts mode
- **WHEN** the user selects "Counts" from the KPI bar mode dropdown
- **THEN** the status-count pills SHALL render identically to the pre-change default view
- **AND** all existing filter-click behaviour SHALL remain unchanged

---

### Requirement: Burndown Chart

The system SHALL render a line chart of open vs. closed task counts over time for a selected OpenSpec change.

#### Scenario: Active change is selected and has history
- **GIVEN** the KPI bar is in `burndown` mode
- **AND** at least one task with an `openspec:<change>` label has task-history entries
- **WHEN** the burndown chart renders
- **THEN** it SHALL show two lines: "Open" (neutral colour) and "Closed" (green colour)
- **AND** the x-axis SHALL display date labels (ISO date, sparse ticks)
- **AND** the y-axis SHALL start at zero
- **AND** hovering a data point SHALL show a tooltip with the exact date, open count, and closed count

#### Scenario: Multiple active changes present
- **GIVEN** the KPI bar is in `burndown` mode
- **AND** open tasks have labels from more than one `openspec:*` namespace
- **WHEN** the burndown chart renders
- **THEN** a compact change-selector dropdown SHALL appear above the chart
- **AND** the first active change SHALL be pre-selected
- **AND** selecting a different change SHALL update the chart data without a page reload

#### Scenario: No active changes with task history
- **GIVEN** the KPI bar is in `burndown` mode
- **AND** no open tasks carry an `openspec:*` label or no task-history exists for matched tasks
- **WHEN** the burndown chart renders
- **THEN** an empty-state message SHALL appear: "No change history yet"

#### Scenario: Burndown data is derived client-side
- **GIVEN** the KPI bar is in `burndown` mode
- **WHEN** the burndown hook fetches data
- **THEN** it SHALL use only the existing `task_history` TanStack Query cache (`getTaskHistory` per task)
- **AND** NO new Tauri commands SHALL be invoked

---

### Requirement: Velocity Chart

The system SHALL render a bar chart of tasks closed per ISO week for the past 8 weeks.

#### Scenario: Sufficient closure history exists
- **GIVEN** the KPI bar is in `velocity` mode
- **AND** at least one task has been closed in the past 8 ISO weeks
- **WHEN** the velocity chart renders
- **THEN** it SHALL show one bar per week (8 bars total)
- **AND** weeks with closures SHALL display the count of tasks closed that week
- **AND** the x-axis SHALL display ISO week labels (e.g., "W18", "W19")
- **AND** hovering a bar SHALL show a tooltip with the week label and count

#### Scenario: Insufficient history — some weeks have no closures
- **GIVEN** the KPI bar is in `velocity` mode
- **AND** fewer than 8 weeks have closure events
- **WHEN** the velocity chart renders
- **THEN** weeks with no closures SHALL render as zero-height bars
- **AND** the chart SHALL still display all 8 week columns

#### Scenario: No closure history at all
- **GIVEN** the KPI bar is in `velocity` mode
- **AND** no task has ever been closed
- **WHEN** the velocity chart renders
- **THEN** all 8 bars SHALL render at zero height
- **AND** a sub-label SHALL appear: "No closures in the past 8 weeks"

#### Scenario: Velocity data is derived client-side
- **GIVEN** the KPI bar is in `velocity` mode
- **WHEN** the velocity hook fetches data
- **THEN** it SHALL use only the existing `task_history` TanStack Query cache
- **AND** NO new Tauri commands SHALL be invoked
