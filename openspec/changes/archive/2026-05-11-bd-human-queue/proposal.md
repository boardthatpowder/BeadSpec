## Why

The `bd human` queue accumulates issues flagged for human decision (open questions, ambiguous requirements, agent-paused tasks) but is invisible unless the user actively runs `bd human list` in the terminal. Users working primarily in the Beads UI miss these pending decisions entirely, causing agent workflows to stall silently.

## What Changes

- **Persistent notification chip** in the top bar showing the count of issues in the human queue. The chip is hidden when the count is 0 or when `bd` is not on PATH.
- **60-second poll** of `bd human list --json` using the existing `run_bd_command` Tauri command from `bd-health-panel`. Poll only fires when the app window is focused.
- **BdHumanQueue popover** — anchored to the chip — lists each queued item with:
  - Title and prompt text (the question/decision the agent is waiting on)
  - "Respond" — inline text input that submits `bd human respond <id> "<text>"`
  - "Dismiss" — calls `bd human dismiss <id>`
  - "View issue" — navigates to the task detail pane
- **Optimistic removal**: on Respond or Dismiss, the item is removed from local state immediately; the 60-second re-poll confirms the action.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `notifications`: top bar now includes a human-queue chip showing the pending-decision count; clicking opens a decision panel popover with respond/dismiss/view actions.

## Impact

- **New file**: `src/components/notifications/BdHumanQueue.tsx` — `useHumanQueue` hook (poll + parse) + `BdHumanQueueChip` component + `BdHumanQueuePopover` component.
- **Modified file**: `src/components/layout/index.tsx` — import and render `BdHumanQueueChip` in `TopBar`, positioned after the `ViewSwitcher`.
- **Reused**: `run_bd_command` Tauri command (from `external.rs`, added by `bd-health-panel`). No new Tauri commands needed.
- **No new npm dependencies** required.

## Non-Goals

- Native OS notifications for new human-queue items (deferred — out of scope for this change).
- Showing the human queue in a dedicated full view/page (chip + popover is sufficient for v1).
- Persisting dismissed items across app restarts (dismiss is a `bd human dismiss` write-through).
- Supporting `bd human` commands when `bd` is not on PATH — the chip simply stays hidden.
