## MODIFIED Requirements

### Requirement: Filesystem-watched change list
The Changes view SHALL use Tauri's filesystem watcher to detect any change
inside `openspec/changes/` while the view is open — including new change
directories, removed change directories, file creations or modifications
within existing change directories (e.g. `tasks.md` checkbox updates, new
`proposal.md`), and moves to/from the `archive/` subdirectory. The card list
and per-card progress bars SHALL update without requiring a manual refresh.
The watcher SHALL react to events within 2 seconds of the filesystem change.

#### Scenario: New change added while browser is open
- **WHEN** a new directory appears in `openspec/changes/` (e.g. via `openspec new change` in the terminal)
- **THEN** a new card appears in the Changes view within 2 seconds without any user interaction

#### Scenario: New artifact created in an existing change
- **WHEN** `proposal.md` is written inside an existing change directory
- **THEN** the corresponding change card updates to show the proposal artifact link as active within 2 seconds

#### Scenario: Task checkbox updated in tasks.md
- **WHEN** a checkbox line in `tasks.md` is toggled (e.g. `- [ ]` → `- [x]`)
- **THEN** the progress bar on the corresponding change card updates within 2 seconds to reflect the new done/total counts

#### Scenario: Change archived while browser is open
- **WHEN** a change directory is moved from `openspec/changes/` to `openspec/changes/archive/`
- **THEN** the card moves from the active list to the archived section within 2 seconds
