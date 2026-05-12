## MODIFIED Requirements

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
