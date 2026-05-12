## ADDED Requirements

### Requirement: Dependency lineage in Ready to Start view
Each task row in the "Ready to Start" smart view SHALL display inline contextual information about why it became ready (i.e. which dependency or dependencies recently closed) and which other tasks it directly unblocks. This lineage is derived from the task's `dependents` array (tasks it blocks) and `dependencies` array (tasks it depends on), already present in `TaskDetail`.

#### Scenario: Task shows what it was unblocked by
- **WHEN** a task appears in the Ready to Start view and it had one or more blocking dependencies
- **THEN** each recently closed dependency is shown as a small chip below the task title (e.g. "Unblocked by: beads-12 · beads-15")

#### Scenario: Task with no dependencies shown without lineage
- **WHEN** a task in the Ready to Start view has no dependencies (was never blocked)
- **THEN** no "Unblocked by" line is shown — the row renders at normal height

#### Scenario: Task shows what it unblocks
- **WHEN** a task in the Ready to Start view has dependents (tasks that depend on it)
- **THEN** a "Unblocks: N tasks" indicator appears below the title; clicking it expands to list those task ids as navigable chips

#### Scenario: Lineage chips are navigable
- **WHEN** the user clicks a dependency or dependent chip in the lineage row
- **THEN** the app navigates to that task's detail pane (same behavior as clicking any task id reference)
