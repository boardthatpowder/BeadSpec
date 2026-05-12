## ADDED Requirements

### Requirement: bd human queue notification chip in top bar
The top navigation bar SHALL display a persistent notification chip showing the count of issues currently flagged for human decision (`bd human list` output). The count SHALL refresh on a 60-second polling interval while the app is active. Clicking the chip opens a `bd human` queue panel.

#### Scenario: Human queue has items — chip shown with count
- **WHEN** `bd human list` returns one or more items
- **THEN** a chip in the top bar shows the count (e.g. "Human · 3") in an attention color

#### Scenario: Human queue empty — chip hidden
- **WHEN** `bd human list` returns zero items
- **THEN** the chip is not rendered (no zero-count badge)

#### Scenario: bd not on PATH — chip hidden
- **WHEN** the `bd` binary is not found in the resolved PATH at startup
- **THEN** the human queue chip is not rendered

### Requirement: Human queue decision panel
Clicking the human queue chip SHALL open an inline panel (popover or slide-over) listing each flagged issue with its title, the question or prompt that triggered the flag, and three action buttons: "Respond", "Dismiss", and "View issue". Actions SHALL shell the appropriate `bd human respond/dismiss <id>` command.

#### Scenario: User dismisses a flagged issue
- **WHEN** the user clicks "Dismiss" on a human-queue item in the panel
- **THEN** `bd human dismiss <id>` runs, the item is removed from the panel list, and the chip count decrements

#### Scenario: User responds to a flagged issue
- **WHEN** the user clicks "Respond" on a human-queue item
- **THEN** a text input appears inline for the user to type their response; on submit `bd human respond <id> "<text>"` runs and the item is removed from the list

#### Scenario: User views the full issue from the queue
- **WHEN** the user clicks "View issue" on a human-queue item
- **THEN** the panel closes and the app navigates to that task's detail pane
