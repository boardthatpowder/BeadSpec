## 1. Backend types & `get_gitnexus_status`

- [x] 1.1 Create `src-tauri/src/commands/gitnexus_status.rs`. Define `GitnexusStatus { last_analyzed_ts: Option<i64>, symbols: u64, relationships: u64, processes: u64, is_running: bool }` deriving `Serialize`, `Deserialize`, and `specta::Type`. Add a `GitnexusStatus::unknown()` constructor returning zeroed fields with `last_analyzed_ts: None, is_running: false`.
- [x] 1.2 Implement `get_gitnexus_status(project_path: String) -> Result<GitnexusStatus, String>`: shell out to `npx gitnexus status --json` (cwd = project_path); on non-zero exit or JSON parse failure, fall back to reading the mtime of `<project_path>/.gitnexus/` as `last_analyzed_ts`; counts default to 0 on fallback. Set `is_running` from the module-level process registry.
- [x] 1.3 Add a module-level `OnceCell<Mutex<HashMap<String, JoinHandle<()>>>>` (`RUNNING_TASKS`) tracking one `JoinHandle` per `project_path`. `is_running` in the status response derives from `registry.contains_key(&project_path)`.
- [x] 1.4 Cache the last `npx gitnexus status` result in a `Mutex<Option<(Instant, GitnexusStatus)>>` per project path; skip the shellout when the cached value is ≤55 s old and no analyze is running.

## 2. Backend `run_gitnexus_analyze`

- [x] 2.1 Implement `run_gitnexus_analyze(project_path: String, app: AppHandle) -> Result<(), String>`: return `Err("already_running")` if the registry already has a handle for `project_path`; otherwise `tokio::spawn` a task that runs `npx gitnexus analyze` (cwd = project_path), piping stdout + stderr line-by-line via `app.emit("gitnexus_analyze_progress", line)`.
- [x] 2.2 On task completion, emit `app.emit("gitnexus_analyze_complete", AnalyzeComplete { ok: bool, error: Option<String> })` and remove the registry entry. Invalidate the per-project status cache so the next `get_gitnexus_status` call re-shells.
- [x] 2.3 Add `mod gitnexus_status;` to `src-tauri/src/commands/mod.rs`.
- [x] 2.4 Register `get_gitnexus_status` and `run_gitnexus_analyze` in `src-tauri/src/lib.rs` in both `tauri::generate_handler!` and `tauri_specta::collect_commands!`.

## 3. Backend tests

- [x] 3.1 Unit test `humanize_age(ts)` helper: assert ≤30 min → green tier, 30 min–4 h → amber tier, >4 h → red tier, and boundary values (exactly 30 min, exactly 4 h).
- [x] 3.2 Unit test JSON-parse fallback: given malformed `npx gitnexus status --json` output (empty string, invalid JSON, missing fields), assert the returned `GitnexusStatus` equals `GitnexusStatus::unknown()` with no panic.
- [x] 3.3 Integration test in a temp dir: create `.gitnexus/` with a known mtime, assert `get_gitnexus_status` returns `last_analyzed_ts` matching that mtime when the JSON path fails.
- [x] 3.4 Concurrency guard test: two back-to-back `run_gitnexus_analyze` calls on the same project_path — the second must return `Err("already_running")`.

## 4. IPC + bindings

- [x] 4.1 Regenerate `src/bindings.ts` via `bun tauri build` (or the specta codegen script) so `GitnexusStatus`, `AnalyzeComplete`, `getGitnexusStatus`, and `runGitnexusAnalyze` are present in the auto-generated file.
- [x] 4.2 Add `getGitnexusStatus(projectPath: string): Promise<GitnexusStatus>` and `runGitnexusAnalyze(projectPath: string): Promise<void>` wrappers in `src/ipc.ts`, matching the style of `getChangeBeadsProgress`.

## 5. Frontend component

- [x] 5.1 Create `src/components/layout/GitnexusBadge.tsx`. Obtain the active `projectPath` from the same context already consumed by other top-bar hooks (confirm the exact context/selector during implementation). Use `useQuery({ queryKey: ['gitnexus-status', projectPath], queryFn: () => getGitnexusStatus(projectPath), refetchInterval: 60_000 })`.
- [x] 5.2 Implement `humanizeAge(tsSeconds: number): string` (e.g., `"12m"`, `"2h"`, `"1d 3h"`) and `ageColor(tsSeconds: number | null): 'green' | 'amber' | 'red' | 'grey'` (null → grey; ≤1800 s → green; ≤14400 s → amber; else red).
- [x] 5.3 Render the closed chip: colored 6 px dot + `"Index: <age>"` label (or `"Index: unknown"` when `last_analyzed_ts` is null). Use a neutral-800 border, ~22 px height, matching `BdHumanQueueChip` geometry.
- [x] 5.4 On chip click, toggle a popover anchored to the chip. Survey `src/components/` for an existing popover primitive; if one exists, reuse it. Otherwise implement with a local `open` boolean + click-outside handler (`useRef` + `useEffect`).
- [x] 5.5 Popover body: formatted last-analyzed ISO timestamp (e.g., `"2026-05-17 09:42 (14m ago)"`), counts row (`"5,545 symbols · 8,288 relationships · 277 processes"`), and a "Re-analyze" button. When `last_analyzed_ts` is null and symbols/relationships/processes are all 0, show the install hint instead of the counts row.
- [x] 5.6 Wire "Re-analyze" to `runGitnexusAnalyze(projectPath)`. Disable the button while `data?.is_running` is true. While running, subscribe to `gitnexus_analyze_progress` via Tauri `listen()` and render the last log line + elapsed seconds. On `gitnexus_analyze_complete`, call `queryClient.invalidateQueries(['gitnexus-status', projectPath])` and unsubscribe. Unsubscribe also on popover close.

## 6. Layout integration

- [x] 6.1 Import `GitnexusBadge` in `src/components/layout/index.tsx`.
- [x] 6.2 Insert `<GitnexusBadge />` in the `TopBar` JSX between `<BdHumanQueueChip />` and `<RefreshButton />`. Do not render the badge when `projectPath` is null / no project is selected.

## 7. Verification

- [x] 7.1 `cargo test -p beadspec_lib gitnexus_status::tests` passes (all unit + integration tests from section 3).
- [x] 7.2 `bun tsc --noEmit` passes after bindings regen.
- [x] 7.3 Manual: open BeadSpec on this repo (5,545 symbols); confirm badge shows green chip with age ≤30 min. Back-date `.gitnexus/` mtime by 2 h and confirm amber; by 5 h and confirm red.
- [x] 7.4 Manual: click "Re-analyze", verify progress log chunks stream into the popover, badge refreshes to green after completion.
- [x] 7.5 Manual: rename `npx` temporarily or point `project_path` at a non-gitnexus directory; confirm grey "Index: unknown" chip and install-hint in popover.
- [x] 7.6 `openspec validate gitnexus-index-freshness-badge` returns zero errors.
