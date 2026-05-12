## ADDED Requirements

Defines the left task list panel, the top-bar filter system (auto-derived from label prefixes), the KPI metrics bar, and bulk operations. This is the primary navigation surface of the app.

### Requirement: Smart Label Prefix Filter Parsing

The system SHALL scan all labels on open tasks in the loaded project, auto-detect `prefix:value` structure, and expose each unique prefix as an independent filter dimension.

#### Scenario: Project has structured labels
- **GIVEN** a project has tasks with labels: `branch:main`, `branch:bug-fixes`, `worktree:my-feature`, `repo:api`
- **WHEN** the project is loaded
- **THEN** the filter bar SHALL show three filter dimensions: `branch`, `worktree`, `repo`
- **AND** the `branch` filter SHALL offer values: `main`, `bug-fixes`
- **AND** the `worktree` filter SHALL offer values: `my-feature`
- **AND** the `repo` filter SHALL offer values: `api`

#### Scenario: Label with colon in value is parsed correctly
- **GIVEN** a task has label `url:https://example.com`
- **WHEN** the filter system parses this label
- **THEN** the prefix SHALL be `url`
- **AND** the value SHALL be `https://example.com` (everything after the first colon)
- **AND** the value SHALL NOT be split further on subsequent colons

#### Scenario: Unstructured labels (no colon) appear in a flat "Tags" filter
- **GIVEN** a task has label `bugfix` (no colon)
- **WHEN** the filter system parses this label
- **THEN** it SHALL appear under a catch-all `tags` filter dimension
- **AND** it SHALL NOT be treated as a prefix

#### Scenario: New label prefix added externally during a session
- **GIVEN** the app is running and showing existing filters
- **WHEN** a real-time sync event delivers a task with a label prefix not seen before
- **THEN** a new filter dimension SHALL be added to the filter bar dynamically
- **AND** no app restart SHALL be required

### Requirement: Status and Priority Filters

The system SHALL provide dedicated filter controls for task status and priority in addition to label-derived filters.

#### Scenario: User filters by status
- **WHEN** the user selects one or more statuses (Open, In Progress, Blocked, Closed)
- **THEN** the task list SHALL show only tasks matching any of the selected statuses
- **AND** the KPI bar SHALL update to reflect counts within the filtered set

#### Scenario: User filters by priority
- **WHEN** the user selects one or more priority levels
- **THEN** the task list SHALL show only tasks matching any of the selected priorities

#### Scenario: Multiple filters combine with AND logic across dimensions
- **WHEN** the user selects `branch: bug-fixes` AND `status: In Progress`
- **THEN** only tasks that match BOTH conditions SHALL appear

#### Scenario: Multiple values within the same filter dimension use OR logic
- **WHEN** the user selects both `branch: main` and `branch: bug-fixes`
- **THEN** tasks matching EITHER branch label SHALL appear

### Requirement: KPI Metrics Bar

The system SHALL display a dynamic metrics bar in the top section that reflects aggregated counts for the currently filtered task set.

#### Scenario: No filters active — project-wide metrics
- **WHEN** no filters are selected
- **THEN** the KPI bar SHALL show: Total Open, In Progress, Blocked, Closed, and a count per priority level

#### Scenario: Filters active — metrics reflect filtered set
- **WHEN** one or more filters are active
- **THEN** all KPI counts SHALL reflect only the tasks matching the current filter
- **AND** each KPI tile SHALL update in real time as filters change

#### Scenario: KPI tile is clicked
- **WHEN** the user clicks the "Blocked" KPI tile
- **THEN** the status filter SHALL toggle to show only Blocked tasks
- **AND** the task list SHALL update accordingly

### Requirement: Task List Display and Sorting

The system SHALL display tasks in the left panel as a scrollable, sortable list with configurable columns.

#### Scenario: Default task list display
- **WHEN** a project is loaded with no filters
- **THEN** tasks SHALL be displayed with: ID, title, status badge, priority indicator, and label chips
- **AND** tasks SHALL default-sort by priority descending, then creation date descending

#### Scenario: User sorts by a column
- **WHEN** the user clicks a column header (e.g., Status, Priority, Title)
- **THEN** the list SHALL sort by that column, toggling ascending/descending on repeated clicks

#### Scenario: Task list shows real-time updates
- **WHEN** a real-time sync event arrives for a task visible in the current list
- **THEN** that task row SHALL update in place without the list re-sorting or losing scroll position
- **AND** if a task no longer matches the active filters after the update, it SHALL animate out

### Requirement: Bulk Operations

The system SHALL support multi-select and bulk mutation of tasks.

#### Scenario: User selects a range of tasks
- **WHEN** the user shift-clicks a task below the currently selected task
- **THEN** all tasks between the two SHALL be selected
- **AND** a bulk action toolbar SHALL appear showing available bulk operations

#### Scenario: User performs a bulk status change
- **GIVEN** multiple tasks are selected
- **WHEN** the user picks a new status from the bulk action toolbar
- **THEN** all selected tasks SHALL be updated to the new status via `bd` CLI calls
- **AND** optimistic updates SHALL be applied immediately

#### Scenario: User performs a bulk label add
- **GIVEN** multiple tasks are selected
- **WHEN** the user types a new label in the bulk label field and confirms
- **THEN** the label SHALL be added to all selected tasks
- **AND** the filter bar SHALL update if a new prefix was introduced

#### Scenario: User clears selection
- **WHEN** the user presses Escape or clicks outside the task list
- **THEN** the selection SHALL be cleared
- **AND** the bulk action toolbar SHALL be dismissed
