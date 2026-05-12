## MODIFIED Requirements

### Requirement: Actor identity read from unified settings
The actor identity used in smart views (Focus view) and bd commands SHALL be read from `settings.json` via `@tauri-apps/plugin-store`. The default value is `"me"`. The actor is configurable in the Settings dialog.

#### Scenario: Focus view uses configured actor
- **WHEN** the user sets their actor to `"alice"` in Settings
- **THEN** the Focus view filters tasks assigned to `"alice"` instead of the previous actor

#### Scenario: Default actor is "me" when not configured
- **WHEN** no actor has been set in Settings
- **THEN** smart views and bd commands use `"me"` as the actor identity

#### Scenario: Legacy localStorage actor migrated on first load
- **WHEN** the app loads and finds a `beads-actor` key in `localStorage`
- **THEN** that value is written to `settings.json` as the actor identity and the `localStorage` key is removed

## REMOVED Requirements

### Requirement: Actor identity stored in localStorage under key "beads-actor"
**Reason**: Consolidated into unified `settings.json` store so the actor can be configured from the Settings dialog alongside other preferences.
**Migration**: `SettingsContext` performs a one-time silent migration on first load: reads `localStorage["beads-actor"]`, writes to `settings.json["actor"]`, removes the localStorage key.
