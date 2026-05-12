## ADDED Requirements

### Requirement: Auto-detect workspace context on project connect
The system SHALL call the `get_workspace_context()` Tauri command exactly once when a project is opened and store the result (`label_branch`, `label_worktree`, `label_repo`) in the Zustand project store before the connected view is rendered.

#### Scenario: Git project opened
- **WHEN** a user opens a project that is inside a git repository
- **THEN** `get_workspace_context()` SHALL be invoked during the project-connect action
- **AND** the returned `label_branch`, `label_worktree`, and `label_repo` strings SHALL be stored in the Zustand store under `workspaceContext`
- **AND** the store SHALL be populated before the first TaskList render

#### Scenario: Non-git project opened
- **WHEN** a user opens a project that is NOT inside a git repository
- **THEN** `get_workspace_context()` SHALL return null or empty data
- **AND** `workspaceContext` in the store SHALL be set to `null`
- **AND** no workspace scope chip SHALL be shown

#### Scenario: get_workspace_context invoked only once per project open
- **WHEN** a project is opened
- **THEN** `get_workspace_context()` SHALL be called exactly once during the connect action
- **AND** it SHALL NOT be called again during the session unless the project is closed and reopened

### Requirement: Workspace scope chip in FilterBar
The system SHALL render a single "Workspace scope" chip in FilterBar when workspace context is available, positioned before user-defined filter chips, with a visually distinct style.

#### Scenario: Workspace context available — chip shown
- **WHEN** a git project is opened and `workspaceContext` is non-null
- **THEN** a "Workspace scope" chip SHALL appear as the leftmost chip in FilterBar
- **AND** the chip SHALL use a visually distinct background (e.g. blue tint) differentiating it from user filter chips

#### Scenario: Workspace context unavailable — chip hidden
- **WHEN** `workspaceContext` is null (non-git project)
- **THEN** no workspace scope chip SHALL be shown in FilterBar

#### Scenario: Chip toggle — disable scope
- **WHEN** the workspace scope chip is active (`workspaceScope` is `'on'`) and the user clicks it
- **THEN** `workspaceScope` SHALL change to `'off'`
- **AND** the chip SHALL render in a dimmed/greyed style to communicate inactive state
- **AND** the workspace label AND-filter SHALL stop being applied to the task list

#### Scenario: Chip toggle — re-enable scope
- **WHEN** the workspace scope chip is inactive (`workspaceScope` is `'off'`) and the user clicks it
- **THEN** `workspaceScope` SHALL change to `'on'`
- **AND** the chip SHALL return to its active style
- **AND** the workspace label AND-filter SHALL be reapplied to the task list

### Requirement: URL-sharable workspace scope state
The system SHALL serialise the `workspaceScope` toggle state (`'on'` | `'off'`) in the URL hash via `HashStateContext` so the scope state survives refresh and is URL-sharable.

#### Scenario: Default scope is on
- **WHEN** a git project is opened and the URL hash contains no `workspaceScope` key
- **THEN** `workspaceScope` SHALL default to `'on'`
- **AND** the workspace AND-filter SHALL be active

#### Scenario: Scope state persists across refresh
- **WHEN** the user sets `workspaceScope` to `'off'` and refreshes the app
- **THEN** the URL hash SHALL encode `workspaceScope=off`
- **AND** after reload, the chip SHALL render in inactive/dimmed style
- **AND** the filter SHALL not be applied

#### Scenario: URL with workspaceScope=on shared to another user
- **WHEN** a URL with `workspaceScope=on` is opened on a different machine
- **THEN** the chip SHALL be shown if that machine's project also has a git workspace context
- **AND** the labels used for filtering SHALL be from that machine's own `get_workspace_context()` result

### Requirement: Workspace AND-filter in filter pipeline
The system SHALL apply a compound AND-filter on all three workspace labels (`label_branch` AND `label_worktree` AND `label_repo`) in `filterParser.ts` when `workspaceScope` is `'on'` and `workspaceContext` is non-null.

#### Scenario: Scope on — task matching all three labels passes
- **GIVEN** `workspaceScope` is `'on'` and workspace labels are `branch:main`, `worktree:beads-ui`, `repo:beads-ui`
- **WHEN** a task has labels including `branch:main`, `worktree:beads-ui`, and `repo:beads-ui`
- **THEN** the task SHALL pass the workspace filter and appear in the list

#### Scenario: Scope on — task missing one workspace label is excluded
- **GIVEN** `workspaceScope` is `'on'` and workspace labels are `branch:main`, `worktree:beads-ui`, `repo:beads-ui`
- **WHEN** a task has `branch:main` and `repo:beads-ui` but NOT `worktree:beads-ui`
- **THEN** the task SHALL be excluded from the task list

#### Scenario: Scope off — workspace filter not applied
- **GIVEN** `workspaceScope` is `'off'`
- **WHEN** the filter pipeline runs
- **THEN** the workspace AND-filter SHALL NOT be applied
- **AND** tasks are filtered only by user-defined filters

#### Scenario: User filters compose with workspace filter
- **GIVEN** `workspaceScope` is `'on'` and the user has added a `status: open` filter
- **WHEN** the filter pipeline runs
- **THEN** the workspace AND-filter SHALL be applied first (or equivalently composed)
- **AND** user filters SHALL further narrow the already-scoped set
