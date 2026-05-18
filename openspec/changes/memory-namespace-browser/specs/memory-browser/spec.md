## ADDED Requirements

### Requirement: Memory view in top navigation
The system SHALL provide a top-level "Memory" view that lets the user browse, search, create, and delete Ruflo memory entries across all namespaces. The view SHALL only be reachable when the Ruflo feature flag is enabled AND the `ruflo` CLI is found on PATH. When either gate is false, the view SHALL NOT be reachable from navigation and SHALL NOT be mounted.

#### Scenario: Memory view is reachable when both gates pass
- **WHEN** the Ruflo feature flag is enabled
- **AND** the `ruflo` CLI is found on PATH
- **THEN** a "Memory" entry SHALL appear in the top navigation alongside "All", "Focus", "Ready", "Health", and (when enabled) "OpenSpec"
- **AND** clicking it SHALL mount the Memory browser view

#### Scenario: Memory view is hidden when Ruflo flag is off
- **WHEN** the Ruflo feature flag is disabled
- **THEN** the "Memory" navigation entry SHALL NOT be rendered
- **AND** the Memory browser SHALL NOT be mounted

#### Scenario: Memory view is hidden when ruflo CLI is missing
- **WHEN** the Ruflo feature flag is enabled but `ruflo` is not found on PATH
- **THEN** the "Memory" navigation entry SHALL NOT be rendered

#### Scenario: Active Memory view redirects when a gate flips off
- **WHEN** the user is on the Memory view and either disables the Ruflo flag OR `ruflo` becomes unavailable
- **THEN** the active view SHALL automatically switch to "All"

### Requirement: Namespace tree built from pipe-delimited keys
The Memory view SHALL render a collapsible namespace tree in its left rail, derived by parsing each entry's pipe-delimited key into facets and grouping by the canonical hierarchy `branch:<b>` → `worktree:<w>` → `repo:<r>` → `openspec:<change>` → `issue:<id>` → `type:<t>`. Missing levels SHALL be skipped (a key without `openspec:` attaches directly under its `repo:` node). Each node SHALL display a count of entries beneath it. Entries with no parseable facets SHALL be bucketed under a synthetic root node labelled "(unparsed)".

#### Scenario: Canonical key produces nested nodes
- **WHEN** an entry has key `branch:feat/x|worktree:bs|repo:BeadSpec|openspec:memory-namespace-browser|issue:BEADSPEC-xqf|type:trajectory|ts:1700000000`
- **THEN** the tree SHALL contain nested nodes `branch:feat/x` → `worktree:bs` → `repo:BeadSpec` → `openspec:memory-namespace-browser` → `issue:BEADSPEC-xqf` → `type:trajectory`
- **AND** each ancestor node's count SHALL include this entry

#### Scenario: Partial key skips missing levels
- **WHEN** an entry's key is `branch:main|repo:BeadSpec|type:note`
- **THEN** the tree SHALL nest `branch:main` → `repo:BeadSpec` → `type:note` with no `worktree:` node in between

#### Scenario: Unparseable key bucketed under "(unparsed)"
- **WHEN** an entry's key has no `|` separator and no first-colon facet
- **THEN** that entry SHALL appear under a synthetic root node labelled "(unparsed)"

#### Scenario: Empty memory store
- **WHEN** the Ruflo memory store contains zero entries
- **THEN** the left rail SHALL be empty
- **AND** the right pane SHALL show the empty-state message "No memories yet. Click + Store to add one."

### Requirement: Selecting a namespace filters the right pane
Selecting any node in the namespace tree SHALL filter the right-pane list to entries whose key begins with that node's reconstructed prefix. The breadcrumb above the list SHALL show the active prefix.

#### Scenario: User clicks a leaf-level namespace
- **WHEN** the user clicks `type:trajectory` under `…|issue:BEADSPEC-xqf`
- **THEN** the right pane SHALL list only entries whose key starts with the reconstructed prefix ending in `type:trajectory`
- **AND** the breadcrumb SHALL show the full path with `›` separators

#### Scenario: User clicks the root
- **WHEN** the user clicks the root node (or clears the selection)
- **THEN** the right pane SHALL list all entries (up to the configured limit)
- **AND** the breadcrumb SHALL be empty or show "(all)"

#### Scenario: Selected namespace has no entries
- **WHEN** the user selects a namespace node and no entries match its prefix
- **THEN** the right pane SHALL show "No entries under this namespace."

### Requirement: Right-pane list shows key, score, timestamp, preview sorted by ts desc
Each row SHALL display: a truncated key, a score (or `—` outside search mode), a timestamp formatted as relative time when within 7 days else ISO date, and a 120-character preview of the body. The list SHALL be sorted by the parsed `ts:` facet in descending order; entries with no `ts:` SHALL sort to the bottom.

#### Scenario: Rows sorted by ts descending
- **WHEN** the list contains entries with `ts:1700000000` and `ts:1700000100`
- **THEN** the entry with `ts:1700000100` SHALL appear above the entry with `ts:1700000000`

#### Scenario: Entry with no ts
- **WHEN** an entry has no `ts:` facet
- **THEN** the timestamp column SHALL show "—"
- **AND** the row SHALL sort below all entries that do carry a `ts:` facet

#### Scenario: Long body preview truncated
- **WHEN** an entry's body exceeds 120 characters
- **THEN** the preview SHALL show the first 120 characters followed by an ellipsis

### Requirement: Detail drawer shows full content and parsed facets
Clicking a row SHALL open a detail drawer showing the raw key (copyable), each parsed facet as a labelled chip, the full body, the score (search mode only), an "Open issue" button when the key contains an `issue:<id>` facet, and a "Delete" action.

