## ADDED Requirements

### Requirement: Deeplink from per-task panel to Memory browser
When both the Ruflo feature flag is enabled and the `ruflo` CLI is available, the per-task `RufloMemoryPanel` SHALL include an "Open in Memory browser" affordance. Activating it SHALL navigate to the top-level Memory view and pre-select the namespace derived from the active task (specifically: any `branch:`, `worktree:`, `repo:`, `openspec:`, and `issue:` facets known for the task).

#### Scenario: User clicks "Open in Memory browser"
- **WHEN** the user clicks "Open in Memory browser" from a task's RufloMemoryPanel
- **THEN** the active view SHALL switch to "memory"
- **AND** the Memory browser SHALL mount with the namespace tree expanded to and the prefix selected at the task's reconstructed namespace (e.g. `branch:<b>|worktree:<w>|repo:<r>|openspec:<change>|issue:<id>`)

#### Scenario: Affordance hidden when gates fail
- **WHEN** either the Ruflo feature flag is disabled or `ruflo` is not on PATH
- **THEN** the "Open in Memory browser" affordance SHALL NOT be rendered in `RufloMemoryPanel`
