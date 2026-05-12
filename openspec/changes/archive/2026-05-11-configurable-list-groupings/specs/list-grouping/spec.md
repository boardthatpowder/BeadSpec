# List Grouping Specification

## Purpose

Defines the group-by control, GroupConfig type, groupTasks() transform, collapsible section UX, label-prefix taxonomy for grouping, real-time count updates, and section aggregate badges. This spec covers new capability `list-grouping` added by the `configurable-list-groupings` change.

---

## ADDED Requirements

### Requirement: Group-by Control

The system SHALL provide a "Group by" dropdown in the filter bar that allows users to group the visible task list into named sections.

#### Scenario: Default state — flat list
- **GIVEN** a project is loaded with no persisted group-by preference
- **THEN** the task list SHALL render as a flat, ungrouped list
- **AND** the "Group by" dropdown trigger SHALL display "Group" (inactive state)

#### Scenario: User selects a field grouping
- **WHEN** the user opens the "Group by" dropdown and selects "Status"
- **THEN** the task list SHALL divide into sections: Open, In Progress, Blocked, Closed
- **AND** each section header SHALL show the section name and the count of tasks in that section
- **AND** the "Group by" dropdown trigger SHALL display "Status"

#### Scenario: User selects a label-prefix grouping
- **WHEN** the user opens the "Group by" dropdown and selects a label prefix (e.g. "openspec")
- **THEN** the task list SHALL divide into sections named by the suffix values (e.g. "configurable-list-groupings", "usability-initiative")
- **AND** tasks with no matching label SHALL appear in a "(none)" section at the bottom
- **AND** the "Group by" dropdown trigger SHALL display the prefix name

#### Scenario: User resets to flat list
- **WHEN** the user selects "None" from the "Group by" dropdown
- **THEN** the task list SHALL return to the flat ungrouped rendering
- **AND** the `groupBy` value in the URL hash SHALL be removed or set to null

---

### Requirement: GroupConfig Type and Serialization

The system SHALL define a `GroupConfig` discriminated union type that encapsulates all valid grouping configurations.

#### Scenario: Field grouping serialization
- **GIVEN** the user selects "Status" as the grouping field
- **WHEN** the state is serialized to the URL hash
- **THEN** the hash SHALL contain `groupBy: "field:status"`

#### Scenario: Label-prefix grouping serialization
- **GIVEN** the user selects the "openspec" label prefix as the grouping
- **WHEN** the state is serialized to the URL hash
- **THEN** the hash SHALL contain `groupBy: "label:openspec"`

#### Scenario: Null grouping serialization
- **GIVEN** no grouping is active
- **WHEN** the state is serialized to the URL hash
- **THEN** the `groupBy` key SHALL be absent or null in the hash state

#### Scenario: Unknown serialization value degrades gracefully
- **GIVEN** the URL hash contains an unrecognized `groupBy` value (e.g. `"xyz:unknown"`)
- **WHEN** the app loads and deserializes the hash
- **THEN** the grouping SHALL fall back to null (flat list)
- **AND** no error SHALL be thrown

---

### Requirement: groupTasks Transform

The system SHALL implement a pure `groupTasks(tasks, config)` function that partitions a task array into ordered `GroupedSection[]`.

#### Scenario: Field grouping by status
- **GIVEN** tasks with statuses: open, in_progress, blocked, closed
- **WHEN** `groupTasks(tasks, { type: 'field', field: 'status' })` is called
- **THEN** the result SHALL contain exactly four sections in canonical order: open, in_progress, blocked, closed
- **AND** each section SHALL contain only tasks with that status
- **AND** empty sections SHALL be included (with zero tasks)

#### Scenario: Field grouping by priority
- **GIVEN** tasks with priorities 1, 2, 3, 4
- **WHEN** `groupTasks(tasks, { type: 'field', field: 'priority' })` is called
- **THEN** sections SHALL be ordered P1, P2, P3, P4 (ascending)
- **AND** each section label SHALL be "P1 Critical", "P2 High", "P3 Medium", "P4 Low"

#### Scenario: Label-prefix grouping
- **GIVEN** tasks with labels: `openspec:foo`, `openspec:bar`, `openspec:foo`, and one task with no `openspec:` label
- **WHEN** `groupTasks(tasks, { type: 'label-prefix', prefix: 'openspec' })` is called
- **THEN** there SHALL be sections: "bar" (1 task), "foo" (2 tasks), "(none)" (1 task)
- **AND** sections SHALL be sorted alphabetically with "(none)" last

