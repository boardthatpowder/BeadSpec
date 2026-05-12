# Layout & Shell Specification

## Purpose

Defines the top-level application shell: the Tauri window, multi-project switcher, resizable pane layout, density toggle, and cross-platform keyboard shortcut abstraction. This is the structural skeleton all other features mount into.

---

## Requirements

### Requirement: Resizable Multi-Pane Layout

The system SHALL render a three-region layout — top bar, left list panel, right workspace region — where the divider between the list panel and workspace is user-resizable and persisted across sessions. The right workspace region is itself a tree of one or more panes (see `task-workspace`) and its internal layout is persisted independently.

#### Scenario: User resizes the left list panel
- **WHEN** the user drags the divider between the list panel and the workspace region
- **THEN** both the list panel and the workspace SHALL resize in real time
- **AND** the new list-panel width SHALL be persisted to Tauri's app data store at `layout.json` → `taskListWidth`
- **AND** on next launch, the list panel SHALL restore to the persisted width

#### Scenario: User opens app for the first time
- **WHEN** no persisted layout exists
- **THEN** the layout SHALL default to: top bar ~72px, left panel 30% width, workspace region 70% width
- **AND** the workspace SHALL start with a single empty leaf pane (per `task-workspace`)

#### Scenario: Window is resized below minimum usable width
- **WHEN** the window width drops below 800px
- **THEN** the left panel SHALL collapse to an icon-only rail
- **AND** the workspace region SHALL occupy full remaining width

#### Scenario: Workspace internal layout is persisted independently
- **WHEN** the user changes the workspace internal layout (open/close tabs, split panes, resize splits)
- **THEN** those changes SHALL be persisted to `layout.json` → `workspace` (see `task-workspace`)
- **AND** the `taskListWidth` value SHALL NOT be affected

---

### Requirement: View Density Toggle

The system SHALL offer three view density modes — Compact, Comfortable, and Spacious — that adjust task row height, font size, and padding throughout the app.

#### Scenario: User changes density
- **WHEN** the user selects a density mode from the settings menu
- **THEN** the task list rows, detail panel, and all chrome elements SHALL update immediately without a reload
- **AND** the selected density SHALL persist across sessions

#### Scenario: Default density
- **WHEN** a new user launches the app for the first time
- **THEN** the density SHALL default to Comfortable

---

### Requirement: Multi-Project Switcher

The system SHALL allow the user to open and switch between multiple Beads projects within a single app window, each with its own independent data connection.

#### Scenario: User opens the project switcher
- **WHEN** the user clicks the project name in the top-left of the top bar or presses the project switcher shortcut
- **THEN** a dropdown or modal SHALL list all discovered Beads projects
- **AND** the active project SHALL be visually distinguished

#### Scenario: User switches to a different project
- **WHEN** the user selects a project from the switcher
- **THEN** the task list, filters, KPI bar, and detail panel SHALL all reload for the new project
- **AND** the previously selected project's connection SHALL remain pooled but idle
- **AND** any unsaved edits in the previous project SHALL prompt a confirmation dialog before switching

#### Scenario: User adds a project manually
- **WHEN** the user provides a path to a Beads project directory
- **THEN** the app SHALL attempt to connect to its Dolt SQL endpoint
- **AND** if successful, it SHALL be added to the project list and persisted

---

### Requirement: Cross-Platform Keyboard Shortcut Abstraction

The system SHALL use a platform-aware shortcut abstraction (`react-hotkeys-hook` with platform detection) for all keyboard shortcuts, ensuring correct Cmd/Ctrl mapping on macOS vs Windows/Linux.

#### Scenario: App runs on macOS
- **WHEN** a keyboard shortcut is defined as the primary modifier key + a letter
- **THEN** the primary modifier SHALL be Cmd (⌘)
- **AND** Ctrl SHALL NOT be used as the primary shortcut modifier on macOS

#### Scenario: App runs on Windows or Linux
- **WHEN** a keyboard shortcut is defined as the primary modifier key + a letter
- **THEN** the primary modifier SHALL be Ctrl
- **AND** Cmd SHALL NOT be referenced on non-macOS platforms

#### Scenario: Shortcuts are discoverable
- **WHEN** the user opens the keyboard shortcut reference (via `?` key or Help menu)
- **THEN** a modal SHALL display all shortcuts with platform-correct modifier labels

---

### Requirement: Filter State in URL/Hash

The system SHALL encode the active filter set, the current view, and the active task ID in the window location hash so that state is bookmarkable and supports browser-history-style navigation. The `taskId` in the hash is a one-way mirror of the active tab in the focused workspace pane — the workspace tree itself is NOT encoded in the hash.

#### Scenario: User applies a filter
- **WHEN** the user selects a filter combination
- **THEN** the URL hash SHALL update to encode that filter state
- **AND** the browser back button SHALL restore the previous filter state

#### Scenario: User shares a deep link
- **GIVEN** the user has a specific task selected and filters applied
- **WHEN** the user copies the app URL
- **THEN** pasting that URL into a new app window SHALL restore the exact filter state
- **AND** the indicated task SHALL be opened as a preview tab in a freshly seeded workspace

