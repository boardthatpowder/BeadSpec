## ADDED Requirements

### Requirement: Process list with search and cluster filter
The `ProcessBrowser` view SHALL display a scrollable, virtualized list of GitNexus execution flows fetched via `list_gitnexus_processes`. The list SHALL support substring search (150ms debounce) on process name and filtering by cluster via a `<select>` populated from `list_gitnexus_clusters`. Processes SHALL be grouped by cluster in the frontend; group headers SHALL use the cluster name. The view SHALL be gated on a project being connected; no OpenSpec feature flag is required.

#### Scenario: List populates from backend on mount
- **WHEN** a project is connected and the user navigates to the Processes view
- **THEN** `list_gitnexus_processes` and `list_gitnexus_clusters` are called in parallel
- **AND** the process list renders grouped by cluster within 2 seconds on a warm run
- **AND** the cluster filter is populated with the returned cluster names plus an "all" option

#### Scenario: Search filters by substring
- **WHEN** the user types into the search input
- **THEN** after a 150ms debounce the list is filtered to processes whose name contains the search string (case-insensitive)
- **AND** the cluster grouping is preserved on the filtered results

#### Scenario: Cluster filter narrows results
- **WHEN** the user selects a specific cluster from the filter dropdown
- **THEN** only processes belonging to that cluster are shown in the list
- **AND** the search filter applies within the selected cluster

#### Scenario: Empty state when no project is connected
- **WHEN** no project is connected
- **THEN** the Processes view renders an empty-state placeholder (e.g., "Connect a project to explore execution flows")
- **AND** no IPC calls are made

#### Scenario: Loading skeleton during fetch
- **WHEN** `list_gitnexus_processes` is in flight
- **THEN** a loading skeleton or spinner is displayed in the list area
- **AND** the detail pane is not rendered

---

### Requirement: Stepped execution-trace detail pane
Selecting a process from the list SHALL display a detail pane with: the process name as heading, cluster badge, step count, and a virtualized stepped list. Each step row SHALL show the step number, symbol name, `file:line` (monospace), and a truncated snippet (≤120 chars). If a snippet is absent the frontend SHALL fall back to the function signature line. The step list SHALL virtualize with `@tanstack/react-virtual` to handle large flows.

#### Scenario: Detail renders on process click
- **WHEN** the user clicks a process in the list
- **THEN** `get_gitnexus_process` is called for that process name
- **AND** the detail pane renders with heading, cluster badge, step count, and step rows

#### Scenario: Each step shows symbol / file:line / snippet
- **WHEN** the detail pane renders a process with N steps
- **THEN** each step row displays: step number (1-based), symbol name, `file:line` in monospace font, and the truncated snippet or signature fallback

#### Scenario: Missing snippet falls back to signature line
- **WHEN** a step in the GitNexus response has no docstring snippet
- **THEN** the step row displays the function signature line instead
- **AND** no blank or missing snippet column is rendered

#### Scenario: Very long flows virtualize without dropping rows
- **WHEN** a process has more than 100 steps
- **THEN** the list is virtualized and all rows are accessible via scrolling
- **AND** no rows are silently dropped

#### Scenario: Error state on backend failure
- **WHEN** `get_gitnexus_process` returns an error
- **THEN** the detail pane renders an inline error message with a Retry button
- **AND** the process list remains interactive

---

### Requirement: Find issues touching this process
The detail pane SHALL include a **Find issues** button. When activated, it SHALL open a popover showing up to 20 Beads issues whose branch diff (via `find_issues_touching_process`) intersects the process's file set, sorted by overlap size descending. Each row SHALL display the issue title and overlap count. Clicking a row SHALL navigate to that issue in `TaskDetailPanel`.

#### Scenario: Popover lists matching issues sorted by overlap
- **WHEN** the user clicks `Find issues` on a selected process
- **THEN** `find_issues_touching_process` is called for that process
- **AND** the popover opens showing up to 20 issue rows sorted by overlap-count descending
- **AND** each row shows the issue title and the number of overlapping files

#### Scenario: Clicking a row navigates to the issue
- **WHEN** the user clicks an issue row in the popover
- **THEN** the popover closes and the app navigates to that issue via `setState({ view: 'all', taskId })`
- **AND** `TaskDetailPanel` opens on the clicked issue

#### Scenario: Empty state when no issues match
- **WHEN** `find_issues_touching_process` returns an empty list
- **THEN** the popover shows an empty-state message (e.g., "No open issues touch this process")
- **AND** no error is raised