#### Scenario: Task with multiple matching labels appears in multiple sections
- **GIVEN** a task with labels `openspec:foo` and `openspec:bar`
- **WHEN** `groupTasks(tasks, { type: 'label-prefix', prefix: 'openspec' })` is called
- **THEN** that task SHALL appear in BOTH the "foo" section AND the "bar" section

#### Scenario: Null config returns single flat section
- **WHEN** `groupTasks(tasks, null)` is called
- **THEN** the result SHALL be a single section with key `'__all__'` containing all input tasks

---

### Requirement: Collapsible Sections

The system SHALL allow users to collapse and expand task group sections.

#### Scenario: User collapses a section
- **WHEN** the user clicks the section header chevron (or the header itself)
- **THEN** the section's task rows SHALL be hidden from the virtual list
- **AND** the section header SHALL show a "(N hidden)" indicator
- **AND** the chevron SHALL rotate to indicate collapsed state

#### Scenario: User expands a collapsed section
- **WHEN** the user clicks the header of a collapsed section
- **THEN** the section's task rows SHALL be re-added to the virtual list
- **AND** the "(N hidden)" indicator SHALL disappear

#### Scenario: Collapse state does not persist across navigation
- **WHEN** the user navigates away from the task list and returns
- **THEN** all sections SHALL be expanded by default
- **AND** the previously collapsed section keys SHALL NOT be remembered in URL or store

#### Scenario: Collapse state survives filter changes
- **GIVEN** a section "In Progress" is collapsed
- **WHEN** the user changes the Status filter
- **THEN** the "In Progress" section SHALL remain collapsed if it still exists in the new grouped result
- **AND** sections that no longer exist after filtering SHALL be silently ignored

---

### Requirement: Real-time Count Updates

The system SHALL update section count badges in real time as tasks change.

#### Scenario: Task status changes updates section counts
- **GIVEN** the list is grouped by status and the "Open" section shows 5 tasks
- **WHEN** a real-time sync event moves one task from Open to In Progress
- **THEN** the "Open" section count badge SHALL update to 4
- **AND** the "In Progress" section count badge SHALL increment by 1
- **AND** the task row SHALL move to the correct section without requiring a page reload

#### Scenario: New task added appears in correct section
- **GIVEN** the list is grouped by label prefix "openspec"
- **WHEN** a new task with label `openspec:new-epic` is synced into the query cache
- **THEN** a new "new-epic" section SHALL appear (or the existing section count SHALL increment)

---

### Requirement: Label-Prefix Taxonomy for Group-by Sub-menu

The system SHALL derive the label-prefix sub-menu dynamically from the labels present in the current project's tasks.

#### Scenario: Prefixes are derived from all tasks not just filtered
- **GIVEN** tasks with labels `branch:main`, `openspec:foo`, `area:backend`
- **WHEN** the "Group by" dropdown is opened
- **THEN** the "By label prefix" section SHALL list: `area`, `openspec`
- **AND** `branch` SHALL be excluded (structural prefix)

#### Scenario: Structural prefixes excluded from grouping sub-menu
- **WHEN** the label prefixes are computed for the dropdown
- **THEN** the following prefixes SHALL be excluded: `branch`, `repo`, `worktree`, `worker`
- **AND** all other structured prefixes SHALL be included

#### Scenario: Empty prefix list shows disabled item
- **GIVEN** all tasks have only structural labels or no labels
- **WHEN** the "By label prefix" section of the dropdown is rendered
- **THEN** it SHALL show a disabled "No label prefixes found" item
- **AND** no errors SHALL be thrown

---

### Requirement: Count Badge on Section Headers

The system SHALL display a count badge on each section header showing the number of tasks in that section.

#### Scenario: Count badge reflects current filter
- **GIVEN** the list is grouped by status and a label filter is active
- **WHEN** the sections are rendered
- **THEN** each section's count badge SHALL reflect the number of tasks matching both the section's group criterion AND the active label filters
- **AND** the count SHALL not include tasks hidden by other active filters

#### Scenario: Collapsed section count badge remains visible
- **WHEN** a section is collapsed
- **THEN** the count badge SHALL remain visible and accurate
- **AND** a secondary "(N hidden)" label SHALL clarify all tasks are hidden
