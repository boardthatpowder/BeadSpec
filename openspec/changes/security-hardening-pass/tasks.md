## 1. Rust Formatting

- [x] 1.1 Run `cargo fmt` across `src-tauri/` and commit the formatting-only diff
- [x] 1.2 Verify `cargo fmt --check` passes cleanly after the commit

## 2. Tauri Shell Hardening

- [x] 2.1 Set `app.security.csp` in `src-tauri/tauri.conf.json` to `"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: https://asset.localhost; connect-src ipc: http://ipc.localhost"`
- [x] 2.2 Create `src-tauri/capabilities/main-window.json` scoped to the main window identifier; include `opener:default` for external link opening; exclude `shell:allow-execute` and `shell:allow-open`
- [x] 2.3 Create `src-tauri/capabilities/quick-capture.json` scoped to the quick-capture window; exclude `shell:allow-execute`, `shell:allow-open`, and `opener:default`
- [x] 2.4 Remove or archive `src-tauri/capabilities/default.json` (replace with per-window files)
- [x] 2.5 Write a Rust test (or JSON schema assertion) in `src-tauri/tests/` that reads `tauri.conf.json` and fails if `csp` is `null` or if any capability file grants `shell:allow-execute` without a non-wildcard `allow` list

## 3. IPC Allowlist

- [x] 3.1 Audit all calls to `runBdCommand` and `runRufloCommand` in `src/stores/settingsStore.ts` and across the frontend; document each logical operation needed
- [x] 3.2 In `src-tauri/src/commands/external.rs`, implement named Tauri commands for each bd operation (e.g., `bd_create_task`, `bd_update_status`, `bd_close_issue`, `bd_add_label`, `bd_remove_label`)
- [x] 3.3 In `src-tauri/src/commands/external.rs`, implement named Tauri commands for each ruflo operation used by the frontend
- [x] 3.4 Each named command SHALL resolve cwd from the project registry using the project ID argument (not a renderer-supplied path)
- [x] 3.5 Each named command SHALL resolve the binary path from validated settings state in Rust (not a renderer argument)
- [x] 3.6 Delete `run_bd_command` and `run_ruflo_command` from `src-tauri/src/lib.rs` command registration and `src-tauri/src/commands/external.rs`
- [x] 3.7 Update `src/stores/settingsStore.ts` and all other frontend callers to use the new named command wrappers from `src/bindings.ts`
- [x] 3.8 Add a settings-save handler in Rust that validates a custom binary path (exists + executable) and emits a confirmation before persisting it
- [x] 3.9 Write IPC tests asserting: (a) disallowed args are rejected, (b) unknown project ID returns error without spawning, (c) binary path cannot be supplied at invocation time

## 4. Project Path Canonicalization

- [x] 4.1 In `src-tauri/src/commands/project.rs`, call `std::fs::canonicalize` on the `.beads` path before storing in the registry (line ~74)
- [x] 4.2 Use the canonical path as the registry key everywhere; remove any non-canonical path comparisons
- [x] 4.3 Change `open_project` response type: replace `database_url: String` field with `project_id: String` (opaque) and `project_path: String` (canonical, user-displayable)
- [x] 4.4 Update the TypeScript bindings (re-run `tauri-specta` binding generation) and update frontend consumers of the `open_project` response to use `project_id` and `project_path`
- [x] 4.5 Update the status bar component to display `project_path` instead of `database_url`
- [x] 4.6 Write tests: (a) opening a project via symlink and its target yields one pool entry, (b) `open_project` response does not contain `database_url`

## 5. Process Supervision

- [x] 5.1 In `src-tauri/src/bd/runner.rs`, implement a `spawn_managed(cmd, args, cwd, timeout: Duration) -> Result<ManagedOutput>` function using `tokio::process::Command` with `.kill_on_drop(true)`
- [x] 5.2 In `spawn_managed`, on timeout: call `child.kill().await` explicitly, then `child.wait()` with a 2-second grace period, then return `ProcessTimeout` error
- [x] 5.3 In `spawn_managed`, bound stdout+stderr collection to 1 MiB combined; return `truncated: true` and log at `warn!` if exceeded
- [x] 5.4 Apply write-path timeout of 30s and read-path timeout of 10s across all `spawn_managed` call sites
- [x] 5.5 Migrate all existing callers in `src-tauri/src/commands/external.rs` and `src-tauri/src/bd/runner.rs` to use `spawn_managed`
- [x] 5.6 Write tests: (a) fake long-running command is killed within 200ms of a 100ms timeout; (b) normal command returns output without hitting timeout

