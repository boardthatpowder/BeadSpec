## Why

The OpenSpec changes page does not update in real time: edits to `tasks.md`
(task check-off), newly created artifacts (`proposal.md`, `design.md`, spec
files), and archiving/unarchiving changes all require a manual app refresh to
appear. This breaks the workflow loop where a terminal session (agents, CLI)
and the BeadSpec are open side-by-side.

## What Changes

- The `OpenSpecWatcher` backend switches from `RecursiveMode::NonRecursive` to
  `RecursiveMode::Recursive` so events fire for file changes inside existing
  change directories, not just top-level directory creates/removes.
- The watcher event filter gains `EventKind::Modify(_)` alongside the existing
  `Create` / `Remove` filter so file edits (e.g. checking off a task) trigger
  a refresh.
- Optionally filter watcher events to `.md` files and directory-level events to
  reduce noise from editor swap/temp files.
- `ChangeCard` adds `change.last_modified` to its progress-fetch `useEffect`
  dependency array so each card re-fetches its `tasks.md` checkbox count when
  the parent list re-loads with a new modification timestamp.

## Capabilities

### New Capabilities

None — this is a fix to existing real-time sync infrastructure, not a new
user-facing capability.

### Modified Capabilities

- `openspec-change-browser`: The changes browser gains full real-time updates:
  new artifacts appearing, task progress advancing, archiving/unarchiving, and
  new spec directories all reflect immediately without a manual reload.

## Impact

- **Rust**: `src-tauri/src/db/watchers.rs` — `OpenSpecWatcher::start()` only
  (~10 lines changed).
- **React**: `src/components/changes-browser/ChangeCard.tsx` — one line
  change to the `useEffect` dependency array.
- **No new Tauri commands, no new events, no bindings change.** The existing
  `changes_list_changed` event and `listChanges` / `getChangeProgress` IPC
  calls are reused as-is.
- **Debounce**: existing 500 ms quiet-period debounce already handles event
  bursts from recursive watching.
