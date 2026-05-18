## 1. Backend types & command

- [x] 1.1 Create `src-tauri/src/commands/gitnexus.rs` module. Add `pub mod gitnexus;` to `src-tauri/src/commands/mod.rs`.
- [x] 1.2 Define types in `gitnexus.rs`: `GitnexusRisk` enum (`Low | Medium | High | Critical | Unknown`), `GitnexusCaller { name: String, location: String }`, `GitnexusProcessGroup { process: String, callers: Vec<GitnexusCaller> }`, `GitnexusIndexStatus` enum (`Fresh | Stale | Unknown`), `GitnexusImpactReport { symbol: String, risk: GitnexusRisk, upstream_by_process: Vec<GitnexusProcessGroup>, downstream: Vec<GitnexusCaller>, affected_processes: Vec<String>, index_status: GitnexusIndexStatus }`. All derive `serde::Serialize`, `serde::Deserialize`, `specta::Type`.
- [x] 1.3 Add helper `detect_index_status(project_path: &str) -> GitnexusIndexStatus` that compares the mtime of `.claude/cache/gitnexus-*-ack` files against the project `HEAD` commit time. Return `Stale` when the newest ack is older than HEAD; `Fresh` when ack is newer or equal; `Unknown` when neither ack file nor HEAD can be resolved.
- [x] 1.4 Add `run_gitnexus_impact(project_path: String, symbol: String, registry: State<ProjectRegistry>) -> Result<GitnexusImpactReport, String>` Tauri command that: (a) verifies `npx` is on PATH using the shell-resolved PATH helper from `commands::external`; (b) spawns `npx gitnexus impact --target <symbol> --json` with `project_path` as CWD and a 15s timeout; (c) parses stdout JSON into `GitnexusImpactReport`; (d) on non-zero exit classifies stderr into `MissingCli | NoIndex | SymbolNotFound | Timeout | Other` and returns a descriptive error string; (e) sets `index_status` from `detect_index_status`.
- [x] 1.5 Register `run_gitnexus_impact` in `src-tauri/src/lib.rs` in both `tauri::generate_handler!` and `tauri_specta::collect_commands!` alongside the other commands.

## 2. Backend tests

- [x] 2.1 Snapshot the actual JSON shape returned by `npx gitnexus impact --target getGitRefsForIssue --json` from this repo. Commit the fixture under `src-tauri/src/commands/gitnexus_fixtures/`. This pins the JSON parser and confirms whether process grouping is native to the `impact` payload or requires a chained `context` call.
- [x] 2.2 Unit test the JSON parser against the fixture: assert the known `risk` value, at least one `upstream_by_process` entry with correct `process` and caller, and at least one `downstream` entry.
- [x] 2.3 Unit test the error classifier: feed synthetic stderr matching each of `MissingCli`, `NoIndex`, `SymbolNotFound` known patterns; assert the correct error string is returned.
- [x] 2.4 Unit test `detect_index_status` using a temp directory: (a) ack file newer than a synthetic HEAD time → `Fresh`, (b) ack file older → `Stale`, (c) no ack file → `Unknown`.

## 3. IPC + bindings

- [x] 3.1 Run the existing `specta` codegen script (or `bun tauri build`) to regenerate `src/bindings.ts` with `runGitnexusImpact` and all new types (`GitnexusRisk`, `GitnexusCaller`, `GitnexusProcessGroup`, `GitnexusIndexStatus`, `GitnexusImpactReport`).
- [x] 3.2 Add `runGitnexusImpact(projectPath: string, symbol: string): Promise<GitnexusImpactReport>` wrapper in `src/ipc.ts`, matching the `getChangeBeadsProgress` / `runOpenspecValidate` wrapper style.

## 4. Frontend: symbol candidate extraction

- [x] 4.1 Add pure function `extractDiffSymbols(diff: string): string[]` in `src/components/task-detail/` (separate helper file). Regex passes for TypeScript/JS (`function`, `class`, arrow-function assignments, method declarations), Rust (`fn`, `impl`, `struct`), and Python (`def`, `class`) identifier declarations on added/removed lines. Deduplicate, sort by frequency descending, cap at 10.
- [x] 4.2 Add a Vitest unit test covering: empty diff → `[]`, TypeScript function declaration → extracted, Rust `fn` → extracted, 25 distinct symbols → capped at 10, non-declaration lines → no false positives, mixed-language diff → all three parsers fire.

## 5. Frontend: `ImpactPanel.tsx`

- [x] 5.1 Create `src/components/task-detail/ImpactPanel.tsx` exporting `<ImpactPanel task={Task} project={string} paneId={string} />`.
- [x] 5.2 Inside the component: call `getGitRefsForIssue` (reuse the cached query already used by `TaskDetailPanel`), feed `GitRefs.diff` through `extractDiffSymbols`, render candidates as clickable chips. Render a free-text input below for manual entry.
- [x] 5.3 On chip click or manual submit: call `commands.runGitnexusImpact(project, symbol)`. Show an inline loading spinner; replace the previous result on success. Disabled while a call is in-flight.
- [x] 5.4 Render the impact report: risk badge using `LABEL_CHIP_COLORS` mapping (Low→slate, Medium→amber, High→orange, Critical→red, Unknown→muted with `—`), collapsible upstream process groups (`▾ process-name (N)` headings with caller rows showing `name` and `location`), flat downstream callee list, affected-processes count chip.
- [x] 5.5 Render inline callout for each error/empty state: no symbol selected (initial hint), `MissingCli`, `NoIndex`, `SymbolNotFound`, `Timeout`. Each includes the suggested fix command in a `<code>` span.
- [x] 5.6 When `index_status === "Stale"`, render a non-blocking yellow callout above the result body. Result body remains fully visible.
- [x] 5.7 Render a `Refresh` button next to the symbol row that re-fires the most recent call (disabled when no symbol has been run yet).

## 6. Frontend: TaskDetailPanel wiring

- [x] 6.1 In `src/components/task-detail/TaskDetailPanel.tsx`, extend `TabId` union to include `"impact"`.
- [x] 6.2 Append `{ id: "impact", label: "Impact" }` to the `tabs` array (last position, after `"activity"`).
- [x] 6.3 Add `activeTab === "impact" && <ImpactPanel task={task} project={project} paneId={paneId} />` to the tab-content switch, wrapped in the existing `ErrorBoundary`.
- [x] 6.4 Confirm `useWorkspaceStore.innerSubTab` serializes `"impact"` correctly (free-form string key — no schema change needed).

## 7. Verification

- [x] 7.1 `cargo test -p beadspec_lib commands::gitnexus` passes (parser, classifier, index-status tests).
- [x] 7.2 `bun tsc --noEmit` passes after bindings regeneration.
- [x] 7.3 `bun run test:unit` covers `extractDiffSymbols` and `ImpactPanel` rendering of empty/error states.
- [x] 7.4 Manual: `bun tauri dev`, open an issue whose branch has commits touching a known symbol, switch to `Impact` tab, click the auto-suggested chip, assert risk badge + grouped callers appear within 15s. Verify the result matches `npx gitnexus impact --target <symbol> --json` invoked manually in terminal.
- [x] 7.5 Manual: with no GitNexus index (rename `.claude/cache/`), open the Impact tab, assert "No index" callout renders without crashing.
- [x] 7.6 Manual: with a stale ack file (set its mtime to a time before the latest commit), run impact, assert the yellow stale-index callout appears alongside the result.
- [x] 7.7 Manual: switch workspace tabs and return — confirm the previous result is gone (no cache) and the empty state re-renders.
- [x] 7.8 `openspec validate gitnexus-impact-panel` passes with zero errors.