## 6. SQL Safety

- [x] 6.1 In `src-tauri/src/commands/read.rs` (line ~111), replace the interpolated `IN (...)` label fetch with `sqlx::QueryBuilder` using `.push_bind()` for each issue ID
- [x] 6.2 Write a test with an issue ID containing a single quote and a comma; assert labels load correctly and no SQL error is returned

## 7. Dolt Recovery Correctness

- [x] 7.1 In `src-tauri/src/db/recovery/predicates.rs` (line ~89), update `working_set_clean` to open a connection to the project's Beads DB (not `information_schema`) and query `SELECT COUNT(*) FROM dolt_status WHERE staged = 1 OR working = 1`
- [x] 7.2 If the Beads DB connection fails in `working_set_clean`, return `Err` (escalate) instead of assuming clean
- [x] 7.3 In `src-tauri/src/db/dolt_server.rs` (line ~42), after spawning the sidecar, verify SQL readiness by issuing `SELECT 1` to the Beads DB (not `information_schema`) before writing `.supervisor.pid`
- [x] 7.4 Implement port-race retry: on sidecar spawn, if the Beads DB health check fails within 1 second, re-select a free port and retry the spawn up to 3 times; log each stolen port number
- [x] 7.5 Write tests: (a) `working_set_clean` returns `false` when `dolt_status` reports uncommitted rows; (b) `working_set_clean` returns `Err` when Beads DB is unreachable; (c) port-race scenario (mock port stolen between selection and sidecar bind) results in successful retry on a new port

## 8. Task Pagination

- [x] 8.1 In `src-tauri/src/commands/read.rs`, extend `get_tasks` to accept `limit: u32`, `after_cursor: Option<String>`, `status_filter: Option<Vec<String>>`, `label_filter: Option<Vec<String>>`, `sort_col: Option<String>`, `sort_dir: Option<String>`
- [x] 8.2 Move filter and sort logic from the frontend into the SQL WHERE and ORDER BY clauses; remove the 2000-row LIMIT constant
- [x] 8.3 Implement keyset pagination: decode `after_cursor` as `{ priority, created_at, id }`, append a `WHERE (priority, created_at, id) < (?, ?, ?)` clause for next-page requests
- [x] 8.4 Add `total_count: u64` (filtered count via `SELECT COUNT(*)`) and `next_cursor: Option<String>` (base64 JSON of last row's sort key) to the `get_tasks` response
- [x] 8.5 Update TypeScript bindings and regenerate `src/bindings.ts` to reflect the new `get_tasks` signature
- [x] 8.6 In `src/hooks/useTasks.ts`, update the TanStack Query key to include all server-side filter and sort params; pass filter/sort state to the backend instead of filtering client-side
- [x] 8.7 Implement infinite-scroll or "Load more" trigger in the task list component to fetch subsequent pages via `next_cursor`
- [x] 8.8 Update the KPI bar to display `total_count` from the response rather than the local array length
- [x] 8.9 Write backend tests: (a) project with 2001 tasks returns page of ≤200 with a `next_cursor`; (b) next-page request using `after_cursor` returns the correct subsequent slice; (c) filtered request returns only matching tasks
- [x] 8.10 Write frontend tests: (a) TanStack Query key changes when filter param changes; (b) no stale data bleeds across key changes

## 9. Markdown XSS Hardening

- [x] 9.1 In `src/components/task-detail/DescriptionEditor.tsx` (line ~58), configure the TipTap Markdown extension (or StarterKit) with `html: false` so raw HTML tags are not parsed as markup
- [x] 9.2 Add a DOMPurify sanitization pass for any task description loaded from the database that contains raw HTML before handing it to the TipTap `setContent` call
- [x] 9.3 Write tests with fixture descriptions containing: `<script>alert(1)</script>`, `<img onerror="alert(1)">`, `<a href="javascript:void(0)">`, and `<style>` tags — assert none execute and none appear as rendered HTML elements

## 10. Bindings Discipline

- [x] 10.1 In `src/components/settings/SettingsDialog.tsx` (line ~2), replace the raw `invoke('register_quick_capture_shortcut', ...)` call with `commands.registerQuickCaptureShortcut(...)` from `src/bindings.ts`
- [x] 10.2 Add an ESLint `no-restricted-imports` rule banning `import ... from '@tauri-apps/api/core'` in any file except `src/bindings.ts`
- [x] 10.3 Run ESLint across the codebase and fix any additional raw `invoke()` violations discovered
- [x] 10.4 Verify `eslint --max-warnings 0` passes after the rule is added