#### Scenario: Drawer renders parsed facets
- **WHEN** the user clicks a row whose key contains `branch:`, `worktree:`, `repo:`, `openspec:`, `issue:`, `type:` facets
- **THEN** the drawer SHALL render a labelled chip for each facet using the namespace-aware palette

#### Scenario: Open issue navigates to the task
- **WHEN** the entry's key contains `issue:BEADSPEC-xqf`
- **AND** the user clicks "Open issue"
- **THEN** the app SHALL navigate to that task identically to the existing `imported → EPIC-ID` pill (sets `view: 'all', taskId: 'BEADSPEC-xqf'`)

#### Scenario: Entry has no issue facet
- **WHEN** the entry's key contains no `issue:<id>` facet
- **THEN** the "Open issue" button SHALL NOT be rendered

### Requirement: Search swaps the right pane to results
The toolbar SHALL include a semantic search input. Submitting a query (Enter or 300 ms debounce after the last keystroke) SHALL call `rufloMemorySearch` and replace the right-pane list with the search results. A "Clear search" affordance SHALL restore namespace-list mode. The left rail counts SHALL remain based on the last namespace snapshot and SHALL NOT recompute from the search hits.

#### Scenario: Submitting a search swaps the pane
- **WHEN** the user types a non-empty query and presses Enter
- **THEN** the right pane SHALL list the results from `rufloMemorySearch`
- **AND** the breadcrumb SHALL show `Search: "<query>"`

#### Scenario: Clear search restores list mode
- **WHEN** the user clicks "Clear search" or empties the input and submits
- **THEN** the right pane SHALL restore the entries for the currently selected namespace

#### Scenario: Search returns no hits
- **WHEN** `rufloMemorySearch` returns an empty result
- **THEN** the right pane SHALL show "No matches for \"<query>\"."

### Requirement: Manual store via + Store dialog
The toolbar SHALL include a "+ Store" button that opens a modal dialog with a Key field (pre-filled with the selected namespace prefix + trailing `|`) and a multiline Value field. On submit, the app SHALL call `rufloMemoryStore(key, value)`. On success, the dialog SHALL close, the list query SHALL be invalidated, and the new entry SHALL appear in the list. On validation failure, an inline error SHALL be shown; on CLI failure, a toast SHALL surface the stderr.

#### Scenario: Store under the selected namespace
- **WHEN** the user has `branch:foo|repo:bar` selected
- **AND** clicks "+ Store"
- **THEN** the Key field SHALL be pre-filled with `branch:foo|repo:bar|`

#### Scenario: Empty value rejected client-side
- **WHEN** the user submits the dialog with an empty value
- **THEN** an inline "Value is required" error SHALL be shown
- **AND** `rufloMemoryStore` SHALL NOT be called

#### Scenario: Invalid character in key rejected client-side
- **WHEN** the user enters a key containing a space, semicolon, or backtick
- **THEN** an inline validation error SHALL be shown
- **AND** `rufloMemoryStore` SHALL NOT be called

#### Scenario: CLI failure surfaces in a toast
- **WHEN** `rufloMemoryStore` rejects with a non-empty stderr
- **THEN** a toast notification SHALL show the stderr text
- **AND** the dialog SHALL remain open with the user's input preserved

### Requirement: Per-entry delete with confirm
Each row SHALL expose a delete action that opens a confirm dialog showing the full key. Confirming SHALL call `rufloMemoryDelete(key)`. On success, the list query SHALL be invalidated. On failure, a toast SHALL surface the stderr.

#### Scenario: User deletes an entry
- **WHEN** the user clicks delete on a row and confirms
- **THEN** `rufloMemoryDelete` SHALL be called with that row's exact key
- **AND** on success, the entry SHALL disappear from the list within one query cycle

#### Scenario: User cancels a delete
- **WHEN** the user clicks delete and then Cancel
- **THEN** no IPC call SHALL be made
- **AND** the list SHALL be unchanged

### Requirement: Tauri commands wrap ruflo memory subcommands
The app SHALL expose three Tauri commands — `ruflo_memory_list(namespace_prefix, limit)`, `ruflo_memory_store(key, value)`, and `ruflo_memory_delete(key)` — that shell out to `ruflo memory list/store/delete` respectively. Each command SHALL validate inputs server-side before spawning. The frontend SHALL NOT invoke the ruflo CLI directly.

#### Scenario: List command builds expected argv
- **WHEN** `ruflo_memory_list` is called with `namespace_prefix = Some("branch:foo")` and `limit = Some(250)`
- **THEN** the spawned argv SHALL be exactly `["memory","list","--format","json","--prefix","branch:foo","--limit","250"]`

#### Scenario: List command default limit
- **WHEN** `ruflo_memory_list` is called with `limit = None`
- **THEN** the spawned argv SHALL include `["--limit","500"]`

#### Scenario: Store rejects invalid key
- **WHEN** `ruflo_memory_store` is called with a key containing `;`, `$`, `` ` ``, a space, or a newline
- **THEN** the command SHALL return an error
- **AND** no subprocess SHALL be spawned

#### Scenario: Store rejects empty value
- **WHEN** `ruflo_memory_store` is called with an empty value
- **THEN** the command SHALL return an error
- **AND** no subprocess SHALL be spawned

#### Scenario: Delete rejects empty key
- **WHEN** `ruflo_memory_delete` is called with an empty key
- **THEN** the command SHALL return an error
- **AND** no subprocess SHALL be spawned
