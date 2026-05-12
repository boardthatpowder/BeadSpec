## MODIFIED Requirements

### Requirement: KPI Bar Mode Persistence

The system SHALL persist the KPI bar display mode (`counts`, `burndown`, or `velocity`) across sessions using the existing Tauri app data store (`layout.json`).

#### Scenario: User selects a KPI bar mode and restarts the app
- **WHEN** the user selects a mode from the KPI bar mode switcher
- **THEN** the selected mode SHALL be written to `layout.json` under the key `kpiMode`
- **AND** on the next app launch, the KPI bar SHALL restore to the previously selected mode without user interaction

#### Scenario: No kpiMode key in layout.json (first launch or legacy store)
- **WHEN** the app launches and `layout.json` does not contain a `kpiMode` key
- **THEN** the KPI bar SHALL default to `counts` mode
- **AND** the existing status-count pill behaviour SHALL be identical to the pre-change default
