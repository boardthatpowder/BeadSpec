## Context

BeadSpec's current Tauri security posture treats all renderer-originating calls as trusted. CSP is `null`, the default capability grants `shell:allow-execute`, `shell:allow-open`, and `opener:default` to all windows, and two generic IPC commands (`runBdCommand`, `runRufloCommand`) accept free-form args, cwd, and binary paths supplied by the renderer. A single XSS or supply-chain compromise in a JS dependency can pivot to arbitrary local CLI execution through the app's own trusted IPC.

Correctness gaps compound the risk surface: the label `IN (...)` clause interpolates issue IDs as strings, the 2000-row task cap silently drops tasks in large projects, the Dolt `working_set_clean` predicate queries `information_schema` instead of the Beads DB, and sidecar startup claims success as soon as any TCP listener occupies the port without verifying SQL readiness.

This pass hardens the security boundary, fixes the correctness bugs, and restores hygiene (Rust formatting, bindings discipline).

## Goals / Non-Goals

**Goals:**
- Eliminate renderer-to-shell escalation path (CSP + capability splits + IPC allowlist)
- Canonicalize project paths and remove `database_url` from frontend IPC
- Centralize subprocess execution with timeout and kill semantics
- Fix label SQL injection surface
- Fix silent 2000-row task truncation
- Fix Dolt recovery predicate and port-race window
- Close TipTap HTML-parsing XSS surface
- Enforce bindings discipline via lint
- Pass `cargo fmt --check`

**Non-Goals:**
- End-to-end encryption of data at rest
- Changes to the bd CLI wire protocol
- Restructuring the multi-project connection pool
- Modifying real-time sync mechanism
- Replacing sqlx with a different ORM

## Decisions

### Decision: Capability split per window rather than one shared file

Tauri 2 supports per-window capability files. Split `default.json` into `main-window.json` and `quick-capture.json`. Each window gets only the permissions it needs. `shell:allow-execute` is removed entirely from both — the app shells out through Rust commands, not through the renderer's `shell` plugin. `opener:default` is retained in `main-window.json` only for opening external URLs (links in task descriptions); `quick-capture.json` gets none.

Alternatives considered: single file with tighter scope — rejected because Tauri's capability model is flat; you can't scope a permission to a specific command within a window, only to a window type.

### Decision: Replace runBdCommand / runRufloCommand with named Rust commands

The generic runners exist for convenience during development. They will be replaced with one named Tauri command per logical operation (e.g., `bd_create_task`, `bd_update_status`, `ruflo_memory_store`). Each command validates its own inputs, uses a fixed binary path (resolved once at startup from PATH or the settings-provided override), and a fixed cwd derived from the project registry.

Binary-path overrides from settings are validated at settings-save time with a user-confirmation dialog, not at invocation time. The resolved binary path is stored in Rust state; the frontend never supplies it at call time.

Alternatives considered: allowlist of permitted (command, args) pairs — rejected because it's hard to maintain and still trusts renderer-supplied args values.

### Decision: Opaque project ID instead of database_url

The `open_project` command currently returns `database_url` to the frontend. The frontend uses it only to display the connection info in the status bar — a use case that can be served by returning the canonicalized project path (which is user-visible and not a secret). The actual database URL is derived in Rust from the project registry and never crosses IPC.

### Decision: Cursor-based pagination with (priority, created_at, id) composite sort key

The 2000-row cap is replaced with keyset pagination using a `(priority DESC, created_at DESC, id ASC)` composite sort. This is stable under concurrent inserts and works with Dolt's MySQL-compatible engine. Page size defaults to 200 rows. The `get_tasks` command gains `limit`, `after_cursor` (opaque base64 JSON of the last row's sort key), and returns `total_count` (pre-filter COUNT(*)) and `next_cursor`. TanStack Query keys include all server-side filter params so filtered and unfiltered views have independent caches.

Alternatives considered: offset pagination — rejected because large offset scans are O(offset) in MySQL-compatible engines and results shift when tasks are created/deleted during pagination.

### Decision: sqlx::QueryBuilder for IN() clause

`QueryBuilder::new("SELECT ... WHERE issue_id IN (")` with `.push_bind()` for each ID. This produces parameterized SQL regardless of ID content.

