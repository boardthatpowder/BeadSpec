## ADDED Requirements

### Requirement: Dependency Lineage in Ready to Start View

The system SHALL display inline dependency lineage for each task in the "Ready to Start" view, showing which closed tasks unblocked it and how many tasks it will in turn unblock, so users can immediately understand the impact of starting a task.

#### Scenario: Ready task row shows unblocked-by chips

- **WHEN** the user opens the "Ready to Start" view
- **AND** a ready task has one or more direct dependencies with status Closed
- **THEN** the task row SHALL display an "Unblocked by:" chip row beneath the task title
- **AND** each chip SHALL display the dependency's ID and a truncated title (max 24 characters)
- **AND** each chip SHALL be clickable and navigate to that dependency's task detail

#### Scenario: Ready task row shows unblocks count

- **WHEN** the user opens the "Ready to Start" view
- **AND** a ready task has one or more tasks that depend on it
- **THEN** the task row SHALL display an "Unblocks: N tasks" control beneath the task title (or beneath the unblocked-by row if present)
- **AND** N SHALL be the count of direct dependents

#### Scenario: User expands unblocks list

- **WHEN** the user clicks the "Unblocks: N tasks" control
- **THEN** the control SHALL expand inline to show a chip for each dependent task
- **AND** each chip SHALL display the dependent's ID and truncated title
- **AND** each chip SHALL be clickable and navigate to that dependent's task detail
- **AND** clicking the control again SHALL collapse the list

#### Scenario: Task with no dependencies or dependents shows no lineage row

- **WHEN** a ready task has zero closed dependencies AND zero dependents
- **THEN** NO lineage row SHALL be displayed for that task row
- **AND** the task row layout SHALL be identical to the pre-lineage design

#### Scenario: Lineage loads asynchronously per visible row

- **WHEN** the "Ready to Start" view renders
- **THEN** lineage data SHALL only be fetched for task rows currently visible in the viewport
- **AND** task rows that are scrolled into view SHALL fetch their lineage data on demand
- **AND** while lineage is loading, the task row SHALL render without a lineage row (no placeholder or spinner required at the row level)

#### Scenario: Lineage chip navigates to task detail

- **WHEN** the user clicks any lineage chip (unblocked-by or unblocks)
- **THEN** the task detail panel SHALL open for the referenced task
- **AND** navigation SHALL use the same mechanism as clicking a task in the main task list
