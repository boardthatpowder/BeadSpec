## ADDED Requirements

### Requirement: Lazy Load on First Expand

The "Related memories" section SHALL NOT fetch data when the task detail panel opens. Data SHALL be fetched only on first user expansion.

#### Scenario: User opens task — no fetch occurs

- **WHEN** the user opens a task in the detail panel
- **THEN** `run_ruflo_command` SHALL NOT be called
- **AND** the "Related memories" section SHALL render in its collapsed state with no loading indicator

#### Scenario: User expands the section for the first time

- **GIVEN** the "Related memories" section has not been expanded for this task
- **WHEN** the user clicks to expand the section
- **THEN** `run_ruflo_command` SHALL be called with the search query constructed from the task title and non-system labels
- **AND** a loading indicator SHALL be shown while the command runs
- **AND** results SHALL replace the loading indicator when the command completes

#### Scenario: User collapses and re-expands

- **GIVEN** the section has already fetched results for the current task
- **WHEN** the user collapses and then re-expands the section
- **THEN** the previously fetched results SHALL be shown immediately without a new fetch

---

### Requirement: Ruflo PATH Gating

The "Related memories" section SHALL be hidden entirely when `ruflo` is not available on the system PATH.

#### Scenario: Ruflo not on PATH

- **GIVEN** `ruflo` is not found on the system PATH at app startup
- **WHEN** any task is opened in the detail panel
- **THEN** no "Related memories" section SHALL be rendered
- **AND** no attempt SHALL be made to call `run_ruflo_command`

#### Scenario: Ruflo on PATH

- **GIVEN** `ruflo` is found and cached in AppState at app startup
- **WHEN** a task is opened in the detail panel
- **THEN** the "Related memories" section SHALL be rendered in its collapsed state

---

### Requirement: Query Construction — System Label Filtering

The search query SHALL consist of the task title joined with any non-system labels, omitting labels with system prefixes.

#### Scenario: Task has mixed system and non-system labels

- **GIVEN** a task with title "Implement retry logic" and labels `["branch:main", "worktree:BeadSpec", "openspec:dolt-recovery", "retry", "backend"]`
- **WHEN** the section expands and constructs the search query
- **THEN** the query SHALL be `"Implement retry logic retry backend"`
- **AND** labels with prefixes `branch:`, `worktree:`, `repo:`, `openspec:` SHALL be excluded

#### Scenario: Task has only system labels

- **GIVEN** a task with only system labels (all prefixed with `branch:`, `worktree:`, `repo:`, or `openspec:`)
- **WHEN** the section expands
- **THEN** the query SHALL consist of the task title only

---

### Requirement: Result Display

Each memory result SHALL display a title and a truncated excerpt. Clicking a result SHALL expand its full body inline.

#### Scenario: Results returned — title and excerpt shown

- **GIVEN** `run_ruflo_command` returns one or more memory results
- **WHEN** the section finishes loading
- **THEN** each result SHALL display the memory title and up to 120 characters of the body as an excerpt
- **AND** excerpts that exceed 120 characters SHALL be truncated with an ellipsis

#### Scenario: User clicks a result to expand

- **GIVEN** a result is shown in collapsed (excerpt) state
- **WHEN** the user clicks the result
- **THEN** the full memory body SHALL be displayed inline below the title
- **AND** clicking again SHALL collapse back to the excerpt view

#### Scenario: No results returned

- **GIVEN** `run_ruflo_command` returns an empty results array
- **WHEN** the section finishes loading
- **THEN** an empty-state message SHALL be shown (e.g. "No related memories found")
- **AND** the section SHALL remain expanded

#### Scenario: Command error

- **GIVEN** `run_ruflo_command` returns an error
- **WHEN** the section finishes loading
- **THEN** an error message SHALL be shown (e.g. "Could not load memories")
- **AND** the section SHALL remain expanded with the error message
