## ADDED Requirements

### Requirement: Activity feed view

The system SHALL provide a top-level "Activity" view rendering a chronological list of `ActivityEvent` rows sourced from the `workflow:activity` Tauri event topic, seeded on mount by the `list_recent_events` command. The view SHALL be reachable from the top navigation bar whenever a project is connected.

#### Scenario: New event appears after bd close

- **WHEN** a bd issue is closed in the terminal
- **THEN** a `bd.close` row SHALL appear in the Activity feed within 2 seconds, showing the issue's kind badge and summary

#### Scenario: Empty state

- **WHEN** no events have been emitted since app launch and no ruflo memory rows with `type:event` exist
- **THEN** the feed SHALL display an "No activity yet" empty-state message and no rows

#### Scenario: Backend unavailable

- **WHEN** `list_recent_events` throws an error on mount
- **THEN** an error toast SHALL appear with a "Retry" action
- **AND** the feed SHALL not crash or show a blank white screen

#### Scenario: Events older than 7 days are absent

- **WHEN** the ring buffer contains an event whose `ts` is more than 7 days in the past
- **THEN** that event SHALL NOT be returned by `list_recent_events` and SHALL NOT appear in the feed

---

### Requirement: Kind multi-select filter

The feed SHALL provide a multi-select filter by event source (`bd`, `hook`, `gitnexus`) whose state is persisted in the URL hash under the key `activityKinds` as a comma-separated list.

#### Scenario: User selects a subset of sources

- **WHEN** the user activates the `hook` filter chip only
- **THEN** only rows with `source == "hook"` SHALL be visible; all other rows are hidden

#### Scenario: Deselect all shows everything

- **WHEN** no source filter chips are active
- **THEN** all rows SHALL be visible regardless of source

#### Scenario: Filter state round-trips across reload

- **WHEN** the user activates a filter and reloads the app
- **THEN** the previously selected filter SHALL be restored from the URL hash

---

### Requirement: Time-range pills

The feed SHALL offer three mutually exclusive time-range pills: "Last hour", "Today", and "Week". The active selection SHALL be persisted in the URL hash under the key `activityRange`. The default SHALL be "Today".

#### Scenario: "Last hour" pill narrows correctly

- **WHEN** the user selects "Last hour"
- **THEN** only events with `ts` within the last 60 minutes SHALL be visible

#### Scenario: "Week" pill shows full 7-day horizon

- **WHEN** the user selects "Week"
- **THEN** events from the past 7 days (up to the ring-buffer horizon) SHALL be visible

#### Scenario: Default range is "Today" on first load

- **WHEN** the app is opened with no `activityRange` hash key
- **THEN** the "Today" pill SHALL be selected and the feed shows events from today only

#### Scenario: Range selection persists in hash

- **WHEN** the user selects "Week" and reloads
- **THEN** "Week" SHALL be selected on reload

---

### Requirement: Auto-follow / jump-to-latest

The feed SHALL auto-pin to the latest (bottom) row by default. Auto-follow SHALL disengage when the user scrolls more than 50px above the bottom, and a "Jump to latest" pill SHALL appear. Clicking the pill SHALL re-engage auto-follow and scroll to the bottom.

#### Scenario: New event auto-scrolls while pinned

- **WHEN** auto-follow is engaged and a new event arrives on `workflow:activity`
- **THEN** the feed SHALL scroll to bring the new row into view without user action

#### Scenario: User scroll disables auto-follow

- **WHEN** the user scrolls upward more than 50px from the bottom of the feed
- **THEN** auto-follow SHALL disengage
- **AND** a "Jump to latest" pill SHALL appear in the bottom-right corner

#### Scenario: Jump-to-latest pill re-engages auto-follow

- **WHEN** the "Jump to latest" pill is visible and the user clicks it
- **THEN** the feed SHALL scroll to the bottom
- **AND** auto-follow SHALL re-engage
- **AND** the pill SHALL disappear

---

### Requirement: Row expansion

Each row SHALL be expandable to show the full `detail` JSON payload, pretty-printed and selectable. Expanding one row SHALL NOT collapse others (multiple rows may be expanded simultaneously).

#### Scenario: Row expands on click

- **WHEN** the user clicks a row's summary area
- **THEN** the row expands to reveal the `detail` JSON payload in a `<pre>` block

#### Scenario: Expanded row collapses on second click

- **WHEN** an expanded row's summary area is clicked again
- **THEN** the expanded `detail` section collapses

#### Scenario: Detail JSON is selectable

- **WHEN** a row is expanded
- **THEN** the text in the `<pre>` block SHALL be selectable for copy

---

### Requirement: 7-day persistence horizon

The ring buffer SHALL retain events for at most 7 days, enforced by evicting stale entries during each `push()` call. Underlying ruflo memory rows are NOT deleted — eviction affects only the in-process ring buffer.

#### Scenario: Eviction occurs during push

- **WHEN** a new event is pushed to the ring buffer and older events exceed the 7-day threshold
- **THEN** those older events SHALL be removed from the buffer before the new event is inserted

#### Scenario: Evicted events remain in ruflo memory

- **WHEN** an event is evicted from the ring buffer
- **THEN** the underlying ruflo memory row SHALL still be retrievable via `ruflo memory search`
