## ADDED Requirements

### Requirement: Grouped task list rendering
The task list component SHALL support rendering tasks in named, collapsible group sections when a group-by dimension is active (see `list-grouping` spec). When no group-by is active, the list renders as a flat sorted list (unchanged behavior). Group sections SHALL be compatible with the existing virtual list renderer — each section header is an item in the virtual list.

#### Scenario: Group headers rendered in virtual list
- **WHEN** group-by is active and tasks are grouped into 3 sections
- **THEN** the virtual list contains section header items interspersed with task row items, and scrolling is continuous across section boundaries

#### Scenario: Flat list unaffected when no grouping
- **WHEN** no group-by dimension is selected
- **THEN** the task list renders identically to the pre-grouping behavior

#### Scenario: Bulk selection across groups
- **WHEN** the user selects a range of tasks that spans two group sections
- **THEN** all tasks in the range (including those in both groups) are selected

### Requirement: Workspace scope auto-applied at mount
When the workspace-context feature detects workspace labels at project open, the task list SHALL apply the workspace scope filter automatically as part of the initial mount. This filter is applied before the first render, so the list never shows an unscoped flash.

#### Scenario: No flash of unscoped data on project open
- **WHEN** the user opens a project with workspace context available
- **THEN** the first render of the task list shows only workspace-scoped tasks; there is no intermediate render showing all tasks
