## MODIFIED Requirements

### Requirement: Top bar hosts a GitNexus index-status badge slot

The top bar SHALL include a `<GitnexusBadge />` slot that surfaces the active project's GitNexus index freshness. The slot SHALL appear between the human-queue chip and the Refresh button in the right-side control strip.

#### Scenario: GitNexus badge slot renders when a project is active
- **WHEN** the top bar renders AND a project is currently selected
- **THEN** the top bar includes the `<GitnexusBadge />` between the human-queue chip and the Refresh button

#### Scenario: GitNexus badge slot hidden when no project is selected
- **WHEN** no project is connected or selected
- **THEN** the `<GitnexusBadge />` SHALL NOT render in the top bar
