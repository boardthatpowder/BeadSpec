## ADDED Requirements

### Requirement: Dolt history entries are interleaved in the activity feed

The system SHALL fetch Dolt row-history diffs for the current issue and interleave them with beads task_history entries in the activity tab, merged in reverse chronological order by timestamp.

#### Scenario: Dolt history available
- **GIVEN** `get_dolt_history_for_issue` returns one or more `DoltRevision` entries
- **WHEN** the user opens the "Activity" tab
- **THEN** each `DoltRevision` SHALL appear in the feed at its correct chronological position relative to beads history entries
- **AND** each Dolt entry SHALL display a "Dolt" source badge, the short commit hash (`to_commit` first 7 chars), and the commit date

#### Scenario: Dolt history unavailable
- **GIVEN** `get_dolt_history_for_issue` returns an empty array (Dolt not running, no history, or query error)
- **WHEN** the user opens the "Activity" tab
- **THEN** the activity feed SHALL show only beads task_history entries without any error message or placeholder for Dolt history

---

### Requirement: Dolt revision entry shows field-level diffs

Each `DoltRevision` in the activity feed SHALL display a table of field-level changes showing field name, before value, and after value.

#### Scenario: Field changed between commits
- **GIVEN** a `DoltRevision` has a `FieldDiff` entry for the `status` field with `from_value: "open"` and `to_value: "in-progress"`
- **WHEN** the user views the activity feed
- **THEN** the Dolt revision entry SHALL show: field name "status", from value "open" styled as removed, to value "in-progress" styled as added

#### Scenario: Field was NULL (row created)
- **GIVEN** a `DoltRevision` has a `FieldDiff` with `from_value: null`
- **THEN** the before cell SHALL display "—" (em dash) indicating no prior value

#### Scenario: Field became NULL (row deleted)
- **GIVEN** a `DoltRevision` has a `FieldDiff` with `to_value: null`
- **THEN** the after cell SHALL display "—" (em dash)

---

### Requirement: Dolt source badge is visually distinct

The "Dolt" source badge on Dolt revision entries SHALL use a color distinct from beads history entry styling to allow quick visual scanning of the mixed timeline.

#### Scenario: Mixed beads and Dolt entries
- **GIVEN** the activity feed contains both beads history entries and Dolt revision entries
- **WHEN** the user views the feed
- **THEN** beads entries and Dolt entries SHALL be visually distinguishable by badge color or label without needing to read the full entry content
