## MODIFIED Requirements

### Requirement: Sessions tab displays session history
The Sessions tab SHALL display a list of session snapshots with formatted timestamps, a detail view for each snapshot, and a "Copy session context" action that provides clipboard feedback. The Sessions tab SHALL use `<PanelHeader>`, `<EmptyState>`, `<ErrorState>`, and `<Skeleton>` per the panel-header-standard capability.

#### Scenario: Sessions tab shows empty state when no sessions
- **WHEN** the Sessions tab has no session snapshots to display
- **THEN** an EmptyState with title "No sessions yet" and description "Sessions appear after your first agent run." is shown

#### Scenario: Sessions tab shows skeleton while loading
- **WHEN** the Sessions tab is fetching session data
- **THEN** skeleton placeholders appear instead of a "Loading…" text string

#### Scenario: Copy session context gives success feedback
- **WHEN** the user clicks the "Copy session context" button and clipboard write succeeds
- **THEN** a success toast appears confirming the copy

#### Scenario: Copy session context gives failure feedback
- **WHEN** clipboard write fails (permission denied or API unavailable)
- **THEN** an error toast appears instead of silently failing

#### Scenario: Session snapshot timestamps use formatAbsolute
- **WHEN** a session snapshot card renders its creation timestamp
- **THEN** it uses `formatAbsolute` from `src/lib/format/date.ts`
