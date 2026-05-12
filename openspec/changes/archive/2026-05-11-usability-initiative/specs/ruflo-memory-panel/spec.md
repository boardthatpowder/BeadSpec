## ADDED Requirements

### Requirement: Ruflo memory panel in task detail
The task detail pane SHALL include a collapsible "Related memories" section that queries ruflo memory using the task title and labels as the search query. The query SHALL be triggered lazily when the section is first expanded, not on task open. When the `ruflo` CLI is not found on PATH, the section SHALL be hidden entirely.

#### Scenario: User expands the memory panel for the first time
- **WHEN** the user clicks to expand "Related memories" in the task detail pane
- **THEN** the app runs `ruflo memory search "<title>" --json` and displays the results

#### Scenario: ruflo not on PATH — panel hidden
- **WHEN** the app starts and `ruflo` is not found in the resolved CLI path
- **THEN** the "Related memories" section is not rendered in the task detail pane

#### Scenario: No relevant memories found
- **WHEN** `ruflo memory search` returns an empty result
- **THEN** the panel shows "No related memories found"

### Requirement: Memory results shown with expand-in-place
Each memory result SHALL show a title and a truncated excerpt (first 120 characters). Clicking a result expands it in place to show the full memory content. A second click collapses it.

#### Scenario: User expands a memory result
- **WHEN** the user clicks on a truncated memory entry
- **THEN** the full memory content appears inline below the title row; other results remain unchanged

#### Scenario: Multiple results — independent expand state
- **WHEN** two memory results are shown and the user expands the first
- **THEN** only the first result expands; the second remains collapsed

### Requirement: Memory query uses task labels as additional context
When building the ruflo memory search query, the app SHALL append the task's non-system labels (excluding `branch:`, `worktree:`, `repo:`, `openspec:` prefixes) as additional terms to improve recall relevance.

#### Scenario: Labels appended to search query
- **WHEN** a task has title "Fix login timeout" and labels `bug`, `auth`
- **THEN** the ruflo query is "Fix login timeout bug auth" (labels appended, system prefixes excluded)
