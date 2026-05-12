## ADDED Requirements

### Requirement: Settings dialog accessible from TopBar
The app SHALL provide a Settings dialog accessible via a gear icon button in the TopBar. The dialog SHALL also be reachable as an action in the CommandPalette.

#### Scenario: Gear button opens Settings
- **WHEN** the user clicks the gear icon in the TopBar
- **THEN** the Settings dialog opens as a modal overlay

#### Scenario: CommandPalette opens Settings
- **WHEN** the user selects "Open Settings" from the CommandPalette
- **THEN** the Settings dialog opens as a modal overlay

#### Scenario: Escape closes Settings
- **WHEN** the Settings dialog is open and the user presses Escape
- **THEN** the dialog closes without saving uncommitted changes

#### Scenario: Settings always accessible regardless of feature flags
- **WHEN** OpenSpec or Ruflo are disabled
- **THEN** the gear icon remains visible and Settings is still openable

### Requirement: Feature toggles for OpenSpec and Ruflo
The Settings dialog SHALL include toggles to enable or disable the OpenSpec integration and the Ruflo integration. Changes take effect immediately without requiring an app restart.

#### Scenario: Disabling OpenSpec hides all OpenSpec UI
- **WHEN** the user disables OpenSpec in Settings and saves
- **THEN** the Changes tab disappears from the view switcher, the OpenSpec panel tab disappears from task detail, and the OpenSpec doc panel is no longer openable in the workspace

#### Scenario: Enabling OpenSpec restores all OpenSpec UI
- **WHEN** the user enables OpenSpec in Settings and saves
- **THEN** the Changes tab, OpenSpec panel tab, and OpenSpec doc panel are all visible again

#### Scenario: Disabling Ruflo hides all Ruflo UI
- **WHEN** the user disables Ruflo in Settings and saves
- **THEN** the Ruflo memory panel tab disappears from task detail and Ruflo-specific filter chips are hidden in the filter bar

#### Scenario: Enabling Ruflo restores all Ruflo UI
- **WHEN** the user enables Ruflo in Settings and saves
- **THEN** the Ruflo memory panel tab and filter chips are visible again

### Requirement: Binary path overrides for all four runners
The Settings dialog SHALL allow the user to specify absolute paths for the `bd`, `openspec`, `ruflo`, and `dolt` executables. When a path field is blank, the runner uses its built-in auto-detection heuristic. When a path is set, the runner uses that path exactly.

#### Scenario: Setting a binary path overrides auto-detect
- **WHEN** the user sets the `openspec` path to `/usr/local/bin/openspec` and saves
- **THEN** subsequent OpenSpec CLI invocations use `/usr/local/bin/openspec` instead of the auto-detected path

#### Scenario: Clearing a binary path reverts to auto-detect
- **WHEN** the user clears the `ruflo` path field and saves
- **THEN** subsequent Ruflo CLI invocations use the auto-detected path

#### Scenario: Invalid binary path surfaces an error in the UI
- **WHEN** the configured path for a runner does not point to an executable file and that runner is invoked
- **THEN** the relevant UI surface shows an error message referencing the configured path

#### Scenario: Dolt path change requires restart
- **WHEN** the user changes the `dolt` binary path in Settings
- **THEN** the app displays a notice that the change takes effect after restart (dolt-server is not restarted in-place)

### Requirement: Actor identity setting
The Settings dialog SHALL provide a field for the user's actor identity. This value is used wherever the app needs the current user's name (smart views, bd commands). The default value is `"me"`.

#### Scenario: Actor identity used in Focus view
- **WHEN** the user sets their actor to `"alice"` in Settings
- **THEN** the Focus view filters tasks assigned to `"alice"` instead of `"me"`

#### Scenario: Default actor is "me"
- **WHEN** no actor has been set in Settings
- **THEN** the app uses `"me"` as the actor identity

### Requirement: Quick-capture shortcut configuration
The Settings dialog SHALL allow the user to set the global quick-capture keyboard shortcut. The change takes effect immediately after saving; the old shortcut is unregistered and the new one is registered. The default is `Cmd+Shift+N` (macOS) / `Ctrl+Shift+N` (Windows/Linux).

#### Scenario: Shortcut change takes effect immediately
- **WHEN** the user changes the quick-capture shortcut to `Cmd+Shift+Space` and saves
- **THEN** `Cmd+Shift+N` no longer opens quick capture and `Cmd+Shift+Space` does

#### Scenario: Invalid shortcut registration shows error
- **WHEN** the user sets a shortcut that cannot be registered (e.g., already taken by the OS)
- **THEN** the Settings dialog shows an inline error and keeps the previous shortcut active

### Requirement: Consolidated density, zoom, and notification preferences
The Settings dialog SHALL surface density (compact / default / comfortable), zoom level, and notification preferences (assignment, unblock, comment, global mute). These replace the existing scattered entry points. The underlying data is migrated from `localStorage` to `settings.json` on first load.

#### Scenario: Density change applies immediately
- **WHEN** the user changes density in Settings
- **THEN** the task list and detail panel update their spacing immediately without closing the dialog

#### Scenario: Legacy localStorage prefs are migrated on first load
- **WHEN** the app loads and finds `density`, `beads-actor`, or `notification-prefs` in `localStorage`
- **THEN** those values are written to `settings.json` and the `localStorage` keys are removed

### Requirement: Settings persistence across sessions
All settings SHALL be persisted to `settings.json` via `@tauri-apps/plugin-store`. Settings SHALL survive app restarts.

#### Scenario: Settings survive restart
- **WHEN** the user saves settings and restarts the app
- **THEN** all settings values are restored to the saved state

#### Scenario: Missing or corrupted settings file falls back to defaults
- **WHEN** `settings.json` is missing or unparseable at startup
- **THEN** the app starts with built-in defaults for all settings and does not crash
