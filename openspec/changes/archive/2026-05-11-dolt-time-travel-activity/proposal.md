## Why

Dolt's version-control layer records every field change to every row as a sequence of commits. This history is queryable via the `dolt_diff('issues', <from_commit>, <to_commit>)` function and already used internally by the DoltPoller to detect task changes in real time. However, this rich field-level history is never surfaced in the UI — users only see the beads `task_history` table entries, which may have gaps if changes were made directly via `bd` CLI or by other agents. Interleaving Dolt row-level diffs with beads history gives a complete, authoritative record of what changed and when.

## What Changes

- **New Rust command** `get_dolt_history_for_issue` in `src-tauri/src/commands/external.rs`: queries `dolt_diff('issues', 'HEAD~10', 'HEAD')` filtering by issue ID, returns `Vec<DoltRevision>` where each `DoltRevision` captures `from_commit`, `to_commit`, `commit_date`, and `changed_fields: Vec<FieldDiff>`. Returns empty vec gracefully on any query error.
- **Interleaving algorithm** (client-side): merges `task_history` entries and `DoltRevision` entries by timestamp in reverse chronological order so both sources appear in a single unified feed.
- **New `DoltRevisionEntry` React component**: renders one Dolt revision in the activity feed, showing the "Dolt" source badge, commit hash range, date, and a table of field-level before/after values.
- **Activity tab**: passes Dolt revisions to the interleaved renderer alongside existing beads history entries.
- **Graceful fallback**: if `get_dolt_history_for_issue` returns empty (Dolt not running, dolt_diff unavailable, or no history), the activity feed simply shows only beads entries — no error is shown.

## Capabilities

### New Capabilities

- `dolt-time-travel-activity`: Interleaved Dolt row-history diffs in the task detail activity tab, showing field-level before/after values for each Dolt commit that touched the current issue, distinguished by a "Dolt" source badge.

### Modified Capabilities

- `task-detail/activity-tab`: Activity feed now merges beads `task_history` entries and `DoltRevision` entries in a single chronological timeline.

## Impact

- **Modified Rust file**: `src-tauri/src/commands/external.rs` — add `get_dolt_history_for_issue` command, `DoltRevision`, and `FieldDiff` types. (May create this file if not yet created by git-commit-branch-refs.)
- **Modified file**: `src-tauri/src/lib.rs` — register `get_dolt_history_for_issue` in the invoke handler.
- **Modified file**: `src-tauri/src/commands/mod.rs` — ensure `external` module is exposed.
- **Regenerated file**: `src/bindings.ts` — new types `DoltRevision`, `FieldDiff`, and binding `getDoltHistoryForIssue`.
- **New React file**: `src/components/task-detail/DoltRevisionEntry.tsx`.
- **Modified file**: `src/components/task-detail/ActivityTimeline.tsx` (or equivalent) — implement interleaving and render `DoltRevisionEntry` items.
- **No new npm dependencies** required.
- **No schema changes** to the Dolt database.
- **Non-goal**: Any Dolt server lifecycle management (that is the scope of dolt-server-self-recovery).
- **Non-goal**: Writing Dolt commits from the UI.
- **Non-goal**: Time-travel queries (arbitrary commit range selection by the user) — this change uses a fixed `HEAD~10..HEAD` window.
- **Dependency**: `external.rs` must be created (by git-commit-branch-refs or this change) before `get_dolt_history_for_issue` can be added.
