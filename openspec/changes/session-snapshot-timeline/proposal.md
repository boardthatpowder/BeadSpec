## Why

The Ruflo Stop hook writes an auto-snapshot (`ruflo session save -n auto-<YYYYMMDD-HHMMSS>`) at the end of every Claude Code session. Those snapshots accumulate silently with no UI surface: users cannot inspect what happened in a previous session, find which memory entries belong to it, or re-anchor a fresh Claude Code session against one for forensic recovery. This change makes those snapshots visible and actionable inside the existing `BdHealthPanel`.

## What Changes

- Add a *Sessions* sub-tab inside `BdHealthPanel`. The existing checks become the *Checks* sub-tab. A tab strip sits at the top of the panel body.
- The Sessions tab renders a chronological list (newest first) of session snapshots: timestamp, auto/manual marker (derived from whether the snapshot name begins with `auto-`), and optional metadata (issue count, files-changed count when present in the snapshot manifest).
- Clicking a row opens a side drawer showing the snapshot's full metadata JSON plus two actions:
  1. **View memory entries from this session** — navigates to the Memory view pre-filtered by a `[from, to)` timestamp window computed from the snapshot's `created_at` and the next snapshot's `created_at` (or "now" if this is the newest). Falls back to copying a key fragment `|ts:<from>-<to>|` to clipboard if the Memory view does not yet honour the filter params.
  2. **Restore conversation context** — copies the snapshot ID to the clipboard with a toast: "Snapshot ID copied. Paste into a fresh Claude Code session: `ruflo session restore <id>`." BeadSpec does not invoke restore itself.
- New Tauri command `list_session_snapshots(project_path) -> Vec<SessionSnapshot>` wraps `ruflo session list --json`. Returns an empty list when `ruflo` is not on PATH or no snapshots exist; surfaces a structured error only on JSON parse failure.

Non-goals (explicit):

- No write path: no "delete snapshot", no "save snapshot now". Snapshots are owned by the Stop hook.
- No actual restore invocation — only clipboard copy. Restore happens in a fresh Claude Code session.
- No diff view between two snapshots.
- No background polling. The tab fetches on mount and on manual Refresh, same as Checks.

## Capabilities

### New Capabilities
- `session-snapshot-timeline`: session list, detail drawer, both drawer actions, error states.

### Modified Capabilities
- `bd-health-panel`: adds tab strip (Checks | Sessions) to the panel body.

## Impact

- **Tauri command** (new): `list_session_snapshots` in `src-tauri/src/commands/ruflo_sessions.rs`. Shells out to `ruflo session list --json`.
- **Type bindings**: new `SessionSnapshot` type auto-generated via `specta` into `src/bindings.ts`.
- **Frontend IPC**: new wrapper `listSessionSnapshots(projectPath)` in `src/ipc.ts`.
- **React component** (modified): `src/components/health/BdHealthPanel.tsx` gains a tab strip; existing checks markup wrapped in a conditional.
- **React component** (new): `src/components/health/SessionsTab.tsx` — list, row, drawer, both actions.
- **No Dolt schema changes** — read-only feature; no persistent storage added.
