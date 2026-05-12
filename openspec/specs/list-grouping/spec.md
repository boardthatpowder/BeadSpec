# List Grouping Specification

### Requirement: Group-by control on the task list
The task list SHALL expose a group-by control that lets the user group visible tasks by any supported dimension. Supported dimensions are: `status`, `priority`, `assignee`, `task_type`, and any label prefix (e.g. `openspec:`, `branch:`). The selected dimension SHALL be persisted in `HashStateContext` so the URL reflects current grouping state. The default state is no grouping (flat list, current behavior).

#### Scenario: User selects a field-based grouping
- **WHEN** the user selects "Group by: Status" from the group-by control
- **THEN** the task list re-renders with one collapsible section per distinct status value, each showing a count badge, and the `groupBy` key in the URL hash is updated to `field:status`

#### Scenario: User selects a label-prefix grouping
- **WHEN** the user selects "Group by label prefix: openspec:" from the group-by control
- **THEN** the task list renders one collapsible section per distinct `openspec:<value>` suffix found in the visible tasks, plus an "Unlabeled" section for tasks without that prefix

#### Scenario: User collapses a group section
- **WHEN** the user clicks the header of a group section
- **THEN** the section collapses to show only the header with count, and the collapsed state is preserved until toggled again or the group-by dimension changes

#### Scenario: No grouping selected (default)
- **WHEN** no group-by dimension is active (groupBy is null or absent from URL hash)
- **THEN** the task list renders as a flat sorted list, identical to the current behavior

#### Scenario: User clears grouping
- **WHEN** the user selects "No grouping" from the group-by control
- **THEN** the list reverts to flat, and the `groupBy` key is removed from the URL hash

### Requirement: Group aggregate badges
Each group section header SHALL display a count of tasks in that section and a compact aggregate indicator (e.g. number of blocked tasks or highest-priority open item). The aggregate SHALL update in real time as tasks change.

#### Scenario: Group header shows count
- **WHEN** a group-by dimension is active and tasks are grouped
- **THEN** each section header shows the count of tasks in that group (e.g. "In Progress · 7")

#### Scenario: Real-time count update
- **WHEN** a task in a group changes status (via sync or inline edit) and moves to a different group
- **THEN** the source group count decrements and the task moves to the correct target group without a full list reload

### Requirement: Label-prefix taxonomy for grouping
The group-by control SHALL derive available label-prefix options from the labels currently present on tasks in the project. It SHALL NOT hard-code specific prefixes. Prefixes are extracted by splitting on the first colon per the existing label parsing rule.

#### Scenario: Prefix options reflect actual labels
- **WHEN** the user opens the group-by control
- **THEN** the "Group by label prefix" sub-menu lists only prefixes that exist on at least one visible task

#### Scenario: New prefix added externally
- **WHEN** an external write (sync event) adds a label with a previously unseen prefix to a task
- **THEN** the prefix appears in the group-by label-prefix options on the next render without a restart
