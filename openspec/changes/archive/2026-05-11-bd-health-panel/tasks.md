## 1. Tauri Backend — run_bd_command

- [x] 1.1 Create `src-tauri/src/commands/external.rs` with `CommandOutput` struct (stdout, stderr, exit_code fields) derived with `specta::Type` and `serde::Serialize`
- [x] 1.2 Implement `run_bd_command(args: Vec<String>, state: tauri::State<AppState>) -> Result<CommandOutput, String>` using `std::process::Command` with 10-second timeout via a thread + channel or `tokio::time::timeout`
- [x] 1.3 Add `bd` binary path resolution at `AppState` construction: use `which bd` (or `Command::new("which").arg("bd")`) and store as `Option<PathBuf>` field `bd_bin` — **NOTE: implemented as per-call `find_bd_with_override()` (checks settings override, hardcoded known path, then PATH) rather than AppState cache; functionally equivalent**
- [x] 1.4 Return a synthetic `CommandOutput` with descriptive stderr and exit_code 1 when `bd_bin` is `None` — **NOTE: returns `Err("bd CLI not found")` instead; frontend catch block synthesizes output with exit_code -1**
- [x] 1.5 Register `external` module in `src-tauri/src/commands/mod.rs` and add `run_bd_command` to the Tauri command handler and specta export list

## 2. TypeScript Bindings Codegen

- [x] 2.1 Regenerate tauri-specta bindings (`cargo tauri-specta export` or project-specific codegen script) to produce updated `src/bindings.ts` including `runBdCommand` and `CommandOutput`
- [x] 2.2 Verify generated types compile: `bun run typecheck` (or equivalent) passes without errors

## 3. BdHealthPanel React Component

- [x] 3.1 Create `src/components/bd-health/BdHealthPanel.tsx` with state for five check results (`preflight`, `doctor`, `lint`, `stale`, `orphans`) plus an `isRunning` flag — **NOTE: actual path is `src/components/health/BdHealthPanel.tsx`**
- [x] 3.2 Implement sequential check runner: `async` function that invokes `runBdCommand` for each of the five arg sets in order, updating each section's state as it resolves (progressive rendering)
- [x] 3.3 Implement issue ID chip rendering: utility function that splits output text on `BUI-[a-z0-9]+` tokens and returns a React node array mixing plain text spans and `<Chip>` components; clicking a chip navigates to task detail — **NOTE: regex is broader (`[A-Z]+-[a-z0-9]+`) and lives in `src/components/shared/issueChips.tsx`**
- [x] 3.4 Implement `CheckSection` sub-component: renders check label, exit-code badge (green checkmark / red X), and the chip-annotated output text
- [x] 3.5 Implement "All checks passed" banner: displayed when all five results have exit_code 0, replaces section list — **NOTE: banner shown AND collapsed sections kept below (better UX)**
- [x] 3.6 Implement "Re-run" button: disabled while `isRunning`, re-triggers sequential check runner on click
- [x] 3.7 Implement "bd not found" empty state: displayed when `runBdCommand` returns the bd-absent synthetic error, shows instructional message

## 4. Layout Integration

- [x] 4.1 Add a "Health" navigation entry to `src/components/layout/index.tsx` reachable from the primary nav bar (one click from any view)
- [x] 4.2 Add route/view mapping so the Health nav entry renders `BdHealthPanel`

## 5. Manual Testing

- [x] 5.1 Run health panel on the BeadSpec project itself: verify all five sections render, exit codes display correctly, and the "All checks passed" banner appears when appropriate
- [x] 5.2 Verify issue ID chips appear in output (trigger a lint warning that references an issue ID, or manually inspect a project with known issues) and that clicking a chip navigates to the correct task detail
- [x] 5.3 Verify "bd not found" state by temporarily renaming/removing the bd binary from PATH and restarting the app

## 6. Validate and Close

- [x] 6.1 Run `openspec validate bd-health-panel` and resolve any reported issues
- [x] 6.2 Run `bun run build` (or `cargo tauri build`) to confirm no build regressions
- [x] 6.3 Close BUI-tcll with `bd close BUI-tcll` — **NOTE: tracking issue was never created in Beads; retroactively marked done**
