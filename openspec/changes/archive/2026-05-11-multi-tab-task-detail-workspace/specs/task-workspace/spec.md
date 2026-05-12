## ADDED Requirements

### Requirement: Preview Tab Semantics

The system SHALL open tasks in a transient *preview* tab when the user is skimming, where each leaf pane holds at most one preview tab at a time. Opening a different task into preview SHALL replace the existing preview tab — it SHALL NOT add a new tab — so the tab bar does not grow while the user browses.

#### Scenario: User single-clicks a task row
- **WHEN** a leaf pane has no preview tab and the user single-clicks a task row in the list
- **THEN** the task SHALL open as a preview tab in the active pane
- **AND** the tab title SHALL render in italic with reduced background opacity to indicate preview state
- **AND** the tab SHALL become the active tab in that pane

#### Scenario: User single-clicks a second task while a preview is open
- **GIVEN** the active pane has an unpromoted preview tab for Task A
- **WHEN** the user single-clicks Task B in the list
- **THEN** the preview tab for Task A SHALL be replaced by a preview tab for Task B
- **AND** the total tab count in the pane SHALL remain unchanged

#### Scenario: User navigates with arrow keys
- **WHEN** the user presses Arrow Up or Arrow Down in the task list
- **THEN** the focused row SHALL change in the list
- **AND** the focused task SHALL open as a preview tab in the active pane (replacing any existing preview tab)
- **AND** the list SHALL scroll to keep the focused row visible

#### Scenario: User navigates focus-only with j/k keys
- **WHEN** the user presses `j` or `k` in the task list
- **THEN** the focused row SHALL change in the list
- **AND** the active pane SHALL NOT open a preview (focus-only navigation)

---

### Requirement: Pinned Tab Promotion

The system SHALL promote a preview tab into a *pinned* (persistent) tab in response to any explicit-open gesture or any first edit performed inside that tab's `TaskDetailPanel`.

#### Scenario: User double-clicks a task row
- **WHEN** the user double-clicks a task row in the list
- **THEN** the task SHALL open in the active pane as a pinned tab
- **AND** if a preview tab for that task already exists in the active pane, it SHALL be promoted in place

#### Scenario: User presses Enter on a focused row
- **WHEN** the user presses `Enter` while a task row is focused in the list
- **THEN** the focused task SHALL be opened in the active pane as a pinned tab (promoted if already preview)

#### Scenario: User double-clicks the tab title
- **WHEN** the user double-clicks the title of a preview tab in the tab bar
- **THEN** the tab SHALL be promoted to pinned
- **AND** the tab title SHALL render in non-italic style

#### Scenario: User edits any field inside a preview tab
- **WHEN** the user changes any persisted field (title, status, priority, assignee, label add/remove, description content, comment submit) on a preview tab
- **THEN** the tab SHALL be promoted to pinned before the mutation is sent

#### Scenario: User drags a preview tab to reorder
- **WHEN** the user drags a preview tab within the tab bar
- **THEN** the tab SHALL be promoted to pinned before the reorder is committed

#### Scenario: Pinned tabs are not replaced by previewing
- **GIVEN** the active pane has a pinned tab for Task A and a preview tab for Task B
- **WHEN** the user single-clicks Task C in the list
- **THEN** the preview tab for Task B SHALL be replaced by a preview tab for Task C
- **AND** the pinned tab for Task A SHALL remain unchanged

---

### Requirement: Tab Close Actions

The system SHALL allow individual tabs and groups of tabs to be closed via mouse, keyboard, and the tab context menu.

#### Scenario: User clicks the close button on a tab
- **WHEN** the user clicks the × on a tab
- **THEN** that tab SHALL be removed from the pane
- **AND** the closed tab SHALL be pushed onto the recently-closed stack
- **AND** the active tab SHALL advance to the right neighbor, or to the left neighbor if no right neighbor exists, or to `null` if the pane is now empty

#### Scenario: User middle-clicks a tab
- **WHEN** the user middle-clicks anywhere on a tab body
- **THEN** the tab SHALL be closed identically to clicking the close button

#### Scenario: User invokes Close on the active tab via shortcut
- **WHEN** the user presses the primary modifier + `W` (Cmd+W on macOS, Ctrl+W elsewhere)
- **THEN** the active tab of the active pane SHALL be closed

