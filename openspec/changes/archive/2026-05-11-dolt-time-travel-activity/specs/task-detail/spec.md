## ADDED Requirements

### Requirement: Activity tab interleaves Dolt diffs with beads history

The system SHALL call `get_dolt_history_for_issue` when the activity tab is opened and merge the returned `DoltRevision` entries with existing beads `task_history` entries into a single chronological feed.

#### Scenario: Activity tab shows interleaved feed
- **WHEN** the user opens the "Activity" tab for a task
- **THEN** the activity feed SHALL contain both beads history entries and any Dolt revision entries, sorted in reverse chronological order
- **AND** each entry type SHALL display its source label (beads entries show existing display; Dolt entries show "Dolt" badge)

#### Scenario: No Dolt history — feed unchanged
- **GIVEN** `get_dolt_history_for_issue` returns an empty array
- **WHEN** the user opens the "Activity" tab
- **THEN** the activity feed SHALL display exactly the beads task_history entries as before, with no visual change or error state
