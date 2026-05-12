## 1. useHumanQueue Hook

- [ ] 1.1 Verify `bd human list --json` is a valid subcommand by running it manually (`bd human --help`); if the subcommand does not exist, create a follow-up Beads issue and stub the hook to always return `[]` until it ships
- [ ] 1.2 Define `HumanQueueItem` TypeScript interface in `src/components/notifications/BdHumanQueue.tsx`: `{ id: string; title: string; prompt: string }` (adjust fields to match actual `bd human list --json` schema)
- [ ] 1.3 Implement `useHumanQueue()` hook: maintain `items: HumanQueueItem[]` state; on mount, call `invoke<CommandOutput>('run_bd_command', { args: ['human', 'list', '--json'] })`, parse `stdout` as JSON, set state; set up `setInterval(poll, 60_000)` with a `document.visibilityState` guard; clear interval on unmount
- [ ] 1.4 Implement `respond(id: string, text: string)`: optimistically remove item from state, then invoke `run_bd_command({ args: ['human', 'respond', id, text] })`
- [ ] 1.5 Implement `dismiss(id: string)`: optimistically remove item from state, then invoke `run_bd_command({ args: ['human', 'dismiss', id] })`
- [ ] 1.6 Handle edge cases: `bd` not found (exit_code !== 0 or stderr matches "not found") → return `[]` silently; JSON parse error → log to console, return previous state unchanged

## 2. BdHumanQueueChip and Popover Components

- [ ] 2.1 Create `src/components/notifications/BdHumanQueue.tsx` with two exported components: `BdHumanQueueChip` and (internal or co-located) `BdHumanQueuePopover`
- [ ] 2.2 `BdHumanQueueChip`: renders nothing if `items.length === 0` or `bd` is absent; otherwise renders a styled amber/yellow pill button showing count (e.g., `"2 decisions"`) that toggles popover open/close on click
- [ ] 2.3 `BdHumanQueuePopover`: absolutely positioned below the chip (`top: 100%, right: 0`), `z-index: 50`; lists each `HumanQueueItem` row; implement outside-click close via `useEffect` + `mousedown` listener on `document` (remove listener on popover close)
- [ ] 2.4 Each item row shows: title (bold), prompt text (muted, multi-line), three buttons: "Respond", "Dismiss", "View issue"
- [ ] 2.5 "Respond" button: toggles a `useState<string | null>` (keyed by item id) to expand an inline `<textarea rows={2}>` + "Send" button; Enter (no Shift) submits; Escape collapses
- [ ] 2.6 "Dismiss" button: calls `dismiss(id)` immediately, no confirmation required
- [ ] 2.7 "View issue" button: calls `useNavigateToTask()(id)` (or equivalent navigation helper) and closes the popover
- [ ] 2.8 Empty state: when `items.length === 0` after actions (popover still open during transition), show "No pending decisions" message

## 3. Top Bar Integration

- [ ] 3.1 In `src/components/layout/index.tsx`, import `BdHumanQueueChip` from `../notifications/BdHumanQueue`
- [ ] 3.2 Add `<BdHumanQueueChip />` to `TopBar` after `<ViewSwitcher />` (rightmost position in the top bar)
- [ ] 3.3 Confirm the chip does not disrupt the existing top bar layout when hidden (count=0) — verify via visual inspection that the top bar is identical to before when the queue is empty

## 4. Optimistic Removal and Re-poll

- [ ] 4.1 Confirm optimistic removal: after clicking Dismiss on an item, verify the chip count decrements immediately (before the 60s re-poll)
- [ ] 4.2 Confirm re-poll reconciliation: if the action fails silently (bd error), the item reappears on the next 60s poll — verify by simulating a bd error (e.g., wrong args) and waiting for the re-poll
- [ ] 4.3 Confirm that re-polling does NOT cause the popover to close or flash — state update should be a `setItems` merge that preserves open/closed popover state

## 5. Manual Test

- [ ] 5.1 Flag a test issue for human decision: `bd human <id>` (or equivalent CLI command to queue an item); verify the chip appears in the top bar within 60s (or immediately after a manual poll trigger)
- [ ] 5.2 Open the popover and verify the queued item appears with title, prompt, and all three action buttons
- [ ] 5.3 Click "Respond", type a response, press Enter — verify the item disappears immediately from the popover and the chip count decrements
- [ ] 5.4 Queue another item, click "Dismiss" — verify immediate optimistic removal
- [ ] 5.5 Queue another item, click "View issue" — verify the task detail panel opens for the correct task and the popover closes
- [ ] 5.6 With no queued items, verify the chip is invisible and the top bar layout is unchanged

## 6. Validate & Close

- [ ] 6.1 Run `openspec validate bd-human-queue` and confirm all checks pass
- [ ] 6.2 Run `bun run build` (or `bun run tauri build`) and confirm no TypeScript errors
- [ ] 6.3 Close this change in beads: `bd close <epic-id>`