---

### Requirement: Open in editor cross-link
The detail pane SHALL include an **Open in editor** button that, when a step is focused, opens the step's `file:line` in the user's preferred editor via the existing `openPath` Tauri shell helper. The button SHALL be disabled when no step is focused. On shell-open failure, a toast SHALL display the error; the view SHALL not crash.

#### Scenario: Focused step opens in editor
- **WHEN** the user focuses a step row and clicks `Open in editor`
- **THEN** `openPath` is called with `${absoluteFile}:${line}:0`
- **AND** the user's preferred editor opens at the specified file and line

#### Scenario: Button is disabled with no step focused
- **WHEN** no step in the detail pane is focused
- **THEN** the `Open in editor` button is rendered in a disabled state
- **AND** clicking it has no effect

#### Scenario: Shell open failure shows toast
- **WHEN** `openPath` returns an error (e.g., editor not found)
- **THEN** a toast notification displays the error message
- **AND** the view remains functional

---

### Requirement: Stale-index notice and Re-analyze CTA
The Processes view SHALL display a banner when the GitNexus index age exceeds 4 hours. The banner SHALL include a **Re-analyze** button that triggers a background `npx gitnexus analyze` run via `trigger_gitnexus_reanalyze`. Progress SHALL be communicated via Tauri events (`gitnexus_reanalyze_progress`) and displayed as a toast. The process list SHALL refresh on completion. When the `gitnexus-index-freshness-badge` capability is present, the banner SHALL subscribe to its shared store instead of making a redundant IPC call.

#### Scenario: Banner appears when index is stale
- **WHEN** `get_gitnexus_index_status` returns `stale: true` (age > 4h)
- **THEN** the stale-index banner is rendered at the top of the Processes view
- **AND** the banner displays the approximate index age

#### Scenario: Re-analyze runs and list refreshes
- **WHEN** the user clicks `Re-analyze` in the banner
- **THEN** `trigger_gitnexus_reanalyze` is called
- **AND** a toast shows progress as `gitnexus_reanalyze_progress` events are received
- **AND** on the `finished` event the process list re-fetches and the banner clears

#### Scenario: Banner suppressed when index is fresh
- **WHEN** `get_gitnexus_index_status` returns `stale: false`
- **THEN** the stale-index banner is not rendered

#### Scenario: Banner reuses freshness-badge store when available
- **WHEN** the `gitnexus-index-freshness-badge` capability is present and its store reports a fresh index
- **THEN** `StaleIndexBanner` reads from the shared store without calling `get_gitnexus_index_status`
- **AND** no redundant IPC call is made

---

### Requirement: GitNexus CLI absence is non-fatal
When `npx gitnexus` is unavailable (not installed or not on PATH), the Processes view SHALL render an install-hint card explaining how to install GitNexus (`npm install -g gitnexus`). All other views (Health, OpenSpec, Task List, etc.) SHALL be unaffected. No crash or unhandled error SHALL propagate to the Tauri process.

#### Scenario: Install-hint card replaces list when CLI unavailable
- **WHEN** `list_gitnexus_processes` returns an error indicating `gitnexus` is not found
- **THEN** the process list area renders an install-hint card with installation instructions
- **AND** the error is not propagated to other views

#### Scenario: Other views unaffected
- **WHEN** `npx gitnexus` is unavailable
- **THEN** navigating away from Processes to any other view (Health, Task List, OpenSpec) works normally
- **AND** no global error state is set

---

### Requirement: Deep-linkable process selection
The active process SHALL be encoded in the URL hash as `processId=<name>` alongside `view=processes`. Loading the app with a `processId` hash SHALL pre-select that process. Switching the active process SHALL update the hash via `window.history.replaceState` (not `pushState`). An unknown `processId` SHALL fall back to the list-only view without error.

#### Scenario: Hash with processId opens correct process on load
- **WHEN** the app is opened with hash `#view=processes&processId=auth-login-flow`
- **THEN** the Processes view renders with `auth-login-flow` pre-selected in the list and its detail pane loaded

#### Scenario: Switching process updates hash via replaceState
- **WHEN** the user clicks a different process in the list
- **THEN** the URL hash is updated to reflect the new `processId`
- **AND** the browser back-stack is NOT extended (replaceState, not pushState)

#### Scenario: Unknown processId falls back to list-only
- **WHEN** the hash contains `processId=unknown-process-xyz`
- **THEN** the Processes view renders with the full list and no detail pane selected
- **AND** no error is displayed
