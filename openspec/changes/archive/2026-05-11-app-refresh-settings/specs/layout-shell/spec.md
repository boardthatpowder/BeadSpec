## ADDED Requirements

### Requirement: Refresh button in TopBar
The TopBar SHALL include a Refresh button positioned after the existing right-side controls. The button SHALL show a loading indicator while queries are refetching.

#### Scenario: Refresh button is always visible
- **WHEN** the app is running
- **THEN** the Refresh button is visible in the TopBar regardless of the active view or feature flags

#### Scenario: Refresh button loading state
- **WHEN** a refresh is in progress
- **THEN** the Refresh button icon animates (e.g., spins) to signal active refetching

### Requirement: Settings button in TopBar
The TopBar SHALL include a Settings (gear icon) button positioned at the far right, after the Refresh button.

#### Scenario: Settings button is always visible
- **WHEN** the app is running
- **THEN** the Settings button is visible in the TopBar regardless of feature flag state

## MODIFIED Requirements

### Requirement: View switcher respects OpenSpec feature flag
The ViewSwitcher SHALL omit the "Changes" tab when the OpenSpec feature flag is disabled. The tab SHALL reappear immediately when the flag is re-enabled, with no app restart required.

#### Scenario: Changes tab hidden when OpenSpec disabled
- **WHEN** OpenSpec is disabled in Settings
- **THEN** the "Changes" tab is not rendered in the ViewSwitcher

#### Scenario: Changes tab visible when OpenSpec enabled
- **WHEN** OpenSpec is enabled in Settings
- **THEN** the "Changes" tab is rendered in the ViewSwitcher in its normal position

#### Scenario: View redirects if active when OpenSpec disabled
- **WHEN** the user is on the "Changes" view and disables OpenSpec in Settings
- **THEN** the active view switches to the default ("All") view automatically
