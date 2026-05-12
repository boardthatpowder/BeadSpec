# IPC Audit: runBdCommand / runRufloCommand Call Sites

## Summary

The frontend exposes two generic shell-delegation IPC commands — `run_bd_command` and `run_ruflo_command` — that accept an arbitrary `args: Vec<String>` array from the renderer and forward it verbatim to the corresponding CLI process. The renderer also supplies `project_path: String` as the working directory, meaning an untrusted renderer process can run any bd/ruflo subcommand with any arguments in any directory it names.

There are **7 call sites** across 4 source files. All pass the active project path as `cwd`; none supply a renderer-controlled binary path (the binary is resolved server-side from settings or PATH). The operations in use are narrow and well-defined, making conversion to named commands straightforward.

---

## runBdCommand calls

| File | Line | Subcommand | Args | CWD | Purpose |
|------|------|-----------|------|-----|---------|
| `src/components/health/BdHealthPanel.tsx` | 148 | `preflight` | `['preflight']` | active project path | Runs bd preflight check in the Health panel |
| `src/components/health/BdHealthPanel.tsx` | 148 | `doctor` | `['doctor']` | active project path | Runs bd doctor check in the Health panel |
| `src/components/health/BdHealthPanel.tsx` | 148 | `lint` | `['lint']` | active project path | Runs bd lint check in the Health panel |
| `src/components/health/BdHealthPanel.tsx` | 148 | `stale` | `['stale']` | active project path | Runs bd stale check in the Health panel |
| `src/components/health/BdHealthPanel.tsx` | 148 | `orphans` | `['orphans']` | active project path | Runs bd orphans check in the Health panel |
| `src/components/bd-formulas/FormulasBrowser.tsx` | 109 | `formula list` | `['formula', 'list', '--json']` | active project path | Lists available formulas as JSON for the Formulas Browser |
| `src/components/bd-formulas/FormulasBrowser.tsx` | 169 | `mol pour` | `['mol', 'pour', <formulaName>]` | active project path | Applies (pours) a named formula; `formulaName` is a user-selected string from the prior formula list response |
| `src/hooks/useHumanQueue.ts` | 49 | `human list` | `['human', 'list', '--json']` | active project path | Polls the human-in-the-loop queue; called on mount and every 60 seconds |
| `src/hooks/useHumanQueue.ts` | 103 | `human respond` | `['human', 'respond', <id>, <text>]` | active project path | Submits a text response to a human-queue item; `id` is from the queue list, `text` is user-entered |
| `src/hooks/useHumanQueue.ts` | 113 | `human dismiss` | `['human', 'dismiss', <id>]` | active project path | Dismisses a human-queue item without responding; `id` is from the queue list |

Note: the single `BdHealthPanel` call at line 148 is a loop over `CHECKS`, each with a fixed args array (lines 26–31). The five distinct check subcommands are enumerated separately in the table above.

---

## runRufloCommand calls

| File | Line | Subcommand | Args | CWD | Purpose |
|------|------|-----------|------|-----|---------|
| `src/components/task-detail/RufloMemoryPanel.tsx` | 69 | `memory search` | `['memory', 'search', '-q', <query>, '--format', 'json']` | active project path (may be empty string `''`) | Searches ruflo memory for entries related to the active task's title and labels; `query` is derived from task metadata, not raw user input |
| `src/components/task-detail/TaskDetailPanel.tsx` | 64 | `--version` | `['--version']` | active project path | Version probe to detect whether ruflo is installed; used as a feature-flag gate; result cached for 5 minutes |

---

## Rust implementation

`src-tauri/src/commands/external.rs` defines both Tauri commands:

**`run_bd_command`** (line 160):
- Accepts `project_path: String` and `args: Vec<String>` from the renderer.
- Looks up the `bd` binary path from `AppSettings.binary_paths.bd` (settings-managed state, not from the renderer).
- Calls `find_bd(&settings_path)` which checks the override path, nvm candidate paths, and finally PATH.
- Delegates to `run_subprocess(&bd, &args, &project_path)`.

**`run_ruflo_command`** (line 173):
- Same pattern: reads `ruflo` path from `AppSettings.binary_paths.ruflo`.
- Calls `find_ruflo_with_override(&settings_path)` which checks override, nvm candidates, and PATH.
- Delegates to `run_subprocess(&ruflo, &args, &project_path)`.

**`run_subprocess`** (line 121):
- Runs `tokio::process::Command::new(program).args(args).current_dir(cwd)`.
- Wraps execution in a **10-second hard timeout** via `tokio::time::timeout`.
- Returns `CommandOutput { stdout, stderr, exit_code }` in all cases — never errors on non-zero exit, errors only if the binary is not found or times out.
- No output-size bounding (stdout+stderr collected unbounded — a concern for task 5.3).

Both commands are registered in `src-tauri/src/lib.rs` (lines 65–66) via `tauri_specta::collect_commands!` and exposed through the generated `src/bindings.ts` TypeScript interface.

---

## Named commands needed

Based on the audit, these named Tauri commands should be created for tasks 3.2 and 3.3:

### bd operations (task 3.2)

| Proposed command name | bd subcommand | Dynamic args |
|---|---|---|
| `bd_health_check` | `preflight \| doctor \| lint \| stale \| orphans` | `check: BdHealthCheck` (enum, one of the five fixed keys) |
| `bd_formula_list` | `formula list --json` | none |
| `bd_formula_pour` | `mol pour <name>` | `name: String` (validated against formula list response) |
| `bd_human_list` | `human list --json` | none |
| `bd_human_respond` | `human respond <id> <text>` | `id: String`, `text: String` |
| `bd_human_dismiss` | `human dismiss <id>` | `id: String` |

All six bd commands should resolve cwd from the project registry by project ID (per task 3.4) and resolve the binary from `AppSettings` (per task 3.5). The `check` argument for `bd_health_check` must be a Rust enum so only the five fixed check names are accepted — not an arbitrary string.

### ruflo operations (task 3.3)

| Proposed command name | ruflo subcommand | Dynamic args |
|---|---|---|
| `ruflo_memory_search` | `memory search -q <query> --format json` | `query: String` |
| `ruflo_version_probe` | `--version` | none |

For `ruflo_memory_search`, the `query` string is derived from task metadata (title + label concatenation) in the frontend, but should be passed as an opaque string — no allowlisting of query terms needed since `memory search` is a read-only operation.

`ruflo_version_probe` takes no dynamic args at all and can be the simplest possible named command.

### Not found: settingsStore.ts

Task 3.1 specifically mentioned auditing `src/stores/settingsStore.ts` — this file contains no `runBdCommand` or `runRufloCommand` calls. It uses `@tauri-apps/plugin-store` (the Tauri KV store plugin) for settings persistence, not the CLI delegation commands. No action needed there.
