## MODIFIED Requirements

### Requirement: Quick-capture shortcut is user-configurable
The global quick-capture keyboard shortcut SHALL be configurable via the Settings dialog. The default shortcut is `CmdOrCtrl+Shift+N`. When the setting changes, the old shortcut SHALL be unregistered and the new one registered immediately without requiring an app restart.

#### Scenario: Custom shortcut registered on settings save
- **WHEN** the user changes the quick-capture shortcut in Settings and saves
- **THEN** the previous shortcut stops triggering quick capture and the new shortcut triggers it instead

#### Scenario: Invalid shortcut registration shows error
- **WHEN** the user saves a quick-capture shortcut that cannot be registered (e.g., OS-reserved)
- **THEN** the Settings dialog shows an inline error for the shortcut field and the previous shortcut remains active

#### Scenario: Default shortcut restored when field cleared
- **WHEN** the user clears the quick-capture shortcut field and saves
- **THEN** the default shortcut `CmdOrCtrl+Shift+N` is registered

## REMOVED Requirements

### Requirement: Quick-capture shortcut hardcoded to CmdOrCtrl+Shift+N
**Reason**: Replaced by user-configurable shortcut setting. The default remains `CmdOrCtrl+Shift+N` but is no longer hardcoded in `src-tauri/src/lib.rs`.
**Migration**: No user action required. The setting defaults to `CmdOrCtrl+Shift+N`; behavior is unchanged unless the user explicitly changes it.
