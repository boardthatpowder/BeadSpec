## ADDED Requirements

### Requirement: Task mapping disclosure on imported change cards
Each ChangeCard that has been imported (i.e. `get_change_beads_progress` returns a non-null `epic_id`) SHALL render an expandable "View tasks" disclosure below the progress bars. The disclosure SHALL be collapsed by default and SHALL lazy-fetch the mapping (via `get_change_task_mapping`) on first expansion. Cards for changes that have not been imported SHALL NOT render the disclosure.

#### Scenario: Disclosure appears only after import
- **WHEN** a change has been imported and the card renders
- **THEN** an expandable "View tasks" disclosure is visible below the progress bars

#### Scenario: Disclosure hidden before import
- **WHEN** a change has no imported epic (the `Import to beads` button is showing)
- **THEN** no task mapping disclosure is rendered

#### Scenario: Mapping is lazy-loaded
- **WHEN** a card initially renders
- **THEN** no `get_change_task_mapping` IPC call is made for that card until the user expands the disclosure

#### Scenario: Mapping refetches on cache invalidation
- **WHEN** the user closes a task via the existing task-cache invalidation flow while the disclosure is expanded
- **THEN** the mapping refetches and the affected row's status badge updates within one sync cycle

### Requirement: Task mapping panel content
When expanded, the disclosure SHALL render a row per numbered task from `tasks.md`, in file order, with: the task number `N.M`, a truncated description, a status badge derived from the bound issue's bd status (or "—" if unbound), and a clickable issue ID that opens that issue in the task detail panel.

#### Scenario: Bound row links to the issue
- **WHEN** task 4.8 is bound to issue `cna-1m0tf`
- **THEN** clicking the issue chip on row 4.8 navigates to that issue in the task detail panel

#### Scenario: Unbound row shows em-dash placeholder
- **WHEN** task 5.3 has no bound issue (none of the change's children resolve to "5.3")
- **THEN** the row's issue cell renders an em-dash and no chip

#### Scenario: Row order matches tasks.md
- **WHEN** `tasks.md` lists 2.1 before 1.3 because the author reorganized sections
- **THEN** the panel's row order matches the file order

### Requirement: Sync-missing affordance on the mapping panel
When the expanded panel reports `has_legacy_orphans = false` and at least one task is unbound, the panel SHALL render a `Sync N missing tasks` button (where N is the count of unbound tasks). Clicking it SHALL invoke `sync_missing_beads_tasks` and, on success, invalidate the task cache and refetch the mapping. When `has_legacy_orphans = true` the button SHALL NOT render; instead the panel SHALL render a muted message indicating an older-style import was detected and sync is disabled. When every task is bound the panel SHALL render neither the button nor the message.

#### Scenario: Sync button appears when forward gap exists
- **WHEN** a change has new-style imports plus 2 tasks added to `tasks.md` after import
- **THEN** the panel shows `Sync 2 missing tasks`

#### Scenario: Sync click creates issues and refreshes
- **WHEN** the user clicks the sync button
- **THEN** the command runs, the task cache invalidates, and the panel re-renders with each previously-unbound row now showing a bound issue chip

#### Scenario: Legacy import disables sync
- **WHEN** a change has any child issue with the `openspec:<slug>` label that cannot be resolved to an `N.M` task
- **THEN** the panel renders a muted "Older-style import detected — sync disabled" message in place of the sync button, and no `sync_missing_beads_tasks` IPC call is reachable from the UI for that card

#### Scenario: Fully bound mapping shows neither affordance
- **WHEN** every task in `tasks.md` is bound and `has_legacy_orphans = false`
- **THEN** the panel renders the task table only, with no footer button or message
