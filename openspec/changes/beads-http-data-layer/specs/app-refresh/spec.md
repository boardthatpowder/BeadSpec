## ADDED Requirements

### Requirement: Project reconciliation on focus and interval
The system SHALL refresh all project-owned active caches every 30 seconds, on focus and on existing manual refresh without changing selection, navigation, tabs or scroll state.

#### Scenario: Focus refresh
- **WHEN** the application regains focus
- **THEN** active project data SHALL reconcile while UI state remains intact