#### Scenario: App launches with a hash URL
- **WHEN** the app is launched with a pre-encoded hash URL
- **THEN** the app SHALL parse the hash and apply the filters
- **AND** if no persisted workspace exists, the app SHALL seed a single leaf with the hash's `taskId` opened as a preview tab
- **AND** if a persisted workspace exists, the hash's `taskId` SHALL be opened as a preview tab in the active pane (replacing any existing preview tab)

#### Scenario: Active tab changes update the hash
- **WHEN** the active tab in the focused pane changes (open, switch, close)
- **THEN** the hash's `taskId` SHALL be replaced (using `replaceState`, not `pushState`) to mirror the new active tab
- **AND** no extra browser history entry SHALL be created per tab switch

---

### Requirement: Skeleton Loaders and Optimistic Updates

The system SHALL use skeleton loaders for initial data fetches and optimistic updates for user-initiated mutations, with toast undo for destructive operations.

#### Scenario: Task list loads for the first time
- **WHEN** the task list is fetching from Dolt SQL
- **THEN** skeleton placeholder rows SHALL be shown instead of a spinner
- **AND** the skeleton SHALL match the approximate height of real task rows at the current density

#### Scenario: User changes a task status
- **WHEN** the user clicks to change a task's status
- **THEN** the UI SHALL immediately reflect the new status (optimistic update)
- **AND** the `bd` CLI command SHALL execute in the background
- **AND** if the command fails, the status SHALL revert and a toast error SHALL appear

#### Scenario: User deletes a task
- **WHEN** the user deletes a task
- **THEN** the task SHALL immediately disappear from the list (optimistic)
- **AND** a toast SHALL appear with an "Undo" button for 5 seconds
- **AND** if "Undo" is clicked, the deletion SHALL be cancelled and the task restored

---

### Requirement: Refresh button in TopBar
The TopBar SHALL include a Refresh button positioned after the existing right-side controls. The button SHALL show a loading indicator while queries are refetching.

#### Scenario: Refresh button is always visible
- **WHEN** the app is running
- **THEN** the Refresh button is visible in the TopBar regardless of the active view or feature flags

#### Scenario: Refresh button loading state
- **WHEN** a refresh is in progress
- **THEN** the Refresh button icon animates (e.g., spins) to signal active refetching

### Requirement: Settings button in TopBar
The TopBar SHALL include a Settings (gear icon) button positioned at the far right, after the Refresh button.

#### Scenario: Settings button is always visible
- **WHEN** the app is running
- **THEN** the Settings button is visible in the TopBar regardless of feature flag state

### Requirement: Changes view entry in top navigation
The top navigation bar SHALL include a "Changes" navigation entry that renders the `openspec-change-browser` view. It SHALL appear alongside the existing view entries (task list, smart views, etc.) and follow the same active/inactive visual treatment. The entry SHALL only be enabled when a project is connected **and** the OpenSpec feature flag is enabled.

#### Scenario: Changes nav entry visible with project connected
- **WHEN** a project is connected and OpenSpec is enabled in Settings
- **THEN** the "Changes" entry appears in the top navigation bar and is clickable

#### Scenario: Changes nav entry hidden when OpenSpec disabled
- **WHEN** OpenSpec is disabled in Settings
- **THEN** the "Changes" entry is not rendered in the ViewSwitcher

#### Scenario: View redirects if active when OpenSpec disabled
- **WHEN** the user is on the "Changes" view and disables OpenSpec in Settings
- **THEN** the active view switches to the default ("All") view automatically

#### Scenario: Changes nav entry disabled without project
- **WHEN** no project is connected
- **THEN** the "Changes" entry is either hidden or shown in a disabled state

#### Scenario: Changes view replaces list pane content
- **WHEN** the user clicks "Changes" in the navigation bar
- **THEN** the Changes browser view renders in the main content area; the detail pane remains visible if a task was open

### Requirement: KPI bar mode switching
The KPI bar SHALL support multiple display modes (counts, burndown, velocity) via a compact mode control. See the `velocity-burndown` spec for full chart requirements. The control SHALL not break the existing counts display — counts mode must remain the default and fully functional.

#### Scenario: Mode control renders without breaking existing counts display
- **WHEN** the app is opened and `velocity-burndown` feature is active
- **THEN** the KPI bar shows the existing count tiles with a mode toggle control appended; the counts are unchanged

#### Scenario: Mode selection persisted across sessions
- **WHEN** the user selects velocity mode and restarts the app
- **THEN** the KPI bar opens in velocity mode (read from `layout.json` via Tauri store)

### Requirement: Health view entry in navigation
The top navigation or a secondary navigation area SHALL provide access to the Health view (health checks + formulas browser). This MAY be implemented as a dedicated nav entry or as a sub-item under a "Tools" menu — the exact placement is left to implementation, but it SHALL be discoverable without opening the command palette.

#### Scenario: Health view reachable from navigation
- **WHEN** the user wants to access `bd preflight` / health checks
- **THEN** they can reach the Health view in at most 2 clicks from any state without using the command palette
