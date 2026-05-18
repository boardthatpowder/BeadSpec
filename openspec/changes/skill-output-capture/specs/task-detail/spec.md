## MODIFIED Requirements

### Requirement: Reviews section in Activity tab when Ruflo is enabled

The task detail Activity tab SHALL render a **Reviews section** below the Related Memories section when Ruflo is enabled in Settings. The section SHALL call `list_reviews` scoped to the task's `branch:<name>` label (and additionally `pr:<num>` if present). When the result is empty the section SHALL be entirely absent — no placeholder row, no heading. When Ruflo is disabled the section SHALL not render and no IPC call SHALL be made.

#### Scenario: Reviews exist for the task's branch
- **WHEN** the user opens the Activity tab for a task with a `branch:feat/x` label
- **AND** Ruflo is enabled
- **AND** at least one review is stored with `branch:feat/x`
- **THEN** a Reviews section appears below the Related Memories section
- **AND** each review is rendered as a kind pill + title + relative timestamp row

#### Scenario: No reviews for the task's branch
- **WHEN** no reviews are stored with the task's branch value
- **THEN** the Reviews section is entirely absent from the Activity tab
- **AND** no empty-state placeholder or heading is shown

#### Scenario: User clicks a review row to expand inline
- **WHEN** the user clicks a review row in the Reviews section
- **THEN** the full review markdown body expands inline below the row using the Tiptap markdown renderer
- **AND** clicking the row again collapses the body

#### Scenario: Ruflo disabled — section absent and no IPC call
- **WHEN** Ruflo is disabled in Settings
- **THEN** the Reviews section does not appear in the Activity tab
- **AND** no `list_reviews` IPC call is made for any task
