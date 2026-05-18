## ADDED Requirements

### Requirement: GitNexus index status badge in top bar

The top bar SHALL display a badge summarizing the active project's GitNexus index freshness, color-coded by age. Badge state is sourced from `get_gitnexus_status(project_path)` polled every 60 seconds via TanStack Query. The badge SHALL NOT render when no project is active.

#### Scenario: Index is fresh
- **WHEN** `get_gitnexus_status` returns a `last_analyzed_ts` within the last 30 minutes
- **THEN** the badge chip uses the green palette
- **AND** the label reads `"Index: <age>"` where age is a human-readable string (e.g., `"14m"`)

#### Scenario: Index is aging
- **WHEN** `get_gitnexus_status` returns a `last_analyzed_ts` between 30 minutes and 4 hours ago
- **THEN** the badge chip uses the amber palette
- **AND** the label reads `"Index: <age>"`

#### Scenario: Index is stale
- **WHEN** `get_gitnexus_status` returns a `last_analyzed_ts` more than 4 hours ago
- **THEN** the badge chip uses the red palette
- **AND** the label reads `"Index: <age>"`

#### Scenario: Index status is unavailable
- **WHEN** `npx gitnexus status` exits non-zero AND no `.gitnexus/` directory exists at the project root
- **THEN** the badge chip renders in the neutral-grey palette
- **AND** the label reads `"Index: unknown"`

#### Scenario: User opens the popover
- **WHEN** the user clicks the badge chip
- **THEN** a popover opens anchored to the chip
- **AND** the popover displays the last-analyzed ISO timestamp (e.g., `"2026-05-17 09:42 (14m ago)"`)
- **AND** the popover displays the symbol, relationship, and process counts on a single row
- **AND** the popover displays a "Re-analyze" button

#### Scenario: Popover when status is unavailable
- **WHEN** the user opens the popover AND `last_analyzed_ts` is null AND all counts are 0
- **THEN** the popover shows a GitNexus install hint instead of the counts row

#### Scenario: User triggers Re-analyze
- **WHEN** the user clicks "Re-analyze" AND `is_running` is false
- **THEN** `run_gitnexus_analyze(project_path)` starts
- **AND** the Re-analyze button becomes disabled
- **AND** progress chunks from `gitnexus_analyze_progress` events stream into the popover with an elapsed-seconds counter
- **AND** on `gitnexus_analyze_complete`, the badge re-fetches `get_gitnexus_status` and the popover returns to idle state

#### Scenario: Re-analyze is already running
- **WHEN** the user clicks "Re-analyze" while `is_running` is true
- **THEN** the button is disabled (this state SHALL be prevented before the click is possible)
- **AND** the popover shows the running elapsed counter

#### Scenario: Status auto-refreshes
- **WHEN** 60 seconds elapse since the last successful fetch
- **THEN** the badge re-fetches `get_gitnexus_status` without any user action
- **AND** the badge color and label update to reflect the new age

#### Scenario: Backend concurrency guard
- **WHEN** `run_gitnexus_analyze` is called for a project_path that already has an analysis in progress
- **THEN** the command returns `Err("already_running")`
- **AND** no second `npx gitnexus analyze` process is started for that project path
