## 1. Rust: get_dolt_history_for_issue Command

- [x] 1.1 In `src-tauri/src/commands/external.rs`, add `FieldDiff { field: String, from_value: Option<String>, to_value: Option<String> }` and `DoltRevision { from_commit: String, to_commit: String, commit_date: String, changed_fields: Vec<FieldDiff> }` structs, both deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`
- [x] 1.2 Implement `get_dolt_history_for_issue(project_path: String, issue_id: String, registry: State<Arc<ProjectRegistry>>) -> Result<Vec<DoltRevision>, String>`: retrieve the project pool from `ProjectRegistry`; on pool miss return `Ok(vec![])`
- [x] 1.3 Execute the dolt_diff query using the function form (NOT a table): `SELECT * FROM dolt_diff('issues', 'HEAD~10', 'HEAD') WHERE to_id = ? OR from_id = ?`, binding `issue_id` twice; on any sqlx error return `Ok(vec![])`
- [x] 1.4 For each result row, extract `to_commit` (or `from_commit`), `to_commit_date` (or `from_commit_date`), and iterate over the fixed field list `["title", "status", "priority", "assignee", "description", "labels"]`; for each field where `from_<field>` != `to_<field>`, add a `FieldDiff` entry; use `try_get` with graceful skip on column-not-found
- [x] 1.5 Return `Ok(Vec<DoltRevision>)` sorted by `commit_date` descending
- [x] 1.6 Ensure `external` module is exposed in `src-tauri/src/commands/mod.rs`
- [x] 1.7 Register `get_dolt_history_for_issue` in the Tauri invoke handler in `src-tauri/src/lib.rs`
- [x] 1.8 Run `cargo check` in `src-tauri/` and confirm no compile errors

## 2. Specta Codegen

- [x] 2.1 Run the specta codegen step to regenerate `src/bindings.ts` with `DoltRevision`, `FieldDiff`, and `getDoltHistoryForIssue` binding
- [x] 2.2 Verify `src/bindings.ts` exports `DoltRevision`, `FieldDiff`, and the camelCase command binding
- [x] 2.3 Run `bun run typecheck` and confirm TypeScript sees the new types without errors

## 3. Interleave Algorithm

- [x] 3.1 In `src/components/task-detail/ActivityTimeline.tsx` (or a new `src/utils/interleaveActivity.ts`), implement `interleaveActivity(beadsEntries: HistoryEntry[], doltRevisions: DoltRevision[]): ActivityItem[]` where `ActivityItem` is a discriminated union `{ type: 'beads'; entry: HistoryEntry } | { type: 'dolt'; revision: DoltRevision }`
- [x] 3.2 Sort the merged array by timestamp descending using lexicographic ISO 8601 comparison (`commit_date` for Dolt, `timestamp` for beads)
- [x] 3.3 Write unit tests for `interleaveActivity` covering: empty Dolt array (returns beads entries in order), empty beads array (returns Dolt entries in order), interleaved ordering with mixed timestamps

## 4. DoltRevisionEntry Component

- [x] 4.1 Create `src/components/task-detail/DoltRevisionEntry.tsx` accepting `revision: DoltRevision` prop
- [x] 4.2 Render header row: "Dolt" source badge (muted violet/purple), short commit hash (`revision.to_commit.slice(0, 7)` in monospace), `revision.commit_date` formatted as relative or absolute date
- [x] 4.3 Render field diff table: one row per `FieldDiff` with columns: field name, `from_value` (red / strikethrough, "—" if null), `to_value` (green, "—" if null)
- [x] 4.4 Collapse field diff table by default; expand on click (to keep the feed scannable)
- [x] 4.5 Run `bun run typecheck` after component creation

## 5. Activity Tab Integration

- [x] 5.1 In `TaskDetailPanel.tsx` (or `ActivityTimeline.tsx`), add a TanStack Query for `get_dolt_history_for_issue` with key `['doltHistory', project, taskId]`, `staleTime: 30_000`, and `enabled: !!project && !!taskId && activeTab === 'activity'`; on error or undefined treat as empty array
- [x] 5.2 Call `interleaveActivity(historyEntries, doltRevisions ?? [])` to produce the merged feed
- [x] 5.3 In the activity feed renderer, dispatch on `ActivityItem.type`: render `<HistoryEntryComponent>` for `'beads'` items and `<DoltRevisionEntry>` for `'dolt'` items
- [x] 5.4 Verify the activity tab renders correctly when both arrays are empty and when only one has entries

## 6. Manual Test

- [x] 6.1 Open a task that has Dolt commit history: verify Dolt revision entries appear interleaved with beads history, with "Dolt" badges and correct field diff values
- [x] 6.2 Expand a Dolt revision entry: verify field diff table shows correct before/after values with color coding
- [x] 6.3 Open a task with no Dolt history (or with Dolt server stopped): verify activity tab shows only beads entries without any error state
- [x] 6.4 Verify the `get_dolt_history_for_issue` query is not fired when the "Details" tab is active

## 7. Validate and Close

- [x] 7.1 Run `openspec validate dolt-time-travel-activity` and resolve any reported issues
- [x] 7.2 Run `cargo check` in `src-tauri/` to confirm no Rust build regressions
- [x] 7.3 Run `bun run typecheck` to confirm no TypeScript build regressions
- [x] 7.4 Close BUI-zyiu with `bd close BUI-zyiu`
