## ADDED Requirements

### Requirement: Human Queue Chip in Top Bar

The system SHALL display a persistent chip in the top bar showing the count of issues flagged for human decision, so users are aware of pending decisions without leaving the app.

#### Scenario: Chip appears when human queue has items

- **WHEN** `bd human list --json` returns one or more items
- **THEN** a chip SHALL appear in the top bar showing the pending count (e.g. "2 decisions pending")
- **AND** the chip SHALL be visually distinct (e.g. amber/yellow badge) to draw attention

#### Scenario: Chip is hidden when queue is empty

- **WHEN** `bd human list --json` returns an empty array
- **THEN** NO chip SHALL be visible in the top bar
- **AND** the top bar layout SHALL reflow as if the chip is absent

#### Scenario: Chip is hidden when bd is not on PATH

- **WHEN** the `bd` binary is not resolvable from `AppState.bd_path`
- **THEN** NO chip SHALL be visible and NO error SHALL be shown related to the human queue

#### Scenario: Poll fires every 60 seconds when window is focused

- **WHEN** the app window has focus (document.visibilityState === 'visible')
- **THEN** `bd human list --json` SHALL be polled every 60 seconds
- **AND** the chip count SHALL update to reflect the latest result after each poll

#### Scenario: Poll is skipped when window is not focused

- **WHEN** the app window is minimized or hidden (document.visibilityState !== 'visible')
- **THEN** the 60-second poll SHALL be skipped for that tick
- **AND** the chip SHALL retain the last known count

---

### Requirement: Human Queue Decision Popover

The system SHALL provide a popover anchored to the human-queue chip that lists pending decision items and allows the user to respond, dismiss, or view each item.

#### Scenario: User opens the decision popover

- **WHEN** the user clicks the human-queue chip
- **THEN** a popover SHALL appear anchored below the chip
- **AND** the popover SHALL list each pending item with: title, prompt text, "Respond" button, "Dismiss" button, and "View issue" button

#### Scenario: User closes the popover

- **WHEN** the user clicks outside the popover or presses Escape
- **THEN** the popover SHALL close
- **AND** no item state SHALL change

#### Scenario: User responds to a decision item

- **WHEN** the user clicks "Respond" on an item
- **THEN** an inline text input SHALL expand below that item
- **WHEN** the user types a response and presses Enter or clicks "Send"
- **THEN** `bd human respond <id> "<text>"` SHALL be invoked
- **AND** the item SHALL be immediately removed from the popover (optimistic)
- **AND** the chip count SHALL decrement immediately

#### Scenario: User dismisses a decision item

- **WHEN** the user clicks "Dismiss" on an item
- **THEN** `bd human dismiss <id>` SHALL be invoked
- **AND** the item SHALL be immediately removed from the popover (optimistic)
- **AND** the chip count SHALL decrement immediately

#### Scenario: User views the associated issue

- **WHEN** the user clicks "View issue" on an item
- **THEN** the task detail panel SHALL open for that issue ID
- **AND** the popover SHALL close

#### Scenario: Popover is empty after all items are acted upon

- **WHEN** the user responds to or dismisses all items in the popover
- **THEN** the popover SHALL show an empty state: "No pending decisions"
- **AND** the chip SHALL disappear from the top bar
