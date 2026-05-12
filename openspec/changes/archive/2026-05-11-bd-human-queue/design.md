## Context

`bd human list --json` returns a JSON array of pending human-decision items. Each item has at minimum:
- `id: string` — the issue ID
- `title: string` — the issue title
- `prompt: string` — the question the agent is waiting on

The `run_bd_command(args: Vec<String>) -> CommandOutput` Tauri command (added by `bd-health-panel`) shells out to `bd` with the given args, returns `{ stdout, stderr, exit_code }`. The resolved `bd` binary path is cached in `AppState`. If `bd` is not found, `run_bd_command` returns `exit_code: 1` and a descriptive `stderr`.

## Goals / Non-Goals

**Goals:**
- Surface pending human-queue items in the UI without requiring terminal access.
- 60-second poll, active only when the app window is focused.
- Optimistic removal on respond/dismiss so the UI feels instant.
- Graceful degradation when `bd` is absent (chip hidden, no errors shown).

**Non-Goals:**
- Polling when the window is not focused (wastes resources and the queue changes only when agents run).
- Native OS push notifications for new items.
- A dedicated full-page human-queue view.

## Decisions

### Decision: Polling with `useInterval` + `document.visibilityState`

Use a `setInterval` (or `useInterval` from `react-use` / hand-rolled) inside `useHumanQueue`. On each tick, check `document.visibilityState === 'visible'`; if the window is hidden, skip the poll. This avoids Tauri window-focus events and is simple to implement.

**Alternatives considered:**
- Tauri `window.onFocusChanged` event: more precise but adds event-listener plumbing. Not necessary given 60s interval — at most one extra poll per minimize.
- TanStack Query `refetchInterval`: viable, but `useHumanQueue` is not a data-layer query (it shells out to `bd`); keeping it in a custom hook avoids polluting the TanStack Query key space with CLI output.

### Decision: `bd human list --json` output schema

Assumed schema (verify during implementation against actual `bd human list --json` output):
```json
[
  {
    "id": "BUI-abc",
    "title": "Should the due-date field be required?",
    "prompt": "Agent paused: clarify whether due_date is required for P0 issues."
  }
]
```
If the real schema differs, update the `HumanQueueItem` TypeScript interface accordingly. The hook should defensively handle empty array (`[]`) and parse errors (treat as empty, log to console).

### Decision: Popover anchored to chip, not a slide-over

A popover (anchored below the chip in the top bar) matches the scale of the feature — typically 0–5 items. A slide-over would be disproportionate. Implement using a `<div>` with `position: absolute` + `z-index: 50` toggled by chip click, similar to how `ProjectSwitcher` works. Close on outside click via a `useEffect` that listens to `mousedown` on `document`.

### Decision: Optimistic removal on respond/dismiss

On respond or dismiss:
1. Call `run_bd_command(['human', 'respond'/'dismiss', id, text?])` (fire-and-forget — await but don't block UI).
2. Immediately call `setItems(prev => prev.filter(i => i.id !== id))` in local state.
3. The next 60s poll will re-sync from the source of truth.

This avoids a re-poll on every action (which would add latency) while keeping the UI snappy.

### Decision: `run_bd_command` reuse — no new Tauri command

`run_bd_command` from `external.rs` (bd-health-panel) accepts arbitrary `Vec<String>` args, making it directly usable for `bd human list --json`, `bd human respond <id> <text>`, and `bd human dismiss <id>`. No new Tauri commands are needed.

### Decision: "Respond" UX — inline text input per item

Each item in the popover has a collapsed "Respond" button. Clicking it expands an inline `<textarea>` (single-line) + "Send" button below that item. Pressing Enter (without Shift) submits. This avoids a nested modal and keeps the popover self-contained.

## Data Flow

```
TopBar
  └─ BdHumanQueueChip (hidden if count=0 or bd absent)
       └─ click → BdHumanQueuePopover (absolute positioned)
            └─ useHumanQueue()
                 ├─ setInterval(60s) → invoke('run_bd_command', { args: ['human','list','--json'] })
                 │    → parse JSON → setItems([...])
                 ├─ onRespond(id, text):
                 │    setItems(prev => prev.filter...)   // optimistic
                 │    invoke('run_bd_command', { args: ['human','respond', id, text] })
                 └─ onDismiss(id):
                      setItems(prev => prev.filter...)   // optimistic
                      invoke('run_bd_command', { args: ['human','dismiss', id] })
```

## Risks / Trade-offs

- **`bd human list --json` output schema is assumed** — the actual `bd human` subcommand may have a different JSON shape or may not support `--json`. If absent, treat exit_code != 0 as "no items" and hide the chip. Document confirmed schema in a follow-up comment once verified.
- **Popover z-index conflicts** — if other fixed-position elements (modals, command palette) overlap the popover, z-index tuning may be needed during implementation.
- **`bd human respond` quoting** — shell-escaping the response text when passed via `run_bd_command(vec!["human","respond",id,text])` is handled automatically since Tauri uses `Command::new` with explicit arg array (no shell interpolation). Safe as-is.

## Open Questions

- Does `bd human list` exist as a subcommand? Verify with `bd human --help` during implementation. If not, file a follow-up for `bd` CLI extension and hide this chip entirely in the interim.
- Does the `bd human respond` command accept the response as a positional arg or via stdin? Confirm during implementation.
