## MODIFIED Requirements

### Requirement: Notification preferences stored in unified settings
Notification preferences (assignment notifications, unblock notifications, comment notifications, global mute) SHALL be stored in `settings.json` via `@tauri-apps/plugin-store` rather than in `localStorage`. The `NotificationPrefsPanel` component SHALL read from and write to the unified settings store.

#### Scenario: Notification prefs persist across sessions via settings store
- **WHEN** the user changes notification preferences
- **THEN** the preferences are written to `settings.json` and survive app restarts

#### Scenario: Legacy localStorage notification prefs are migrated on first load
- **WHEN** the app loads and finds a `notification-prefs` key in `localStorage`
- **THEN** those values are written to `settings.json`, the `localStorage` key is removed, and subsequent reads come from the settings store

## REMOVED Requirements

### Requirement: Notification prefs stored in localStorage
**Reason**: Consolidated into unified `settings.json` store for consistent cross-session persistence and Rust accessibility.
**Migration**: `SettingsContext` performs a one-time silent migration on first load: reads `localStorage["notification-prefs"]`, writes to `settings.json["notificationPrefs"]`, removes the localStorage key.
