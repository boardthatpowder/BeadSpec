## MODIFIED Requirements

### Requirement: Task detail panel tabs respect feature flags
The task detail panel SHALL conditionally render the OpenSpec panel tab and the Ruflo memory panel tab based on the corresponding feature flags. When a feature is disabled, its tab SHALL be entirely absent (not disabled, not hidden with CSS — not rendered). The panel SHALL not attempt to initialize hooks or make Tauri IPC calls for disabled feature tabs.

#### Scenario: OpenSpec panel tab absent when OpenSpec disabled
- **WHEN** OpenSpec is disabled in Settings
- **THEN** the OpenSpec panel tab does not appear in the task detail tab bar

#### Scenario: OpenSpec panel tab present when OpenSpec enabled
- **WHEN** OpenSpec is enabled in Settings
- **THEN** the OpenSpec panel tab appears in the task detail tab bar in its normal position

#### Scenario: Ruflo memory panel tab absent when Ruflo disabled
- **WHEN** Ruflo is disabled in Settings
- **THEN** the Ruflo memory panel tab does not appear in the task detail tab bar

#### Scenario: Ruflo memory panel tab present when Ruflo enabled
- **WHEN** Ruflo is enabled in Settings
- **THEN** the Ruflo memory panel tab appears in the task detail tab bar in its normal position

#### Scenario: Active tab reset if active feature is disabled
- **WHEN** the user has the OpenSpec or Ruflo tab active and the corresponding feature is disabled via Settings
- **THEN** the active tab resets to the first available tab (e.g., Activity or Comments)
