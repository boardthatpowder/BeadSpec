## MODIFIED Requirements

### Requirement: Change cards with progress and artifact links

Each OpenSpec change SHALL be rendered as a card showing: change name, progress bar (done/total from `tasks.md`), list of artifact links (proposal, design, delta-specs, tasks — greyed out if absent), and last-modified timestamp. Clicking an artifact link opens it as a tab in the workspace main pane.

#### Scenario: Change card displays progress
- **WHEN** a change with `tasks.md` containing 10 tasks (3 done) is shown in the browser
- **THEN** the card shows a progress bar filled to 30% and "3 / 10 tasks"

#### Scenario: Change with no tasks.md
- **WHEN** a change has `proposal.md` and `design.md` but no `tasks.md`
- **THEN** the card shows "No tasks yet" instead of a progress bar

#### Scenario: User opens an artifact from a card
- **WHEN** the user clicks an artifact chip (e.g. "proposal") on a change card
- **THEN** the artifact opens as a read-only markdown tab in the active workspace pane
- **AND** no OS file manager or external editor is launched

#### Scenario: Delta-spec chips shown on card
- **WHEN** a change has delta-spec files under `specs/<id>/spec.md`
- **THEN** one chip per spec id SHALL appear on the card (e.g. "spec: task-workspace")
- **AND** clicking a spec chip SHALL open that delta-spec file as a workspace tab

#### Scenario: Change with no delta specs
- **WHEN** a change has no `specs/` directory or no spec files within it
- **THEN** no spec chips are shown on the card
