## MODIFIED Requirements

### Requirement: Workspace context is consumed by the task detail header

The workspace context fields `label_branch` and `label_worktree` SHALL be
readable from any component via `useWorkspaceContext()`. The task detail
panel header SHALL consume these values to compare against the active
issue's `branch:` and `worktree:` labels and render mismatch warning chips
(see the `task-detail` spec for chip behaviour). This consumer SHALL be
additive to the existing workspace-scope filter chip on `FilterBar` and
SHALL NOT depend on whether that scope filter is enabled.

#### Scenario: Task detail reads workspace context
- **WHEN** any `TaskDetailPanel` mounts in a git-tracked project
- **THEN** it SHALL have access to `WorkspaceContext.label_branch` and `label_worktree` via `useWorkspaceContext()`

#### Scenario: Mismatch chip independent of scope filter
- **WHEN** the user has toggled the `FilterBar` workspace-scope chip off (widened view)
- **AND** opens an issue whose `branch:` label differs from `WorkspaceContext.label_branch`
- **THEN** the task detail header SHALL still render the branch mismatch chip
- **AND** the worktree axis SHALL be evaluated independently
