## MODIFIED Requirements

### Requirement: Paused banner on OpenSpec panel body
`OpenSpecPanelBody` SHALL render a `<PausedBanner>` sub-component as its **first child**, before the drift warning, whenever the active task's `labels` include `openspec:paused`. The banner SHALL display the most recent pause reason parsed from `task.notes` and — when a scope-change child can be detected — a clickable link to that child. The banner SHALL be rendered in the violet info-row aesthetic to visually distinguish it from the amber drift warning.

#### Scenario: Task is paused and notes contain a `Paused:` line
- **WHEN** `task.labels` includes `openspec:paused`
- **AND** `parsePausedNote(task.notes)` returns a non-null reason string
- **THEN** the banner renders above the drift warning
- **AND** the banner displays the reason string preceded by a `⏸` glyph

#### Scenario: Task is paused but notes contain no `Paused:` line
- **WHEN** `task.labels` includes `openspec:paused`
- **AND** `parsePausedNote(task.notes)` returns `null`
- **THEN** the banner still renders above the drift warning
- **AND** the banner displays the fallback copy `"(no reason recorded)"`

#### Scenario: Scope-change child detected via `Resolves:` note prefix (Signal A)
- **WHEN** `task.labels` includes `openspec:paused`
- **AND** a sibling task's notes contain a line matching `/^Resolves:\s*<task\.id>\b/`
- **THEN** the banner renders a `"Resolves: <child.id> — <child.title>"` button
- **AND** clicking the button navigates to the child task via `setState({ view: 'all', taskId: child.id })`

#### Scenario: Scope-change child detected via shared label + `blocks` dependency (Signal B)
- **WHEN** `task.labels` includes `openspec:paused`
- **AND** no sibling task carries a `Resolves: <task.id>` note prefix
- **AND** a sibling task shares the same `openspec:<change>` label AND has a Beads `blocks` dependency pointing at `task.id`
- **THEN** the banner renders a `"Resolves: <child.id> — <child.title>"` button using that sibling
- **AND** if multiple candidates qualify, the most recently created one is used

#### Scenario: No scope-change child detected
- **WHEN** `task.labels` includes `openspec:paused`
- **AND** `findScopeChangeChild` returns `null` (neither signal resolves)
- **THEN** the banner renders the reason text
- **AND** a muted `"No scope-change child detected yet"` note is shown instead of a child link

#### Scenario: Task is not paused
- **WHEN** `task.labels` does not include `openspec:paused`
- **THEN** `<PausedBanner>` renders nothing (null return)
- **AND** the drift warning renders in its usual position as the first visible child
