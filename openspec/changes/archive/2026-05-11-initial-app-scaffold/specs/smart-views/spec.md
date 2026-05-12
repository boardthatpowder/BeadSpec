## ADDED Requirements

Defines the power-user surfaces: the command palette, keyboard-first navigation, Focus/Today view, "Ready to Start" smart view, and bulk keyboard operations. These features are the primary differentiators for experienced users.

### Requirement: Command Palette

The system SHALL provide a command palette activated by the primary modifier + K that allows fuzzy search over tasks, filters, statuses, and app actions.

#### Scenario: User opens the command palette
- **WHEN** the user presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- **THEN** a centered modal palette SHALL appear with a text input focused
- **AND** recent tasks SHALL be shown as default suggestions

#### Scenario: User searches for a task by title or ID
- **WHEN** the user types in the command palette
- **THEN** results SHALL update in real time showing matching tasks (by title and ID), statuses, labels, and app actions
- **AND** results SHALL be grouped by type: Tasks, Actions, Views

#### Scenario: User selects a task from the command palette
- **WHEN** the user presses Enter or clicks a task result
- **THEN** the palette SHALL close
- **AND** the task list SHALL select and scroll to that task
- **AND** the detail panel SHALL load that task's details

#### Scenario: User runs an app action from the palette
- **WHEN** the user types "new task" or "create"
- **THEN** a "Create new task" action SHALL appear
- **AND** selecting it SHALL open the inline new task form in the list panel

#### Scenario: User dismisses the palette
- **WHEN** the user presses Escape or clicks outside the palette
- **THEN** the palette SHALL close without changing the current selection

### Requirement: Keyboard-First List Navigation

The system SHALL support keyboard-only navigation of the task list with vim-inspired bindings.

#### Scenario: Navigate the task list with j/k
- **WHEN** focus is in the task list
- **AND** the user presses `j`
- **THEN** the selection SHALL move to the next task in the list
- **WHEN** the user presses `k`
- **THEN** the selection SHALL move to the previous task

#### Scenario: Open task detail with Enter
- **WHEN** a task is selected in the list
- **AND** the user presses Enter
- **THEN** focus SHALL move to the detail panel
- **AND** the detail panel SHALL be scrolled to the top

#### Scenario: Quick status change with Space
- **WHEN** a task is selected in the list
- **AND** the user presses Space
- **THEN** a compact status picker SHALL appear inline in the list row
- **AND** the user can select a status with arrow keys and confirm with Enter
- **AND** Escape SHALL dismiss without changing status

#### Scenario: Activate filter search with /
- **WHEN** the user presses `/` while the task list has focus
- **THEN** the cursor SHALL jump to the filter input in the top bar
- **AND** typing SHALL filter the task list in real time

#### Scenario: Go back in navigation history with Backspace or Alt+Left
- **WHEN** the user has navigated to a task via the dependency graph
- **AND** presses Backspace or Alt+Left
- **THEN** navigation SHALL go back one step in the breadcrumb history

### Requirement: Focus / Today View

The system SHALL provide a Focus view that surfaces only the tasks most relevant to the current user right now.

#### Scenario: User activates Focus view
- **WHEN** the user selects "Focus" from the view switcher or presses the Focus shortcut
- **THEN** the task list SHALL show only: tasks assigned to the current user with status "In Progress" or tasks whose deadline is within 48 hours
- **AND** all chrome (filter bar, KPI tiles for unrelated data) SHALL be minimized
- **AND** the layout SHALL switch to a single-column full-width view

#### Scenario: Focus view is empty
- **WHEN** the Focus view has no qualifying tasks
- **THEN** the list SHALL show an encouraging empty state: "Nothing urgent — you're on top of it"

#### Scenario: User exits Focus view
- **WHEN** the user selects a different view from the view switcher or presses Escape
- **THEN** the previous filter state and layout SHALL be restored

### Requirement: "Ready to Start" Smart View

The system SHALL auto-compute a "Ready to Start" view listing all open tasks whose dependencies are entirely closed.

#### Scenario: User opens Ready to Start view
- **WHEN** the user selects "Ready to Start" from the view switcher
- **THEN** the task list SHALL show only tasks where:
  - status is Open or In Progress
  - AND every task in their dependency chain has status Closed
- **AND** results SHALL be sorted by priority descending

#### Scenario: A task becomes ready after its last dependency closes
- **WHEN** a real-time sync event closes the last blocking dependency for a task
- **THEN** that task SHALL appear in the Ready to Start view immediately (if it is currently open)
- **AND** a brief visual animation SHALL draw attention to the newly available task

#### Scenario: Ready to Start view is empty
- **WHEN** no tasks are unblocked
- **THEN** the view SHALL display: "All open tasks have unresolved dependencies" with a link to the dependency graph for the most-blocked task

### Requirement: Saved Filter Sets (v1.1)

The system SHALL allow users to save named filter combinations as persistent views for quick re-application.

> **Note:** v1 derives view state from URL hash only. Named persistent saved views ship in v1.1.

#### Scenario: User saves current filter set (v1.1)
- **WHEN** the user clicks "Save view" in the filter bar with filters applied
- **THEN** a prompt SHALL ask for a view name
- **AND** the named view SHALL be persisted and appear in the view switcher

#### Scenario: User applies a saved view (v1.1)
- **WHEN** the user selects a named view from the view switcher
- **THEN** all filters SHALL be restored to their saved state
- **AND** the task list and KPI bar SHALL update accordingly