#### Scenario: User opens the tab context menu
- **WHEN** the user right-clicks a tab
- **THEN** a context menu SHALL appear with: Close, Close Others, Close to the Right, Close All, Split Right, Split Down
- **AND** pressing Escape or clicking outside SHALL dismiss the menu

#### Scenario: User selects "Close Others"
- **WHEN** the user selects Close Others on a tab
- **THEN** all other tabs in that pane SHALL be closed
- **AND** the selected tab SHALL remain and be active
- **AND** all closed tabs SHALL be pushed onto the recently-closed stack

#### Scenario: User selects "Close to the Right"
- **WHEN** the user selects Close to the Right on a tab
- **THEN** all tabs whose index is greater than the selected tab SHALL be closed
- **AND** the selected tab SHALL remain active

#### Scenario: User selects "Close All"
- **WHEN** the user selects Close All in a pane
- **THEN** every tab in that pane SHALL be closed
- **AND** the pane SHALL render the empty-state placeholder

---

### Requirement: Recently Closed Stack

The system SHALL maintain a bounded last-in-first-out stack of recently closed tabs and SHALL allow the most recently closed tab to be reopened.

#### Scenario: User reopens a closed tab via shortcut
- **GIVEN** the user has closed one or more tabs in the current session
- **WHEN** the user presses the primary modifier + Shift + `T` (Cmd+Shift+T on macOS, Ctrl+Shift+T elsewhere)
- **THEN** the most recently closed tab SHALL be popped from the stack and reopened
- **AND** if the original pane still exists, the tab SHALL reopen in that pane at its original index
- **AND** if the original pane no longer exists, the tab SHALL reopen in the active pane as the rightmost tab
- **AND** the reopened tab SHALL retain its pinned/preview status from the time of closing

#### Scenario: Stack capacity
- **WHEN** the recently-closed stack reaches its capacity (20 entries)
- **THEN** the oldest entry SHALL be discarded as a new entry is pushed

#### Scenario: Empty stack
- **WHEN** the user presses the reopen shortcut with no entries in the stack
- **THEN** nothing SHALL happen and no error SHALL be shown

---

### Requirement: Drag to Reorder Tabs Within a Pane

The system SHALL allow tabs within a single pane to be reordered by drag and drop, with keyboard accessibility for the reorder gesture.

#### Scenario: User drags a tab to a new position
- **WHEN** the user drags a tab to the left or right within the same pane
- **THEN** the tab SHALL be reinserted at the drop position
- **AND** the new order SHALL persist across reloads
- **AND** if the dragged tab was a preview tab, it SHALL be promoted to pinned

#### Scenario: User drags a tab outside the source pane
- **WHEN** the user drags a tab and releases outside the source pane's tab bar
- **THEN** the drop SHALL be cancelled
- **AND** the dragged tab SHALL remain at its original position

---

### Requirement: Split Panes

The system SHALL allow the active pane to be split horizontally (right) or vertically (down), producing a sibling empty pane in a binary split tree, with independently resizable sizes that persist across reloads.

#### Scenario: User splits the active pane to the right
- **WHEN** the user invokes Split Right (via context menu or Cmd/Ctrl+\)
- **THEN** the active leaf pane SHALL be wrapped in a horizontal `SplitPane` with two children
- **AND** the original tabs SHALL stay in the original (left) child
- **AND** the new (right) child SHALL be an empty leaf pane and become the active pane
- **AND** the split SHALL initialize at 50/50 sizes

#### Scenario: User splits the active pane downward
- **WHEN** the user invokes Split Down (via context menu or Cmd/Ctrl+Shift+\)
- **THEN** the active leaf pane SHALL be wrapped in a vertical `SplitPane` with two children
- **AND** the original tabs SHALL stay in the original (top) child
- **AND** the new (bottom) child SHALL be an empty leaf pane and become the active pane

#### Scenario: User drags a split resize handle
- **WHEN** the user drags the resize handle between two children of a split
- **THEN** the two children SHALL resize in real time
- **AND** the new sizes SHALL persist to the workspace store after the drag ends
- **AND** on next launch the same sizes SHALL be restored

#### Scenario: Auto-collapse when a split child empties via close-batch action
- **GIVEN** a `SplitPane` with two leaf children, one of which has just been emptied by Close Others or Close to the Right
- **WHEN** the close action completes
- **AND** the just-emptied child is not the root
- **THEN** the empty child SHALL be removed and the surviving child SHALL replace the parent split

