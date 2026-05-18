## MODIFIED Requirements

### Requirement: Ruflo memory panel in task detail
The task detail pane SHALL include a collapsible "Related memories" section that, when expanded, renders a 2-segment sub-tab control (Search / Trajectory). The sub-tab defaults to **Search**. The section SHALL only be rendered when **both** the Ruflo feature flag is enabled **and** `ruflo` is found on PATH. The **Search** sub-tab SHALL preserve all existing behavior: lazy free-form query using the task title and non-system labels, expand-in-place results, and exclusion of `session`/`default` namespaces. The **Trajectory** sub-tab is defined in the Added Requirements below. Sub-tab state SHALL reset to `search` whenever the active task changes.

#### Scenario: Sub-tab control appears when expanded
- **WHEN** the user clicks to expand "Related memories" in the task detail pane
- **THEN** a 2-segment control showing "Search" and "Trajectory" is rendered above the result list
- **AND** the "Search" segment is active by default

#### Scenario: Search sub-tab preserves all prior behavior
- **WHEN** the Search sub-tab is active
- **THEN** the panel behaves identically to the pre-change implementation (lazy IPC on first expand, label-augmented query, expand-in-place, `session`/`default` namespace exclusion)

#### Scenario: Sub-tab selection resets when active task changes
- **WHEN** the user navigates to a different task while the Trajectory sub-tab is active
- **THEN** the sub-tab resets to Search on the new task's panel
- **AND** both sub-tabs' caches are cleared

#### Scenario: Each sub-tab fetches lazily on first activation
- **WHEN** the user opens the panel (Search tab fires immediately on first expand)
- **AND** the user then clicks Trajectory for the first time
- **THEN** the Trajectory IPC call fires on that first click, not before
- **AND** returning to Search reuses the already-loaded Search results without re-fetching

#### Scenario: Ruflo disabled or not on PATH — panel hidden
- **WHEN** Ruflo is disabled in Settings or `ruflo` is not found on PATH
- **THEN** the entire "Related memories" section is not rendered (preserving prior behavior)

## ADDED Requirements

### Requirement: Trajectory sub-tab surfaces chronological audit entries
When the Trajectory sub-tab is active, the panel SHALL invoke `rufloMemorySearch` with the query `<title> type:trajectory issue:<taskId>` (dropping `<title>` if empty), filter results client-side to only entries whose `key` contains the segment `|type:trajectory|`, parse `|outcome:<value>` as the event-type chip and `|ts:<unix>` as the timestamp, and render entries sorted by `ts` descending (most recent first). Entries with no `ts` segment SHALL sort last. The Trajectory tab SHALL NOT apply the `session`/`default` namespace exclusion used by the Search tab.

#### Scenario: User opens Trajectory tab on an issue with multiple trajectory entries
- **WHEN** the user clicks the Trajectory sub-tab on an issue that has three trajectory memory entries with distinct `ts` values
- **THEN** all three entries render in `ts`-descending order
- **AND** each row shows an outcome chip, a relative timestamp with absolute ISO string on hover, and a truncated preview

#### Scenario: User clicks a trajectory row to expand it
- **WHEN** the user clicks a trajectory row
- **THEN** the full memory content expands in place below the row
- **AND** a second click collapses it; other rows remain unchanged

#### Scenario: Issue has no trajectory entries
- **WHEN** `rufloMemorySearch` returns results but none contain `|type:trajectory|` in their key
- **THEN** the empty-state blurb is shown: "No trajectory yet. The `openspec-beads-work` skill writes a trajectory entry when this issue is claimed, blocked, or closed."

#### Scenario: Result key has an unknown outcome value
- **WHEN** a trajectory entry's key contains `|outcome:custom-event|` and `custom-event` is not in the known palette
- **THEN** the outcome chip renders with the neutral fallback style
- **AND** the raw outcome string is accessible (e.g. via `title` attribute on the chip)

#### Scenario: Result key is missing the `ts` segment
- **WHEN** a trajectory entry's key does not contain a `|ts:<unix>|` segment
- **THEN** the row still renders, sorts below all entries that have a `ts`, and displays "—" in the timestamp slot

#### Scenario: Result key does not contain `|type:trajectory|`
- **WHEN** `rufloMemorySearch` returns an entry whose key contains `|type:retrospective|` with the same `issue:` segment
- **THEN** that entry is excluded from the Trajectory tab results

#### Scenario: Strict issue-id filter returns zero entries — fallback applies
- **WHEN** no result key contains both `|type:trajectory|` and `|issue:<taskId>|` for the current task
- **AND** results exist that contain only `|type:trajectory|`
- **THEN** those broader `type:trajectory` results are rendered and no error is shown

#### Scenario: IPC call fails on Trajectory tab
- **WHEN** `rufloMemorySearch` rejects or returns malformed JSON while the Trajectory tab is active
- **THEN** the error message "Could not load memories" is shown, matching the Search tab error behavior

#### Scenario: Trajectory tab is visited a second time for the same task
- **WHEN** the user switches from Trajectory to Search and then back to Trajectory on the same task
- **THEN** no new IPC call is made; the previously loaded trajectory results are reused
- **AND** the sort order and expanded state are preserved from the prior visit

#### Scenario: Multiple trajectory entries — one has `ts`, one does not
- **WHEN** two trajectory entries are loaded, one with a valid `|ts:1700000000|` and one with no `ts` segment
- **THEN** the entry with a valid `ts` renders first (most recent unless equal)
- **AND** the entry without `ts` renders last with "—" in the timestamp slot
