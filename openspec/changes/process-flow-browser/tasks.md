## 1. Backend: Tauri commands

- [x] 1.1 Create `src-tauri/src/commands/gitnexus_processes.rs` with types `ProcessSummary { name, cluster, step_count }`, `ProcessStep { symbol, file, line, snippet }`, `ProcessDetail { name, cluster, steps }`, `Cluster { name, process_count }`, `IssueMatch { id, title, overlap_count }`, `IndexStatus { last_indexed_at, age_seconds, stale }`, `ReanalyzeHandle { started: bool }` — all deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
- [x] 1.2 Add `gitnexus_cli(args: &[&str], ttl_secs: u64) -> Result<serde_json::Value, String>` helper using `once_cell::sync::Lazy<Mutex<HashMap<...>>>` for 60s in-process cache; returns typed `Err` on spawn failure, non-zero exit, or JSON parse failure — never panics.
- [x] 1.3 Command `list_gitnexus_processes(project_path: String) -> Result<Vec<ProcessSummary>, String>` wrapping `npx gitnexus processes --json`.
- [x] 1.4 Command `get_gitnexus_process(project_path: String, name: String) -> Result<ProcessDetail, String>` wrapping `npx gitnexus process <name> --json`.
- [x] 1.5 Command `list_gitnexus_clusters(project_path: String) -> Result<Vec<Cluster>, String>`.
- [x] 1.6 Command `find_issues_touching_process(project_path: String, process_name: String) -> Result<Vec<IssueMatch>, String>` — enumerates open issues with a `branch:` label, calls `get_git_refs_for_issue` per issue, intersects modified-files set with the process's file set, returns top 20 sorted by overlap-count desc.
- [x] 1.7 Command `get_gitnexus_index_status(project_path: String) -> Result<IndexStatus, String>` wrapping `npx gitnexus list --json`; parses `last_indexed_at` to compute `age_seconds` and sets `stale = age_seconds > 14400`.
- [x] 1.8 Command `trigger_gitnexus_reanalyze(project_path: String) -> Result<ReanalyzeHandle, String>` spawning `npx gitnexus analyze` as a Tokio background task; emits Tauri events `gitnexus_reanalyze_progress { stage: "started" | "running" | "finished" | "error", message: String }`.
- [x] 1.9 Expose `gitnexus_processes` module in `src-tauri/src/commands/mod.rs`.
- [x] 1.10 Register all six commands in `src-tauri/src/lib.rs` in both `tauri::generate_handler!` and `tauri_specta::collect_commands!` alongside existing commands.

## 2. Backend tests

- [x] 2.1 Unit test for `gitnexus_cli` caching: two identical calls within TTL → one process spawn; a third call after TTL expiry → new spawn.
- [x] 2.2 Unit test for `find_issues_touching_process` overlap math: fixture with 3 issues (2 share a file with the process, 1 does not) → 2 returned sorted by overlap desc; non-overlapping issue excluded.
- [x] 2.3 Unit test for JSON parse tolerance: malformed JSON from gitnexus returns a typed `Err` instead of panicking.
- [x] 2.4 Unit test for reanalyze event sequencing: command emits `started` then `finished` events on success; emits `error` event on spawn failure.
- [x] 2.5 Unit test for `IndexStatus.stale`: `age_seconds > 14400` → `stale = true`; `age_seconds <= 14400` → `stale = false`.

## 3. IPC + bindings

- [x] 3.1 Run specta codegen (`bun tauri build --debug` or the existing codegen script) to regenerate `src/bindings.ts` with the new types and commands.
- [x] 3.2 Add wrappers in `src/ipc.ts`: `listGitnexusProcesses`, `getGitnexusProcess`, `listGitnexusClusters`, `findIssuesTouchingProcess`, `getGitnexusIndexStatus`, `triggerGitnexusReanalyze` — following the style of existing wrappers (e.g., `getChangeBeadsProgress`).

## 4. Frontend integration