### Decision: Centralized spawn_managed utility

A single `spawn_managed(cmd, args, cwd, timeout: Duration) -> Result<Output>` function in `bd/runner.rs` using `tokio::process::Command` with `.kill_on_drop(true)`. On timeout, the child is explicitly killed with `.kill().await` before returning an error. Output is bounded to 1 MiB via `take(1 << 20)`. All existing bd/ruflo/git callers are migrated to use it.

### Decision: Dolt working_set_clean connects to the Beads DB

The predicate currently opens a connection to `information_schema` (always reachable) and queries `dolt_status` there (which returns nothing useful). It will instead connect to the project's Beads database directly. If connection fails, the predicate returns `Err` (escalate, don't auto-kill). After sidecar spawn, a `SELECT 1` from the Beads DB is required before writing the supervisor PID file.

Port race: after `free_port()` selects a port and before the sidecar binds it, another process can steal it. Fix: retry the spawn up to 3 times with a new free port on each attempt. Detect failure by checking whether the sidecar's `SELECT 1` health check fails with "connection refused" within 1 second.

### Decision: TipTap html: false via StarterKit configure

The `@tiptap/starter-kit` extension passes through raw HTML by default. Set `StarterKit.configure({ ... })` with the underlying `html` extension disabled, and pass `{ html: false }` to `generateHTML` / `generateJSON`. For existing descriptions that contain raw HTML, run a one-time sanitization pass on load using DOMPurify (already available).

### Decision: ESLint no-restricted-imports for @tauri-apps/api/core

Add a `no-restricted-imports` rule in the ESLint config banning `@tauri-apps/api/core` everywhere except `src/bindings.ts`. This catches raw `invoke()` calls at lint time. CI runs ESLint, so this becomes a merge gate.

## Risks / Trade-offs

- [CSP `'unsafe-inline'` for styles] Tailwind's JIT injects inline styles in some variants; if any component relies on them, the CSP will break the UI. Mitigation: audit component library usage and add a `style-src 'nonce-...'` or `'sha256-...'` if needed; test visually in dev before shipping.
- [Pagination response shape change] `get_tasks` return type changes are breaking — all frontend callers must be updated atomically. Mitigation: update frontend in the same PR; compile-time specta binding generation catches mismatches before runtime.
- [Named IPC commands] Enumerating all bd/ruflo operations may miss edge cases or future extensions. Mitigation: keep a clearly documented allowlist in `src-tauri/src/commands/external.rs` with a comment requiring review for additions.
- [Keyset pagination + real-time sync] When tasks are created or deleted between pages, the `total_count` snapshot may be stale. Mitigation: the frontend shows a "X tasks (may be approximate)" indicator when paginating; real-time sync events trigger a full re-fetch of the first page.
- [spawn_managed output cap] The 1 MiB output cap may truncate very verbose bd commands. Mitigation: the cap is for security (unbounded allocation via large output); bd commands are not expected to produce > 1 MiB; if they do, log a warning and surface a truncated-output error.

## Migration Plan

1. **cargo fmt** — no behavior change, land first as a standalone commit.
2. **CSP + capability split** — land as Tauri config change; visual smoke-test in dev.
3. **IPC allowlist** — land as combined Rust + TypeScript change; the old commands are deleted, not deprecated.
4. **Project path canonicalization + opaque ID** — land as combined Rust + TypeScript change; update the status bar component to use canonical path.
5. **spawn_managed** — pure Rust refactor; no frontend changes.
6. **SQL safety (QueryBuilder)** — pure Rust change; no frontend changes.
7. **Dolt recovery** — pure Rust change; update tests.
8. **Task pagination** — land as combined Rust + TypeScript change; largest surface area, ship after all other items.
9. **Markdown safety + bindings discipline** — land as frontend-only changes.

Rollback: all changes are local-only (no git remote push until the full pass is complete). Each item is a separate commit; revert is straightforward.

## Open Questions

- Should `opener:default` be retained for `quick-capture.json`? The quick-capture window currently has no link-clicking functionality, so it can be omitted — confirm with product that no link-opening is expected there.
- The bd/ruflo command enumeration: are there any one-off `runRufloCommand` calls used only in developer/debug flows that should be removed entirely rather than ported?
