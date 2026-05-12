## Why

A security review surfaced 10 findings (2 High, 6 Medium, 2 Low) exposing an under-sandboxed Tauri surface: disabled CSP, broad shell capabilities, and generic IPC commands that trust renderer-supplied args and paths give a renderer compromise wide local CLI access. Correctness bugs compound the risk: an interpolated SQL `IN()` clause, a 2000-row task cap with client-side filtering, and a fragile Dolt working-set check can silently drop data. These are addressed now as a coordinated hardening pass before the app ships to additional users.

## What Changes

- **Tauri CSP & capabilities**: Enable a restrictive `Content-Security-Policy` in `src-tauri/tauri.conf.json`; split `capabilities/default.json` into per-window capability files; remove `shell:allow-execute`, `shell:allow-open`, and `opener:default` unless required; scope any retained permissions to exact targets.
- **IPC allowlist**: Replace generic `runBdCommand` / `runRufloCommand` (arbitrary args + renderer-controlled cwd and binary path) in `src-tauri/src/commands/external.rs` and `src/stores/settingsStore.ts` with named, allowlisted backend operations; validate project path against the registry; require explicit user confirmation before accepting custom binary paths.
- **Project path canonicalization**: In `src-tauri/src/commands/project.rs`, canonicalize `.beads` paths before use as registry keys; return an opaque project ID to the frontend instead of `database_url`.
- **Process supervision**: Centralize subprocess execution in `src-tauri/src/bd/runner.rs` and `src-tauri/src/commands/external.rs` with a mandatory timeout, `kill_on_drop(true)`, explicit kill/wait, and bounded output.
- **Task pagination**: Remove the 2000-row hard cap in `src-tauri/src/commands/read.rs`; move filters, search, sort, and pagination into SQL; return totals and page cursors; key TanStack Query (`src/hooks/useTasks.ts`) by server-side filter params.
- **SQL safety**: Replace the interpolated `IN (...)` label fetch in `src-tauri/src/commands/read.rs:111` with `sqlx::QueryBuilder` bound parameters.
- **Dolt recovery correctness**: Fix `working_set_clean` in `src-tauri/src/db/recovery/predicates.rs` to connect to the actual Beads DB; fix `src-tauri/src/db/dolt_server.rs` to verify SQL/schema readiness after spawn and retry on port races.
- **Markdown XSS hardening**: Set `html: false` on the Markdown TipTap extension in `src/components/task-detail/DescriptionEditor.tsx`; sanitize any legacy HTML during migration.
- **Bindings discipline**: Replace the raw `invoke()` call in `src/components/settings/SettingsDialog.tsx` with `commands.registerQuickCaptureShortcut`; add an ESLint/rg guard banning `@tauri-apps/api/core` imports outside `src/bindings.ts`.
- **Rust formatting**: Run `cargo fmt` across `src-tauri/`; add `cargo fmt --check` to CI.

**Non-goals**: This pass does not change the bd CLI wire protocol, restructure the multi-project connection pool, add end-to-end encryption, or modify the real-time sync mechanism.

## Capabilities

### New Capabilities

- `tauri-shell`: Tauri security configuration — CSP policy, per-window capability files, and shell/opener permission scoping rules.
- `ipc-allowlist`: IPC surface contract — allowlisted backend operations replacing generic command runners, project-path validation, and binary-override confirmation flow.
- `process-supervision`: Subprocess execution contract — timeout, kill semantics, bounded output, and cancellation guarantees for all spawned processes.

### Modified Capabilities

- `task-list`: Task listing now requires server-side filtering, sorting, and pagination with cursor-based results and no hardcoded row cap.
- `task-detail`: Description editor must disable HTML parsing to close the XSS surface; legacy HTML content is sanitized at load time.
- `data-layer`: Label queries must use bound parameters; project open must return an opaque ID (not `database_url`); project paths must be canonicalized before registry use; IPC contract tightened to forbid raw `invoke()` outside `src/bindings.ts`.
- `dolt-server-recovery`: `working_set_clean` predicate must connect to the Beads DB (not `information_schema`); sidecar startup must verify schema readiness and retry on port races.

## Impact

**Rust**: `src-tauri/src/commands/external.rs`, `src-tauri/src/commands/project.rs`, `src-tauri/src/commands/read.rs`, `src-tauri/src/bd/runner.rs`, `src-tauri/src/db/recovery/predicates.rs`, `src-tauri/src/db/dolt_server.rs`, `src-tauri/src/lib.rs`

**Tauri config**: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json` (split into per-window files)

**Frontend**: `src/stores/settingsStore.ts`, `src/hooks/useTasks.ts`, `src/components/task-detail/DescriptionEditor.tsx`, `src/components/settings/SettingsDialog.tsx`, `src/bindings.ts`

**Dependencies**: No new crates or npm packages anticipated; `sqlx::QueryBuilder` and `tokio` kill/timeout APIs are already in tree.

**Breaking**: The `get_tasks` Tauri command response shape changes (adds `total`, `cursor`; removes implicit 2000-row guarantee). The `open_project` response drops `database_url`. Frontend callers must be updated in the same PR.
