## Context

The DoltPoller already uses `dolt_diff('issues', ?, ?)` as a table-valued function to find rows changed between two commits. The same function is used here to retrieve per-field history for a specific issue. The query pattern mirrors `changed_task_ids` in `src-tauri/src/db/poller.rs`. This change is strictly read-only and does not overlap with `dolt-server-self-recovery` (which manages server lifecycle).

## Goals / Non-Goals

**Goals:**
- Expose per-field Dolt revision history for a single issue via a new Tauri command.
- Interleave Dolt revision entries with beads `task_history` entries in the activity tab timeline (client-side merge by timestamp).
- Render each Dolt revision with a "Dolt" source badge and a field diff table (field name, before value, after value).
- Graceful fallback: return empty vec on any SQL error; UI silently shows only beads entries.

**Non-Goals:**
- Arbitrary time-travel (user-selectable commit range).
- Writing Dolt commits from the UI.
- Dolt server lifecycle management (covered by dolt-server-self-recovery).
- Streaming diffs (full result returned after query completes).
- Per-field diff rendering for beads `task_history` entries (those already have their own display).

## Decisions

### dolt_diff Function Form

**Decision**: Use `dolt_diff('issues', 'HEAD~10', 'HEAD')` as the base query, filtered by issue ID:

```sql
SELECT * FROM dolt_diff('issues', 'HEAD~10', 'HEAD') WHERE to_id = ? OR from_id = ?
```

**Rationale**: This is the exact function form used by `changed_task_ids` in `poller.rs` — it is known to work with the project's sqlx/mysql_async setup. Using `HEAD~10` as the lookback window limits query cost while covering recent history. `dolt_diff` is a function, NOT a table — querying `dolt_diff_tasks` as a table would be incorrect.

**Alternative considered**: Querying `dolt_log()` to collect all commit hashes then fanning out to `dolt_diff` per pair — rejected as too many round trips. Single-range query is sufficient for recent history display.

### DoltRevision and FieldDiff Types

**Decision**:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct FieldDiff {
    pub field: String,
    pub from_value: Option<String>,
    pub to_value: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct DoltRevision {
    pub from_commit: String,
    pub to_commit: String,
    pub commit_date: String,
    pub changed_fields: Vec<FieldDiff>,
}
```

**Rationale**: `Option<String>` for values handles NULL (row created = from_value is NULL, row deleted = to_value is NULL). All field values are stringified for uniform rendering.

### Column Mapping from dolt_diff Output

**Decision**: The `dolt_diff('issues', ...)` function returns columns prefixed with `from_` and `to_` for each column in the `issues` table (e.g., `from_title`, `to_title`, `from_status`, `to_status`). The command iterates over a fixed list of well-known fields: `title`, `status`, `priority`, `assignee`, `description`, `labels`. For each field, if `from_<field>` and `to_<field>` differ, a `FieldDiff` entry is added. `commit_date` is read from the `to_commit_date` column (falls back to `from_commit_date` for removed rows).

**Rationale**: Fixed field list avoids dynamic column introspection. Fields not in the list (internal Dolt metadata columns) are excluded. This keeps the output focused on user-visible fields.

### Fallback on Error

**Decision**: Wrap the entire SQL query in a `match` on `Result`; on `Err(_)` return `Ok(vec![])`. No error is propagated to the frontend.

**Rationale**: Dolt may not be running, `dolt_diff` may return an error for very old commits, or the Dolt version may not support the function. Silent empty fallback ensures the activity tab is always usable even when Dolt history is unavailable.

### Interleaving Algorithm (Client-Side)

**Decision**: On the frontend, merge `HistoryEntry[]` (from beads) and `DoltRevision[]` (from Dolt) into a single array sorted by timestamp descending. `DoltRevision.commit_date` and `HistoryEntry.timestamp` are both ISO 8601 strings and can be compared lexicographically.

**Rationale**: Client-side merge keeps the Rust command simple (two independent queries). Lexicographic ISO 8601 comparison is correct for UTC timestamps.

### DoltRevisionEntry Component

**Decision**: `DoltRevisionEntry` renders:
1. Header row: "Dolt" source badge (visually distinct from beads entries), `to_commit` hash (first 7 chars), `commit_date`.
2. Field diff table: one row per `FieldDiff` showing field name, `from_value` (styled as removed, red), and `to_value` (styled as added, green). NULL values shown as "—".

**Rationale**: Consistent with existing diff display conventions in the app. "Dolt" badge makes the source immediately clear.

### Dolt Source Badge Styling

**Decision**: Render a small badge with text "Dolt" in a muted purple/violet color to distinguish it from beads entries. Not clickable.

**Rationale**: Color differentiation helps users quickly scan the mixed timeline. Purple/violet is unused by existing badge types (status, priority, labels).

### Does Not Overlap dolt-server-self-recovery

**Decision**: This change makes read-only SQL queries via the existing project pool (`ProjectRegistry`). It does NOT start, stop, or monitor the Dolt server process. Server lifecycle is entirely managed by `dolt-server-self-recovery`.

**Rationale**: Clear separation of concerns. If the Dolt server is down, the query returns an error that is silently swallowed per the fallback policy.

## Risks / Trade-offs

- **[Risk] `HEAD~10` lookback too shallow for some workflows** → Mitigation: Fixed for now; a configurable lookback depth is out of scope for this change.
- **[Risk] `dolt_diff` column names change between Dolt versions** → Mitigation: Use `sqlx::Row::try_get` with graceful fallback for each column; skip `FieldDiff` for columns that fail to decode.
- **[Risk] Performance on large issues tables** → Mitigation: Query is filtered by issue ID with a single-range `dolt_diff` call; expected to be fast.
- **[Risk] Dolt not running** → Mitigation: `sqlx` error is caught and empty vec returned; UI shows only beads entries.

## Migration Plan

1. Add `DoltRevision`, `FieldDiff`, and `get_dolt_history_for_issue` to `external.rs`.
2. Register command in invoke handler.
3. Run specta codegen.
4. Implement interleaving algorithm and `DoltRevisionEntry` component.
5. Wire into `ActivityTimeline`.
6. Manual smoke test: view activity for a task with Dolt history.
7. No database migrations; rollback reverts `external.rs` additions and component files.
