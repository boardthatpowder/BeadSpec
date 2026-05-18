## ADDED Requirements

### Requirement: Memory view entry in top navigation
The top navigation bar SHALL include a "Memory" navigation entry that renders the `memory-browser` view. It SHALL appear alongside the existing view entries and follow the same active/inactive visual treatment. The entry SHALL only be rendered when a project is connected AND the Ruflo feature flag is enabled AND the `ruflo` CLI is available on PATH.

#### Scenario: All gates pass
- **WHEN** a project is connected, the Ruflo flag is enabled, and `ruflo` is on PATH
- **THEN** the "Memory" entry is visible in the ViewSwitcher

#### Scenario: Ruflo flag disabled
- **WHEN** the Ruflo flag is disabled
- **THEN** the "Memory" entry is not rendered in the ViewSwitcher

#### Scenario: Ruflo CLI missing
- **WHEN** the Ruflo flag is enabled but `ruflo` is not on PATH
- **THEN** the "Memory" entry is not rendered in the ViewSwitcher

#### Scenario: View redirects if active when a gate flips off
- **WHEN** the user is on the "Memory" view and either the Ruflo flag is disabled or `ruflo` becomes unavailable
- **THEN** the active view switches to the default ("All") view automatically
