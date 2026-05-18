## MODIFIED Requirements

### Requirement: Memory browser displays namespace entries with feedback
The Memory browser SHALL provide a two-pane layout (namespace sidebar + entry table) with an EmptyState when no namespace is selected or the namespace is empty, an ErrorState when fetch fails, skeleton rows while loading, success/error toasts on delete and store mutations, and formatted timestamps.

#### Scenario: Memory browser shows guided empty state when no namespace selected
- **WHEN** no namespace is selected in the sidebar
- **THEN** an EmptyState with title "Select a namespace" and description "Choose a namespace from the sidebar to browse entries." is shown in the main pane

#### Scenario: Memory browser shows empty state for empty namespace
- **WHEN** a namespace is selected but contains no entries
- **THEN** an EmptyState with title "No entries" is shown

#### Scenario: Memory browser shows error state on fetch failure
- **WHEN** loading memory entries fails
- **THEN** an ErrorState with a retry button appears instead of a raw error string

#### Scenario: Memory browser shows skeleton while loading entries
- **WHEN** a namespace is selected and entries are being fetched
- **THEN** skeleton rows appear in the entry table

#### Scenario: Delete mutation shows success toast
- **WHEN** the user deletes a memory entry successfully
- **THEN** a success toast confirms deletion

#### Scenario: Delete mutation shows error toast on failure
- **WHEN** a delete mutation fails
- **THEN** an error toast appears with a description

#### Scenario: Store mutation shows success toast
- **WHEN** the user stores a new memory entry successfully
- **THEN** a success toast confirms the entry was stored

#### Scenario: Entry timestamps use formatAbsolute
- **WHEN** a memory entry row renders its timestamp
- **THEN** it uses `formatAbsolute` from `src/lib/format/date.ts`