#### Scenario: Empty leaf is preserved when emptied one tab at a time
- **GIVEN** a non-root leaf pane that the user empties by individually closing each tab
- **WHEN** the last tab is closed
- **THEN** the pane SHALL remain in place and render the empty-state placeholder
- **AND** the user MAY explicitly close the pane via Cmd/Ctrl+W (which closes the pane itself, not a tab, when no tabs remain)

#### Scenario: Root leaf is never removed
- **WHEN** every tab in the root leaf pane is closed
- **THEN** the root leaf SHALL remain and render the empty-state placeholder

---

### Requirement: Active Pane Focus

The system SHALL track which leaf pane is *active* and SHALL route keyboard shortcuts, list interactions, and new tab opens to the active pane.

#### Scenario: User clicks inside a pane
- **WHEN** the user clicks anywhere inside a leaf pane (tab bar, detail panel, or empty-state placeholder)
- **THEN** that pane SHALL become the active pane
- **AND** the active pane SHALL render with a visible 2px accent border to indicate focus

#### Scenario: Opening a new tab targets the active pane
- **WHEN** a tab-open action is triggered (preview or pinned)
- **THEN** the tab SHALL open in the active pane only

#### Scenario: Active pane after split
- **WHEN** a split completes
- **THEN** the newly created sibling pane SHALL become the active pane

---

### Requirement: Keyboard Shortcuts for Tab and Pane Navigation

The system SHALL provide platform-aware keyboard shortcuts for tab and pane management via `react-hotkeys-hook`.

#### Scenario: User cycles tabs within the active pane
- **WHEN** the user presses `Ctrl+Tab`
- **THEN** the active tab in the active pane SHALL advance to the next tab, wrapping at the end
- **AND** pressing `Ctrl+Shift+Tab` SHALL move to the previous tab, wrapping at the start

#### Scenario: User jumps to a tab by index
- **WHEN** the user presses the primary modifier + a digit 1 through 9 (Cmd+1..9 on macOS, Ctrl+1..9 elsewhere)
- **THEN** the active pane SHALL switch to the Nth tab (1-indexed)
- **AND** if the pane has fewer than N tabs, nothing SHALL happen

#### Scenario: Shortcuts are discoverable
- **WHEN** the user opens the keyboard shortcut reference modal
- **THEN** all workspace shortcuts (Close Tab, Reopen, Split Right, Split Down, Next/Prev Tab, Jump to Tab N) SHALL be listed with platform-correct modifier labels

---

### Requirement: Workspace Persistence

The system SHALL persist the workspace tree, active pane, tab order, pinned flags, split sizes, and recently-closed stack to the Tauri app data store, and SHALL restore them on next launch.

#### Scenario: Workspace persists across reload
- **GIVEN** the user has multiple tabs across split panes
- **WHEN** the user reloads or restarts the app
- **THEN** the same pane tree, tab order, active tab per pane, pinned/preview flags, and split sizes SHALL be restored

#### Scenario: Cold boot with no persisted workspace
- **WHEN** the app starts with no `workspace` key in `layout.json`
- **THEN** a single empty leaf pane SHALL be seeded as the root
- **AND** if the URL hash supplies a `taskId`, that task SHALL be opened as a preview tab

#### Scenario: Corrupt or incompatible persisted workspace
- **WHEN** the persisted workspace fails shape validation on load
- **THEN** the app SHALL fall back to the default workspace and log a warning
- **AND** the app SHALL NOT crash

#### Scenario: Write debouncing
- **WHEN** the workspace is mutated multiple times in rapid succession (e.g., during a drag-reorder)
- **THEN** writes to `layout.json` SHALL be debounced to no more than one write per 250 ms window
- **AND** the final state after the burst SHALL be persisted

---

### Requirement: Empty Pane Placeholder

The system SHALL render an instructive placeholder when a leaf pane has no open tabs, instead of an empty void.

#### Scenario: Empty pane renders placeholder
- **WHEN** a leaf pane has zero tabs
- **THEN** the pane body SHALL display a centered placeholder reading "Select a task to open"
- **AND** the placeholder SHALL include a "Close pane" button if the pane is not the root

#### Scenario: User closes a non-root empty pane
- **WHEN** the user clicks "Close pane" on a non-root empty pane
- **AND** the pane is one of two children of a `SplitPane`
- **THEN** the sibling pane SHALL replace the parent split and become active
