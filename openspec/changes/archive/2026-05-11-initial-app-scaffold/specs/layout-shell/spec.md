## ADDED Requirements

Defines the top-level application shell: the Tauri window, multi-project switcher, resizable pane layout, density toggle, and cross-platform keyboard shortcut abstraction. This is the structural skeleton all other features mount into.

### Requirement: Resizable Multi-Pane Layout

The system SHALL render a three-region layout — top bar, left list panel, right detail panel — where pane sizes are user-resizable and persisted across sessions.

#### Scenario: User resizes the left list panel
- **WHEN** the user drags the divider between the list panel and detail panel
- **THEN** both panels SHALL resize in real time
- **AND** the new sizes SHALL be persisted to Tauri's app data store
- **AND** on next launch, the panels SHALL restore to the persisted sizes

#### Scenario: User opens app for the first time
- **WHEN** no persisted layout exists
- **THEN** the layout SHALL default to: top bar ~72px, left panel 30% width, right panel 70% width

#### Scenario: Window is resized below minimum usable width
- **WHEN** the window width drops below 800px
- **THEN** the left panel SHALL collapse to an icon-only rail
- **AND** the detail panel SHALL occupy full remaining width

### Requirement: View Density Toggle

The system SHALL offer three view density modes — Compact, Comfortable, and Spacious — that adjust task row height, font size, and padding throughout the app.

#### Scenario: User changes density
- **WHEN** the user selects a density mode from the settings menu
- **THEN** the task list rows, detail panel, and all chrome elements SHALL update immediately without a reload
- **AND** the selected density SHALL persist across sessions

#### Scenario: Default density
- **WHEN** a new user launches the app for the first time
- **THEN** the density SHALL default to Comfortable

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

### Requirement: Filter State in URL/Hash

The system SHALL encode the active filter set, selected task ID, and current view in the window location hash so that state is bookmarkable and supports browser-history-style navigation.

#### Scenario: User applies a filter
- **WHEN** the user selects a filter combination
- **THEN** the URL hash SHALL update to encode that filter state
- **AND** the browser back button SHALL restore the previous filter state

#### Scenario: User shares a deep link
- **GIVEN** the user has a specific task selected and filters applied
- **WHEN** the user copies the app URL
- **THEN** pasting that URL into a new app window SHALL restore the exact filter + selected task state

#### Scenario: App launches with a hash URL
- **WHEN** the app is launched with a pre-encoded hash URL
- **THEN** the app SHALL parse the hash, apply the filters, and select the indicated task on load

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
