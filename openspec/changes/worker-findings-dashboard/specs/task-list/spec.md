## MODIFIED Requirements

### Requirement: Task List Display and Sorting

The system SHALL display tasks in the left panel as a scrollable, sortable list with configurable columns. Each row SHALL also render a worker-provenance chip when the issue's notes are prefixed by the canonical worker-finding pattern (see `worker-findings` capability).

#### Scenario: Default task list display
- **WHEN** a project is loaded with no filters
- **THEN** tasks SHALL be displayed with: ID, title, status badge, priority indicator, and label chips
- **AND** tasks SHALL default-sort by priority descending, then creation date descending

#### Scenario: User sorts by a column
- **WHEN** the user clicks a column header (e.g., Status, Priority, Title)
- **THEN** the list SHALL sort by that column, toggling ascending/descending on repeated clicks

#### Scenario: Task list shows real-time updates
- **WHEN** a real-time sync event arrives for a task visible in the current list
- **THEN** that task row SHALL update in place without the list re-sorting or losing scroll position
- **AND** if a task no longer matches the active filters after the update, it SHALL animate out

#### Scenario: Worker-filed issue shows a provenance chip
- **WHEN** an issue's notes begin with `Auto-filed by ruflo-<worker> on `
- **THEN** the task row SHALL render a teal worker-provenance chip showing the worker name (e.g. `security-audit`) before any label chips
- **AND** the chip SHALL use the existing `LABEL_CHIP_COLORS.worker` palette
- **AND** the chip's `title` attribute SHALL be the full first line of the notes
- **AND** the chip SHALL NOT consume one of the two visible-label slots, and SHALL NOT be counted in the `+N` overflow indicator

#### Scenario: Issue notes do not match the worker-finding pattern
- **WHEN** an issue's notes are empty, missing, or do not begin with the canonical prefix
- **THEN** no provenance chip is rendered for that row
- **AND** the row's existing chip layout is unchanged

#### Scenario: Worker name contains hyphens
- **WHEN** the worker token is `test-gap-detector` (or any hyphenated lowercase identifier)
- **THEN** the chip text SHALL render the worker name verbatim (no truncation of the hyphen-separated parts)
- **AND** the chip SHALL still match the teal palette
