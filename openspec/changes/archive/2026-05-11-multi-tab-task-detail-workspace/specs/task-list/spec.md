## ADDED Requirements

### Requirement: Row Interactions Open Workspace Tabs

The system SHALL route task-list row interactions through the workspace store rather than directly mutating the hash `taskId`, distinguishing preview-open and pinned-open gestures.

#### Scenario: Single click opens preview tab
- **WHEN** the user single-clicks a task row (without holding Shift)
- **THEN** the workspace SHALL receive an `openPreview(taskId)` call
- **AND** the task SHALL open as a preview tab in the active pane (per `task-workspace` preview semantics)
- **AND** the focused row SHALL update to the clicked task

#### Scenario: Double click opens pinned tab
- **WHEN** the user double-clicks a task row
- **THEN** the workspace SHALL receive an `openPinned(taskId)` call
- **AND** the task SHALL open as a pinned tab in the active pane, promoting any existing preview tab for that task

#### Scenario: Enter on focused row opens pinned tab
- **WHEN** the user presses `Enter` while a task row is focused
- **THEN** the workspace SHALL receive an `openPinned(taskId)` call for the focused row's task

#### Scenario: Arrow keys preview the focused row
- **WHEN** the user presses Arrow Up or Arrow Down in the task list
- **THEN** the focused row SHALL change
- **AND** the workspace SHALL receive an `openPreview(taskId)` call for the newly focused row's task

#### Scenario: j/k keys move focus only
- **WHEN** the user presses `j` or `k` in the task list
- **THEN** the focused row SHALL change
- **AND** the workspace SHALL NOT receive a tab-open call

#### Scenario: Shift-click bulk selection is unchanged
- **WHEN** the user shift-clicks a task row
- **THEN** the bulk multi-select behavior SHALL continue as defined in the existing Bulk Operations requirement
- **AND** the workspace SHALL NOT open a tab as a result of the shift-click
