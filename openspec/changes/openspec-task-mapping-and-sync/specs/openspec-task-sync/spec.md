## ADDED Requirements

### Requirement: Structural task-number label on imported child issues
The `openspec-beads-import` skill SHALL apply a label of the form `task:N.M` to every Beads child issue it creates from a `tasks.md` entry, in addition to the existing `openspec:<change-id>` label and the standard branch/worktree/repo context labels. The `N.M` portion SHALL match the dotted-decimal task number on the corresponding `- [ ] N.M ...` line in `tasks.md`. The child issue title SHALL also begin with `N.M ` followed by a short description.

#### Scenario: Import tags each child with its task number
- **WHEN** an agent runs `openspec-beads-import` on a change whose `tasks.md` contains `- [ ] 4.8 Unit tests: terminal rows are not re-processed`
- **THEN** the created child issue carries a `task:4.8` label and its title begins with `4.8 `

#### Scenario: Context labels are still applied
- **WHEN** import runs in a worktree
- **THEN** each child issue carries the four labels `openspec:<change-id>`, `task:N.M`, `branch:<name>`, `worktree:<name>`, `repo:<name>`

### Requirement: Label-first task-number resolution
Code paths that resolve a Beads issue's task number from an `openspec:<slug>` child issue (currently `reconcile_tasks_checkboxes`, plus the new `get_change_task_mapping`) SHALL first look for a label matching `^task:` and strip the prefix. If no `task:` label exists they SHALL fall back to extracting an `N.M` prefix from the issue title via `extract_task_num`. An issue with neither a `task:` label nor a parseable `N.M` title prefix SHALL be treated as **unbound**.

#### Scenario: Label-tagged issue resolves via label
- **WHEN** an issue has a `task:2.1` label and a prose title `Rewritten as something else`
- **THEN** the resolver returns `Some("2.1")`

#### Scenario: Untagged issue with N.M title falls back to title
- **WHEN** an issue has no `task:` label and title `1.1 First task`
- **THEN** the resolver returns `Some("1.1")`

#### Scenario: Untagged issue with prose title is unbound
- **WHEN** an issue has no `task:` label and title `Task 1: CouponsPoller implementation`
- **THEN** the resolver returns `None` and the issue is treated as unbound

#### Scenario: Reconcile uses label precedence
- **WHEN** `reconcile_tasks_checkboxes` runs on a change with one closed `task:1.1`-labelled issue
- **THEN** the `- [ ] 1.1 ...` line in `tasks.md` is flipped to `- [x] 1.1 ...` regardless of that issue's title text

### Requirement: Per-change task mapping query
The backend SHALL expose a Tauri command `get_change_task_mapping(project_path, change_slug) -> ChangeTaskMapping` that returns, in `tasks.md` order, every numbered task in the change together with its bound Beads issue ID (or `None`), the issue's status, the task description, and the markdown checkbox state. The response SHALL also include a boolean `has_legacy_orphans` that is `true` when **any** non-epic child issue carrying the `openspec:<slug>` label resolves to `None` via the precedence in the previous requirement.

#### Scenario: Mapping for a well-formed import
- **WHEN** a change has three numbered tasks (1.1, 1.2, 2.1) and three children labelled `task:1.1`, `task:1.2`, `task:2.1`
- **THEN** the response contains three entries each with `beads_issue_id = Some(...)` and `has_legacy_orphans = false`

#### Scenario: Mapping reports unmapped task
- **WHEN** `tasks.md` lists 1.1 and 1.2 but only `task:1.1` exists in beads
- **THEN** the 1.2 entry has `beads_issue_id = None` and `has_legacy_orphans = false`

#### Scenario: Mapping reports legacy orphans
- **WHEN** the change has an `openspec:<slug>` child whose title is `Task 1: ...` and no `task:` label
- **THEN** `has_legacy_orphans` is `true`

#### Scenario: Mapping preserves tasks.md order
- **WHEN** `tasks.md` lists tasks out of numerical order (e.g. 2.1 before 1.3 because the author reorganized sections)
- **THEN** the response preserves the file order, not numerical sort order

### Requirement: Forward-only sync action for missing tasks
The backend SHALL expose a Tauri command `sync_missing_beads_tasks(project_path, change_slug, epic_id) -> SyncMissingResult` that creates one Beads child issue for every numbered task in `tasks.md` whose mapping is currently unbound. Each new issue SHALL be created via the `bd` CLI (not direct SQL), titled `N.M <description>`, tagged `openspec:<slug>`, `task:N.M`, and the three context labels, and linked to `epic_id` via `bd dep add`. The command SHALL refuse with a clearly-typed error when the change's `has_legacy_orphans` is `true`, creating nothing.

#### Scenario: Creates only unbound tasks
- **WHEN** the change has four numbered tasks of which two are already bound
- **THEN** sync creates exactly two new issues and returns their IDs in `SyncMissingResult.created`

#### Scenario: Each created issue carries the structural label
- **WHEN** sync creates a new issue for task 5.3
- **THEN** that issue's labels include `task:5.3`, `openspec:<slug>`, and the three context labels

#### Scenario: Each created issue is linked to the epic
- **WHEN** sync creates a new issue
- **THEN** a dependency edge `new-issue → epic_id` exists in beads

#### Scenario: Refuses on legacy orphans
- **WHEN** the change has `has_legacy_orphans = true` (e.g. a `Task 1: ...` titled child)
- **THEN** the command returns an error with a message identifying the legacy state, and no new issues are created

#### Scenario: Idempotent re-run
- **WHEN** sync runs twice in a row without `tasks.md` changing between runs
- **THEN** the second invocation creates zero new issues
