## ADDED Requirements

### Requirement: Session snapshot list
The Sessions sub-tab of the Health view SHALL render a chronological list (newest first) of session snapshots returned by `list_session_snapshots(project_path)`. Each row SHALL display the snapshot's timestamp, an auto/manual marker derived from whether the snapshot name begins with `auto-`, and any derived metadata available from the snapshot manifest (issue count, files-changed count) when present.

#### Scenario: Snapshots exist
- **WHEN** `ruflo session list --json` returns one or more snapshots
- **THEN** the Sessions tab renders one row per snapshot, newest first
- **AND** each row shows the formatted timestamp, the `auto` or `manual` marker, and metadata summary fields when present in the snapshot manifest

#### Scenario: No snapshots
- **WHEN** `ruflo session list --json` returns an empty array
- **THEN** the Sessions tab displays "No session snapshots yet. Snapshots are created automatically when a Claude Code session ends."

#### Scenario: Ruflo CLI is not installed
- **WHEN** the `ruflo` binary cannot be resolved on PATH
- **THEN** the Sessions tab displays a "Ruflo CLI not configured" empty state with an install hint, identical in shape to the "bd CLI not found" state on the Checks tab

### Requirement: Snapshot detail drawer
Clicking a snapshot row SHALL open a side drawer rendered from the right. The drawer SHALL display the snapshot's name, formatted created-at timestamp, full metadata JSON in a monospace pre-formatted block, and two action buttons: "View memory entries from this session" and "Restore conversation context".

#### Scenario: User clicks a snapshot row
- **WHEN** the user clicks a row in the Sessions list
- **THEN** a drawer slides in from the right showing the snapshot's name, created-at, and metadata
- **AND** both action buttons are visible and enabled

#### Scenario: User dismisses the drawer via Escape
- **WHEN** the drawer is open and the user presses Escape
- **THEN** the drawer closes without navigating away from the Sessions tab

#### Scenario: User dismisses the drawer via backdrop
- **WHEN** the drawer is open and the user clicks outside the drawer panel
- **THEN** the drawer closes without navigating away from the Sessions tab

### Requirement: View memory entries for a session
The "View memory entries from this session" action SHALL compute a `[from, to)` timestamp window — `from` is the selected snapshot's `created_at`; `to` is the next-newer snapshot's `created_at`, or the current time if no newer snapshot exists — and navigate to the Memory view pre-filtered by that window. The window lower bound SHALL be clamped to `now - 30 days`. When the window span exceeds 7 days, a hint SHALL be shown in the drawer: "Window may include earlier sessions."

#### Scenario: Selected snapshot is not the most recent
- **WHEN** the user activates the action on a snapshot that has a newer sibling
- **THEN** the Memory view opens filtered to `[from, next_created_at)`

#### Scenario: Selected snapshot is the most recent
- **WHEN** the user activates the action on the newest snapshot
- **THEN** the Memory view opens filtered to `[from, now)`

#### Scenario: Memory view does not yet honour filter params
- **WHEN** the Memory view does not implement the `ts_from` / `ts_to` query params
- **THEN** the action SHALL copy a key fragment `|ts:<from>-<to>|` to the clipboard and show a toast explaining the fallback

### Requirement: Restore conversation context via clipboard
The "Restore conversation context" action SHALL copy the snapshot's ID to the system clipboard and display a toast instructing the user to paste it into a fresh Claude Code session as `ruflo session restore <id>`. BeadSpec SHALL NOT invoke `ruflo session restore` itself.

#### Scenario: User activates restore action
- **WHEN** the user clicks "Restore conversation context"
- **THEN** the snapshot's ID is written to the system clipboard
- **AND** a toast appears with the text: "Snapshot ID copied. Paste into a fresh Claude Code session: `ruflo session restore <id>`"

#### Scenario: Clipboard write fails
- **WHEN** the clipboard write API rejects (e.g. permissions denied)
- **THEN** a fallback toast displays the full snapshot ID so the user can copy it manually

### Requirement: Manual refresh
The Sessions tab SHALL provide a "Refresh" button that re-invokes `list_session_snapshots`. The list SHALL NOT auto-refresh on a timer.

#### Scenario: User clicks Refresh
- **WHEN** the user clicks the Refresh button
- **THEN** `list_session_snapshots(project_path)` is invoked again and the list re-renders with any newly added snapshots

#### Scenario: Refresh while a previous call is in flight
- **WHEN** the user clicks Refresh while a fetch is still pending
- **THEN** the Refresh button SHALL be disabled until the current fetch resolves
