## ADDED Requirements

### Requirement: Inter-change dependency chips on change cards
Each `ChangeCard` SHALL surface the OpenSpec changes it is blocked by and the OpenSpec changes it is blocking, derived from epic-level Beads dependencies between the changes' associated epics. The card SHALL fetch this data only when the change already has an imported epic (i.e. `ChangeBeadsProgress.epic_id` is non-null), via a Tauri command `get_change_dependencies(project_path, change_slug)`. Only direct (one-hop) dependencies SHALL be shown; transitive traversal is out of scope. Only epics carrying an `openspec:<slug>` label SHALL be considered — dependencies to non-OpenSpec epics SHALL be filtered out by the backend. A change SHALL NOT appear as its own upstream or downstream link.

#### Scenario: Change is blocked by another change's epic
- **WHEN** change A's epic has a Beads dependency on change B's epic (i.e. `bd dep add EPIC-A EPIC-B`, meaning A is blocked by B)
- **THEN** change A's card displays a "Blocked by" chip labelled with change B's slug
- **AND** change B's card displays a "Blocking" chip labelled with change A's slug

#### Scenario: Change has no imported epic
- **WHEN** a change has no Beads epic carrying its `openspec:<slug>` label
- **THEN** the card makes no `get_change_dependencies` IPC call
- **AND** no dependency section is rendered on the card

#### Scenario: Change has an epic but no inter-change dependencies
- **WHEN** a change's epic has no Beads dependencies on, or from, other epics carrying any `openspec:*` label
- **THEN** the dependency section is hidden entirely (no "Blocked by" or "Blocking" rows, no empty-state placeholder)

#### Scenario: Dependency points to a non-OpenSpec epic
- **WHEN** a change's epic has a Beads dependency on an epic that does not carry an `openspec:<slug>` label
- **THEN** that dependency is omitted from the response and not shown on the card

#### Scenario: User clicks a dependency chip
- **WHEN** the user clicks any chip in the "Blocked by" or "Blocking" rows
- **THEN** the app navigates to the related change's epic in `TaskDetailPanel`, identical to the existing `imported → EPIC-ID` pill (i.e. sets `view: 'all', taskId: <related-epic-id>`)

#### Scenario: Dependency target slug has no matching change directory
- **WHEN** a dependency chip references a slug whose `openspec/changes/<slug>/` directory no longer exists (e.g., the change was deleted but its epic remains)
- **THEN** the chip still renders using the slug from the Beads label, and clicking it still navigates to the related epic

#### Scenario: Dependencies update after `bd dep add` / `bd dep remove`
- **WHEN** a user adds or removes a Beads dependency between two OpenSpec epics while the Changes view is open
- **THEN** the affected `ChangeCard`(s) re-fetch and re-render their dependency chips within one task-cache refresh cycle (no manual reload required)
