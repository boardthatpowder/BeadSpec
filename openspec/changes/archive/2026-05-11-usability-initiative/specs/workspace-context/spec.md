## ADDED Requirements

### Requirement: Auto-detect workspace context on project open
When a project is opened, the app SHALL run `get_workspace_context` (which shells `git rev-parse --abbrev-ref HEAD` in the project root) to determine the active branch. From the branch name and project path it SHALL derive the three mandatory beads labels: `branch:<HEAD>`, `worktree:<last-path-segment>`, `repo:<dir-name>`. If the project root is not a git repository, workspace context is unavailable and no auto-scope is applied.

#### Scenario: Git project opened — workspace context detected
- **WHEN** the user opens a project whose root is a git repository
- **THEN** the app resolves `branch:`, `worktree:`, and `repo:` label values and stores them in `AppState`

#### Scenario: Non-git project opened — workspace context unavailable
- **WHEN** the user opens a project whose root is not a git repository
- **THEN** no workspace context is set, no auto-scope chip is shown, and the task list loads unscoped

### Requirement: Auto-apply workspace scope filter chip
After workspace context is detected, the app SHALL automatically apply a compound filter that ANDs the three workspace labels (`branch:`, `worktree:`, `repo:`). This filter SHALL appear in the filter bar as a single "Workspace scope" chip that is visually distinct from manually added filters.

#### Scenario: Workspace scope chip applied on open
- **WHEN** workspace context is detected for an opened project
- **THEN** a "Workspace scope" filter chip appears in the filter bar and only tasks matching all three labels are shown in the list

#### Scenario: Workspace scope chip not applied if labels not present
- **WHEN** workspace context is detected but no tasks in the project carry any of the three workspace labels
- **THEN** the chip appears but shows a zero-match count indicator to signal the scope is active but empty

### Requirement: Scope toggle to widen view
The user SHALL be able to toggle the workspace scope off with one click to see all tasks in the project, and re-enable it with one click. The toggle state SHALL persist in `HashStateContext`.

#### Scenario: User widens scope
- **WHEN** the user clicks the "Workspace scope" chip toggle (or a dedicated "Show all" button)
- **THEN** the workspace scope filter is suspended and all project tasks are shown; the chip changes to a muted/disabled state to indicate scope is off

#### Scenario: User re-enables scope
- **WHEN** the workspace scope chip is in the disabled/muted state and the user clicks it
- **THEN** the workspace scope filter is re-applied and the list narrows again

#### Scenario: Scope state is URL-sharable
- **WHEN** workspace scope is toggled off and the user copies the URL hash
- **THEN** the hash encodes `workspaceScope=off` so a collaborator opening the same link also sees the widened view
