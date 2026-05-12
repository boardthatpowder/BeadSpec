## Context

`OpenSpecWatcher` in `src-tauri/src/db/watchers.rs` is a `notify`-based file
watcher that fires the `changes_list_changed` Tauri event so the frontend
`ChangesBrowser` can re-fetch the change list. It was set up to watch only
the top-level `openspec/changes/` directory (`RecursiveMode::NonRecursive`)
and only reacted to `Create` and `Remove` events.  This means that any
modification *inside* an existing change directory — editing `tasks.md`,
creating `proposal.md`, adding a spec subdirectory, or moving the directory
into `archive/` — is invisible to the watcher.

On the frontend, `ChangeCard.tsx` independently fetches its own `tasks.md`
progress with a `useEffect` that depends on `[project, change.name]`. Because
the change name never changes, the progress bar stays stale even after
`ChangesBrowser` re-fetches the list.

## Goals / Non-Goals

**Goals:**
- Any file change inside `openspec/changes/**` (task checkbox, new artifact,
  archive move) triggers a `changes_list_changed` event within ~500 ms.
- `ChangeCard` progress bar updates automatically after the list re-fetches.
- No new Tauri commands, no new events, no TypeScript bindings change.

**Non-Goals:**
- Per-change granular events (e.g. `change_detail_changed`) — the list-level
  refresh is sufficient given the small number of changes in practice.
- Watching `openspec/specs/` (the main spec tree, not the delta specs inside
  changes) — out of scope.
- Windows/Linux testing — the `notify` crate abstracts this; behavior should
  be correct but is not validated in this change.

## Decisions

**D1 — Recursive watching over a dedicated sub-path watcher**  
Switch `RecursiveMode::NonRecursive` → `RecursiveMode::Recursive` on the
existing `openspec/changes/` watch path rather than adding separate watchers
per change directory. Simpler: one watcher, one event channel, one debounce
path. The 500 ms quiet-period drain already handles burst events from editors
that write multiple temp files during a save.

**D2 — Add `Modify` to the event filter**  
The existing filter passes only `Create | Remove`. Add `Modify` so in-place
file edits (checkbox toggling in `tasks.md`, content edits in `proposal.md`)
also fire. No finer-grained filtering is needed because the debounce collapses
bursts.

**D3 — Optionally restrict to `.md` files and directory events**  
To avoid reacting to editor swap files (`.swp`, `~`, `#`), the watcher can
check that an event path ends in `.md` or has no extension (directory). This
is a low-cost guard; without it the only consequence is an extra debounced
re-fetch every time a swap file appears/disappears, which is harmless but
wasteful. Decision: add the filter for cleanliness.

**D4 — Fix `ChangeCard` progress staleness via `last_modified` dep**  
`ChangeCard` has its own `useEffect` that calls `getChangeProgress`. Its
dependency `[project, change.name]` never changes for an existing card.
Adding `change.last_modified` (already part of `ChangeInfo`) as a third dep
means the effect re-runs whenever `ChangesBrowser` fetches a new `ChangeInfo`
with an updated mtime. No new IPC call is needed — `getChangeProgress`
already exists.

## Risks / Trade-offs

- **Increased event volume on save** — recursive watching emits more events
  than non-recursive. Mitigated by the 500 ms debounce + `.md` filter.
- **Directory missing at startup** — if `openspec/changes/` does not exist,
  `watcher.watch()` returns an error and the thread exits silently (existing
  behaviour preserved).
- **`last_modified` timestamp granularity** — stored as Unix seconds; rapid
  successive saves within the same second won't trigger a second re-fetch.
  Acceptable: the first save already triggered one.
