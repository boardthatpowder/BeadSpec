## MODIFIED Requirements

### Requirement: Ruflo memory panel gated on Ruflo feature flag
The Ruflo memory panel in task detail SHALL only be mounted and initialized when the Ruflo feature flag is enabled. When disabled, the component SHALL not render, not call `run_ruflo_command`, and not register any hooks.

#### Scenario: Ruflo memory panel absent when Ruflo disabled
- **WHEN** Ruflo is disabled in Settings
- **THEN** the Ruflo memory panel is not mounted in the task detail panel

#### Scenario: Ruflo memory panel present when Ruflo enabled
- **WHEN** Ruflo is enabled in Settings
- **THEN** the Ruflo memory panel is mounted in the task detail panel as normal

### Requirement: Ruflo filter chips gated on Ruflo feature flag
Any filter chips or filter bar UI elements specific to Ruflo (e.g., Ruflo-tag-based filters) SHALL only be rendered when the Ruflo feature flag is enabled.

#### Scenario: Ruflo filter chips hidden when Ruflo disabled
- **WHEN** Ruflo is disabled in Settings
- **THEN** Ruflo-specific filter chips do not appear in the filter bar

#### Scenario: Ruflo filter chips visible when Ruflo enabled
- **WHEN** Ruflo is enabled in Settings
- **THEN** Ruflo-specific filter chips appear in the filter bar as normal