- [x] 4.1 Extend `View` union in `HashStateContext` with `'processes'`; add `processId?: string` field to the hash encoder/decoder; switching active process calls `window.history.replaceState` (not `pushState`).
- [x] 4.2 Modify `src/components/layout/ViewSwitcher.tsx` to add `{ id: 'processes', label: 'Processes', description: 'GitNexus execution flows' }` entry; gated on `project != null` only (no OpenSpec feature flag).
- [x] 4.3 New `src/components/process-browser/ProcessBrowser.tsx` — two-pane root component; reads `processId` from hash state; parallel-fetches `listGitnexusProcesses` + `listGitnexusClusters` on mount; renders `StaleIndexBanner`, `ProcessList`, and `ProcessDetail`.
- [x] 4.4 New `ProcessList.tsx` — search input (150ms debounce), cluster `<select>`, virtualized list (TanStack Virtual) grouped by cluster; each row calls `setState`-analogue to update `processId` in hash.
- [x] 4.5 New `ProcessDetail.tsx` — heading + cluster badge + step count; `[Find issues]` button; `[Open in editor]` button (disabled when no step focused); virtualized stepped list; each step row: step number, symbol (normal weight), `file:line` (monospace), truncated snippet; `aria-label` per row.
- [x] 4.6 New `StaleIndexBanner.tsx` — conditionally subscribes to `useGitnexusIndexStore` (if `gitnexus-index-freshness-badge` is present) or calls `getGitnexusIndexStatus` on mount; renders banner only when `stale === true`; `Re-analyze` button triggers `triggerGitnexusReanalyze`, subscribes to progress events, shows toast, invalidates `listGitnexusProcesses` query on `finished`.
- [x] 4.7 New `IssueMatchesPopover.tsx` — opens on `[Find issues]` click; shows spinner while `findIssuesTouchingProcess` resolves; renders up to 20 rows (issue title + overlap count chip); clicking a row calls `setState({ view: 'all', taskId })`; empty-state when no matches.
- [x] 4.8 Open-in-editor handler in `ProcessDetail.tsx`: constructs `${absoluteFile}:${line}:0` and calls `openPath`; detects `$EDITOR` env var, defaults to `code -g`; on error, shows toast with message.
- [x] 4.9 Add `view === 'processes'` branch in `src/components/layout/index.tsx` rendering `<ProcessBrowser />`, following the same pattern used for `ChangesBrowser`.
- [x] 4.10 Add `aria-label` on each step row (`"step ${n}: ${symbol} at ${file} line ${line}"`); list role `listbox`; ensure keyboard navigation (arrow keys) moves focus within the step list.

## 5. Verification

- [x] 5.1 `cargo test -p beadspec_lib gitnexus_processes::tests` passes.
- [x] 5.2 `bun tsc --noEmit` passes after bindings regeneration.
- [x] 5.3 Manual: open a project, switch to Processes; list populates within 2s, cluster filter narrows results, search filters by substring with 150ms debounce.
- [x] 5.4 Manual: click a process; detail pane renders steps with snippet + line; clicking a step focuses it; `Open in editor` opens the file at the correct line.
- [x] 5.5 Manual: click `Find issues` on a process whose symbol set overlaps a branch with open Beads issues; popover lists matches sorted by overlap desc; clicking a row opens `TaskDetailPanel` on that issue.
- [x] 5.6 Manual: force `age_seconds > 14400`; stale banner renders; clicking `Re-analyze` runs to completion; list refreshes; banner clears.
- [x] 5.7 Manual: simulate `npx gitnexus` unavailable (rename binary); install-hint card renders instead of the list; no crash; other views (Health, OpenSpec, etc.) unaffected.
- [x] 5.8 Manual: navigate to `#view=processes&processId=<name>` directly; correct process pre-selected on load; switching process updates hash via `replaceState`; unknown `processId` shows list-only (no detail pane).
- [x] 5.9 `openspec validate process-flow-browser` passes.
