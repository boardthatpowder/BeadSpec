# App Refresh Specification

## Purpose

Defines the global data-refresh action that lets users force an immediate re-fetch of all active TanStack Query caches without restarting the app.

---

## Requirements

### Requirement: Global refresh action
The app SHALL provide a global refresh action that invalidates all TanStack Query caches, forcing an immediate re-fetch of all active queries. The action SHALL be reachable via the TopBar button, a keyboard shortcut (`Cmd+R` on macOS / `Ctrl+R` on Windows/Linux), and the CommandPalette.

#### Scenario: TopBar button triggers refresh
- **WHEN** the user clicks the Refresh button in the TopBar
- **THEN** all active TanStack Query caches are invalidated and queries begin re-fetching

#### Scenario: Keyboard shortcut triggers refresh
- **WHEN** the user presses `Cmd+R` (macOS) or `Ctrl+R` (Windows/Linux) while the app window is focused
- **THEN** all active TanStack Query caches are invalidated and queries begin re-fetching

#### Scenario: CommandPalette entry triggers refresh
- **WHEN** the user opens the CommandPalette (Cmd/Ctrl+K) and selects the "Refresh" action
- **THEN** all active TanStack Query caches are invalidated and queries begin re-fetching

### Requirement: Refresh visual feedback
The Refresh button SHALL provide transient visual feedback while re-fetching is in progress.

#### Scenario: Spinner shown during re-fetch
- **WHEN** a refresh is in progress (at least one query is fetching)
- **THEN** the Refresh button shows a loading/spinning indicator

#### Scenario: Spinner clears after re-fetch
- **WHEN** all re-fetching queries have settled
- **THEN** the Refresh button returns to its default idle state

### Requirement: Refresh does not navigate or disrupt UI state
The refresh action SHALL not change the current view, close any open panels, or reset any UI state (selected task, open tabs, scroll position).

#### Scenario: Refresh preserves current view
- **WHEN** the user triggers a refresh while on the "Ready" view with a task selected
- **THEN** the view remains "Ready", the task remains selected, and only the data updates
