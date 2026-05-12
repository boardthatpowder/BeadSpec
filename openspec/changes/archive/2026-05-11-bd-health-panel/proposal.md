## Why

The `bd` CLI exposes several health-check commands (`bd preflight`, `bd doctor`, `bd lint`, `bd stale`, `bd orphans`) that surface project integrity issues, but these are only accessible from the terminal. Users working primarily in the Beads UI have no way to see or act on this health information without leaving the app.

## What Changes

- **New Tauri command** `run_bd_command(args: Vec<String>) -> CommandOutput` in `src-tauri/src/commands/external.rs` — generic, read-only shell-out to the `bd` CLI with 10-second timeout, capturing stdout/stderr/exit_code.
- **PATH resolution at startup**: `AppState` caches the resolved path to the `bd` binary (via `which bd`) so subsequent calls do not incur repeated PATH lookups; graceful "CLI not found" degradation when the binary is absent.
- **New React component** `BdHealthPanel.tsx` that runs the five health checks sequentially, renders each as a named section, and shows a green "All checks passed" banner when all exit 0.
- **Issue ID chips**: any `BUI-[a-z0-9]+` token in check output renders as a clickable chip that navigates to the task detail view.
- **Re-run button**: user-initiated refresh only — no auto-polling.
- **Layout update**: Health view accessible from top-level navigation in ≤ 2 clicks.

## Capabilities

### New Capabilities

- `bd-health-panel`: Health view that surfaces `bd preflight`, `bd doctor`, `bd lint`, `bd stale`, and `bd orphans` results as named sections with clickable issue ID chips and a re-run button.

### Modified Capabilities

- `layout-shell`: Health view must be reachable from top-level navigation in ≤ 2 clicks (new nav entry or Tools menu addition).

## Impact

- **New file**: `src-tauri/src/commands/external.rs` — `run_bd_command` command, `bd` binary path resolution.
- **Modified file**: `src-tauri/src/commands/mod.rs` — register `external` module and new command with Tauri + specta.
- **Modified file**: `src-tauri/src/main.rs` (or `lib.rs`) — cache `bd` binary path in `AppState` at startup.
- **Regenerated**: TypeScript bindings via `tauri-specta` codegen after adding the new command.
- **New file**: `src/components/bd-health/BdHealthPanel.tsx`.
- **Modified file**: `src/components/layout/index.tsx` — add Health nav entry.
- **No new npm dependencies** required; no breaking changes to existing IPC contract.
