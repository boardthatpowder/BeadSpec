## ADDED Requirements

### Requirement: All standalone dashboard views use PanelHeader
Every standalone dashboard view (ActivityFeed, MemoryBrowser, ProcessBrowser, SessionsTab, EpicDashboard, WorkerFindingsPanel) SHALL render a `<PanelHeader>` at the top of the view with at minimum a `title` prop. The header SHALL have a `border-b border-[--color-border]` bottom separator and consistent `px-5 py-4` padding matching `ChangesBrowser`.

#### Scenario: ActivityFeed shows PanelHeader
- **WHEN** the ActivityFeed view is displayed
- **THEN** a PanelHeader with title "Activity Feed" and the filter controls in the `filters` slot appears at the top

#### Scenario: MemoryBrowser shows PanelHeader
- **WHEN** the MemoryBrowser view is displayed
- **THEN** a PanelHeader with title "Memory" and action buttons in the `actions` slot appears at the top

#### Scenario: ProcessBrowser shows PanelHeader
- **WHEN** the ProcessBrowser view is displayed
- **THEN** a PanelHeader with title "Processes" and the Re-analyze button in the `actions` slot appears

#### Scenario: PanelHeader separates header from content
- **WHEN** any dashboard with PanelHeader is displayed
- **THEN** a visible border separator divides the header from the content area below

### Requirement: All dashboard loading states use Skeleton or spinner
Every dashboard view SHALL use `<TaskRowSkeleton>` (for list views) or an animated `<Icon name="Loader2" className="animate-spin">` (for panel views) while data is loading. No view SHALL render a bare `"Loading…"` text string.

#### Scenario: ActivityFeed shows skeletons while loading
- **WHEN** the ActivityFeed is fetching initial data
- **THEN** skeleton rows appear instead of a "Loading…" text string

#### Scenario: ProcessBrowser shows spinner while loading
- **WHEN** the ProcessBrowser is fetching processes
- **THEN** a centered spinner icon appears instead of a "Loading…" text string

### Requirement: All dashboard empty states use EmptyState component
Every dashboard view SHALL use `<EmptyState>` from `src/components/ui/EmptyState.tsx` when there is no data to display. No view SHALL render a bare one-line text string as its empty state.

#### Scenario: ActivityFeed empty state is guided
- **WHEN** the ActivityFeed has no events to display
- **THEN** an EmptyState with an icon, title "No activity yet", and a description is shown

#### Scenario: WorkerFindingsPanel empty state includes call to action
- **WHEN** WorkerFindingsPanel has no findings
- **THEN** EmptyState shows an icon, "No findings" title, and describes how to generate findings

### Requirement: All dashboard error states use ErrorState component
Every dashboard view SHALL use `<ErrorState>` from `src/components/ui/ErrorState.tsx` when a data fetch fails. No view SHALL render `String(error)` or `{String(error)}` directly into the DOM.

#### Scenario: ActivityFeed shows recoverable error
- **WHEN** the ActivityFeed data fetch fails
- **THEN** an ErrorState with a "Try again" button appears, and clicking it triggers a refetch

#### Scenario: ProcessBrowser shows recoverable error
- **WHEN** the ProcessBrowser data fetch fails
- **THEN** an ErrorState with a retry button appears instead of a raw error string

### Requirement: All icon-only buttons have tooltips
Every button that renders only an icon (no visible text label) SHALL be wrapped in `<IconButton>` from `src/components/ui/IconButton.tsx` or `<Tooltip>` from `src/components/ui/Tooltip.tsx` providing an accessible label. No icon-only button SHALL use a raw `title=` HTML attribute.

#### Scenario: ActivityRow raw title replaced with Tooltip
- **WHEN** an ActivityRow action button is hovered
- **THEN** a Tooltip appears with the button's label (not a native browser tooltip)

#### Scenario: WorkerFindingsPanel button has Tooltip
- **WHEN** the copy-finding button in WorkerFindingsPanel is hovered
- **THEN** a Tooltip appears with an accessible label

### Requirement: User-triggered mutations provide toast feedback
Every mutation triggered by a user action SHALL provide a toast notification on success or failure via `useToast()`. Background polling operations MAY be intentionally silent with a `// intentionally silent:` comment explaining the reason.

#### Scenario: MemoryBrowser delete shows success toast
- **WHEN** the user deletes a memory entry and it succeeds
- **THEN** a success toast appears confirming deletion

#### Scenario: MemoryBrowser delete shows error toast on failure
- **WHEN** the user triggers a delete mutation and it fails
- **THEN** an error toast appears with the failure description

#### Scenario: SessionsTab clipboard copy gives feedback
- **WHEN** the user clicks "Copy session context" and copy succeeds
- **THEN** a success toast appears confirming the copy

#### Scenario: ProcessBrowser re-analyze gives feedback
- **WHEN** the user clicks "Re-analyze" and the operation dispatches
- **THEN** a toast appears indicating re-analysis has started

### Requirement: All timestamps use shared date formatting helpers
Every timestamp displayed in the app SHALL use `formatRelative(ts)` or `formatAbsolute(ts)` from `src/lib/format/date.ts`. No component SHALL call `toLocaleString()`, `toLocaleDateString()`, `toLocaleTimeString()`, or implement its own relative-time formatting.

#### Scenario: ActivityRow shows relative time via formatRelative
- **WHEN** an ActivityRow renders its timestamp
- **THEN** it uses `formatRelative` to show "2 hours ago" style output

#### Scenario: SessionsTab shows formatted date via formatAbsolute
- **WHEN** a session snapshot card shows its creation date
- **THEN** it uses `formatAbsolute` to show a consistent locale-aware date string

### Requirement: All status/priority/risk color maps use palette library
Every component that renders a colored badge, chip, or dot for status, priority, risk, or outcome SHALL source its colors from `STATUS_PALETTE`, `PRIORITY_PALETTE`, `RISK_PALETTE`, or `OUTCOME_PALETTE` in `src/lib/palettes.ts`. No component SHALL define its own inline color map for these values.

#### Scenario: TaskListItem uses STATUS_PALETTE
- **WHEN** a TaskListItem renders a status badge
- **THEN** it reads the color classes from `STATUS_PALETTE[status]` rather than a local map

#### Scenario: ImpactPanel uses RISK_PALETTE
- **WHEN** ImpactPanel renders a risk level indicator
- **THEN** it reads from `RISK_PALETTE[riskLevel]` rather than its own `RISK_CLASS` map
