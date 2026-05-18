## Why

Today, the BeadSpec workflow toolchain produces a rich stream of signal that vanishes into stderr or scattered corners of memory: `ruflo-pre-commit.sh` emits risk scores on every `git commit`, `gitnexus-impact-reminder.sh` acknowledges impact analyses, TDD hooks nudge on missing coverage, worker findings are filed as plain bd issues indistinguishable from human-created ones, and session-save snapshots are written silently. There is no single surface to scan recent workflow activity, correlate a `bd close` against the commit that produced it, or notice that a worker just filed a high-severity issue.

Critically, Beads change events are already polled via `dolt_log()` and dispatched on the `task_list_changed` Tauri topic — the infrastructure for a feed is 80% built. What is missing is a first-class view that gathers those events, adds hook and GitNexus signals, and presents them chronologically.

## What Changes

- **New "Activity" view** in `ViewSwitcher` (between Health and Changes), rendering a virtualised, streaming feed of `ActivityEvent` rows sourced from a single `workflow:activity` Tauri topic.
- **Backend event aggregator** (`src-tauri/src/events/`) merges three sources into one stream:
  1. Existing `dolt_log()` poller extended to emit `bd.create`, `bd.update`, `bd.close`, `bd.dep_add/remove` events to the new topic.
  2. Optional hook side-channel: hooks may append a `ruflo memory store` write with key segment `|type:event|kind:<k>|ts:<unix>|`; a new 3-second poller watermarks and emits these rows.
  3. GitNexus filesystem poller (5-second cadence) watches `.claude/cache/gitnexus-*-ack` and index mtimes, emitting `gitnexus.index_stale` or `gitnexus.index_refreshed` events.
- **New Tauri command** `list_recent_events(limit, since_ts?)` returns the in-memory ring buffer (7-day horizon, ≤5k entries), most-recent-first.
- **Frontend** renders a virtualised feed with kind multi-select filters, time-range pills (last hour / today / week), and auto-pin-to-bottom that disengages on user scroll (a "Jump to latest" pill re-engages it).

Non-goals (explicit):
- No new persistence schema. The feed is a derived projection of Dolt rows + ruflo memory rows + filesystem mtimes; the ring buffer lives in process memory only.
- No hook behaviour changes — the writeback convention is additive and optional. Hooks remain authoritative; the feed is observation-only.
- No cross-window notification surface (out of scope; this change is the foundation for it).
- No edit or delete of events from the UI.
- No branch/worktree scoping in v1 — the feed shows all events from the active project.

## Capabilities

### New Capabilities
- `workflow-activity-feed`: Activity view, virtualised feed UI, auto-follow, kind/range filters, ring buffer, `list_recent_events` IPC command, `workflow:activity` topic.
- `hooks-event-bus`: Optional hook writeback convention, kind namespace contract, ruflo memory poller with watermarking, `|type:event|` key schema.

### Modified Capabilities
- `layout-shell`: adds an "Activity" nav entry (always-visible when a project is connected, no feature flag).

## Impact

- `src/components/layout/ViewSwitcher.tsx` — add `activity` entry to `ALL_VIEWS`.
- `src/components/layout/index.tsx` — add `isActivityView` branch alongside the existing `isHealthView` / `isChangesView` pattern.
- `src/components/activity-feed/` — new directory: `ActivityFeed.tsx`, `ActivityRow.tsx`, `ActivityFilters.tsx`, `useActivityStream.ts`, `useAutoFollow.ts`.
- `src-tauri/src/events/mod.rs` + `src-tauri/src/events/activity.rs` — new module: `ActivityEvent` type, `ActivityRingBuffer`, source aggregators, `list_recent_events` command, `workflow:activity` emitter.
- `src-tauri/src/lib.rs` — register `list_recent_events` in both `tauri::generate_handler!` and `tauri_specta::collect_commands!`.
- `src-tauri/src/db/watchers.rs` / `db/poller.rs` — additionally call `events::activity::emit_bd_event` for each change-set delta.
- `src/bindings.ts` — regenerated.
- `.claude/hooks/README.md` — add "Optional activity-feed writeback" section documenting the `|type:event|kind:<k>|` key convention with a copy-paste snippet.
