## MODIFIED Requirements

### Requirement: Task List Display and Sorting
The system SHALL display tasks in the left panel as a scrollable, sortable list with configurable columns. Tasks SHALL be fetched from the backend in pages; the frontend SHALL NOT apply a hardcoded row cap and SHALL NOT perform sorting or filtering on the full local dataset.

#### Scenario: Default task list display
- **WHEN** a project is loaded with no filters
- **THEN** tasks SHALL be displayed with: ID, title, status badge, priority indicator, and label chips
- **AND** tasks SHALL default-sort by priority descending, then creation date descending, then ID ascending
- **AND** the initial page SHALL contain at most 200 tasks
- **AND** if the project has more than 200 tasks, a "Load more" trigger or infinite scroll SHALL fetch subsequent pages

#### Scenario: User sorts by a column
- **WHEN** the user clicks a column header (e.g., Status, Priority, Title)
- **THEN** the sort parameters SHALL be sent to the backend as part of the next `get_tasks` request
- **AND** the list SHALL display results sorted by that column, toggling ascending/descending on repeated clicks
- **AND** the TanStack Query cache key SHALL change to reflect the new sort, triggering a fresh fetch

#### Scenario: Task list shows real-time updates
- **WHEN** a real-time sync event arrives for a task visible in the current list
- **THEN** that task row SHALL update in place without the list re-sorting or losing scroll position
- **AND** if a task no longer matches the active filters after the update, it SHALL animate out

#### Scenario: Large project shows all tasks
- **WHEN** a project contains more than 2000 tasks
- **THEN** all tasks SHALL be reachable via pagination
- **AND** the task count displayed in the KPI bar SHALL reflect the actual total, not the page size

---

## ADDED Requirements

### Requirement: Server-Side Filter, Sort, and Pagination
The `get_tasks` backend command SHALL accept filter, sort, and pagination parameters and execute them in SQL; it SHALL NOT return more rows than the requested page size.

#### Scenario: Filtered request executes filter in SQL
- **WHEN** the frontend sends a `get_tasks` request with status or label filters
- **THEN** the backend SHALL apply those filters in the WHERE clause
- **AND** SHALL return only matching rows (up to the page limit)
- **AND** SHALL return a `total_count` reflecting the filtered count

#### Scenario: Paginated request returns cursor for next page
- **WHEN** the frontend sends a `get_tasks` request with `limit` set
- **THEN** the backend SHALL return at most `limit` tasks
- **AND** if more tasks exist, SHALL return a `next_cursor` (opaque, encodes the last row's sort key)
- **AND** the frontend can pass `next_cursor` as `after_cursor` in the next request to fetch the following page

#### Scenario: TanStack Query keys include all server-side filter params
- **WHEN** the user changes any filter, sort, or page cursor
- **THEN** the TanStack Query cache key SHALL change to include the new params
- **AND** filtered and unfiltered views SHALL maintain independent cache entries
- **AND** no stale filter data SHALL bleed across key changes
