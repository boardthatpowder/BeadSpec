## Context

The `bd` CLI is the canonical interface for Beads project management. Several diagnostic subcommands (`preflight`, `doctor`, `lint`, `stale`, `orphans`) surface project integrity issues but are only reachable from a terminal. BeadSpec currently has no mechanism to shell out to external binaries; all data flows through Dolt SQL or bd-CLI-written files. Adding a generic `run_bd_command` Tauri command establishes a controlled, read-only bridge to the CLI without coupling the UI to individual bd subcommand logic.

## Goals / Non-Goals

**Goals:**
- Introduce a single generic Tauri command (`run_bd_command`) suitable for any read-only bd invocation.
- Cache the resolved `bd` binary path in `AppState` to avoid repeated PATH lookups.
- Render the five health checks as named output sections with clickable issue ID chips.
- Gate the health panel on binary availability; degrade gracefully when bd is absent.
- Keep the UI update model simple: user-initiated re-run, no background polling.

**Non-Goals:**
- Streaming output to the frontend — full output is captured after command completes.
- Write/mutating bd commands via this same command (those will need separate review and confirmation flows).
- Auto-remediation of health check failures.
- Configurable check list or ordering.
- Windows PATH lookup (initial release targets macOS/Linux; Windows can be added later).

## Decisions

### Generic command vs. per-check commands

**Decision**: One generic `run_bd_command(args: Vec<String>) -> CommandOutput` rather than five separate Tauri commands.

**Rationale**: All five checks share identical execution semantics (spawn, 10s timeout, capture stdout/stderr/exit_code). A generic command avoids five nearly-identical Rust functions and matching TS bindings. The frontend is responsible for associating an args vector with a display label, keeping Rust ignorant of bd subcommand semantics.

**Alternative considered**: Per-command endpoints (e.g., `run_bd_preflight`) — rejected because it couples the Rust layer to bd subcommand names and requires regenerating bindings each time a new check is added.

### PATH resolution strategy

**Decision**: Resolve `bd` binary path once at `AppState` construction (app startup) using `which` / `std::process::Command` PATH search, store as `Option<PathBuf>` in `AppState`.

**Rationale**: PATH is stable for the lifetime of a desktop app process. Caching avoids repeated filesystem lookups on every health-panel refresh. Storing `None` when bd is not found allows the frontend to show a "bd not found" state without attempting an invocation.

**Alternative considered**: Resolve on every `run_bd_command` call — rejected for performance and because it gives inconsistent errors if PATH changes mid-session (unlikely but confusing).

### Timeout

**Decision**: Hard 10-second timeout per command; if exceeded, kill the child process and return a synthetic stderr message and non-zero exit code.

**Rationale**: Health checks are expected to complete in under a second on typical projects. A 10s ceiling prevents the UI from hanging indefinitely on a broken environment without requiring a cancellation flow.

### Issue ID chip regex

**Decision**: Regex `BUI-[a-z0-9]+` applied to raw stdout/stderr text; tokens matching this pattern are replaced with clickable `<Chip>` components that invoke the existing task-detail navigation.

**Rationale**: Matches the id format used throughout the codebase. Case-sensitive lowercase suffix matches bd's output conventions.

**Alternative considered**: Full markdown link parsing — rejected as overkill; bd output is plain text.

### Execution order

**Decision**: Checks run sequentially on the frontend (one `invoke` call per check, awaited in order): `preflight` → `doctor` → `lint` → `stale` → `orphans`. Each section renders as soon as its result resolves.

**Rationale**: Sequential execution makes ordering deterministic and failure isolation obvious. The frontend can show progressive results (first section appears while later ones are still running) without a streaming protocol.

### "All checks passed" banner

**Decision**: A green banner replaces the section list only when all five checks return exit_code 0 and no output sections contain content flagged as warnings.

**Rationale**: Positive reinforcement for a clean project; avoids clutter when there is nothing to act on.

## Risks / Trade-offs

- **[Risk] bd binary absent on first run** → Mitigation: `AppState` stores `None`; `BdHealthPanel` renders an instructional "bd CLI not found — install bd to use this panel" state with a doc link.
- **[Risk] Sensitive project data in stdout** → Mitigation: `run_bd_command` is read-only and scoped to the user's own project directory. No output is sent to remote services.
- **[Risk] Command injection via args** → Mitigation: args are passed as a `Vec<String>` to `std::process::Command::args()`, not interpolated into a shell string. Shell injection is not possible.
- **[Risk] Long-running checks freeze UI** → Mitigation: 10s timeout + sequential async invocations keep the Tauri async runtime free; the UI remains responsive between check completions.
- **[Risk] specta codegen drift** → Mitigation: regenerate bindings as a required task step; CI will catch type mismatches.

## Migration Plan

1. Add `external.rs` with `run_bd_command` and bd PATH resolution.
2. Register command and module; regenerate specta bindings.
3. Implement `BdHealthPanel.tsx`.
4. Wire Health nav entry in `layout/index.tsx`.
5. Manual smoke test on a real project (verify chips navigate correctly).
6. No database migrations or data-format changes required; rollback is a revert of the four file changes.

## Open Questions

- Should the Health view live under a "Tools" submenu or as a top-level nav item? (To be resolved in layout-shell delta spec — default assumption: top-level nav item named "Health".)
- Should `run_bd_command` be gated to a specific project root, or allow callers to pass a working directory? (Current design: always uses the active project's root from AppState.)
