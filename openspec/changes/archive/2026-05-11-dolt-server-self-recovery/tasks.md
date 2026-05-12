## 1. Rust Recovery Layer Scaffolding

- [x] 1.1 Add `sysinfo` to `src-tauri/Cargo.toml` for cross-platform process enumeration.
- [x] 1.2 Create `src-tauri/src/db/recovery.rs` module with the `DoltHealth` enum, `HealthReport` struct, and `RecoveryError` types.
- [x] 1.3 Wire `recovery.rs` into the existing connection-pool module so `open_pool(project)` calls `recovery::guard(project)` first.
- [x] 1.4 Confirm `cargo check` and `cargo clippy --workspace` pass with the new module wired in.

## 2. Health Probe

- [x] 2.1 Implement `probe(addr, deadline)` performing TCP connect (1s) + `SELECT 1` (2s) via `sqlx`/`mysql_async`, returning a typed `DoltHealth` variant.
- [x] 2.2 Wrap the probe in a `tokio::time::timeout(Duration::from_secs(3), ...)` so the total never exceeds the deadline.
- [x] 2.3 Map each failure path to a specific `DoltHealth` variant (`PortBoundButNotResponding`, `NotRunning`, `ForeignProcessHoldingPort`).
- [x] 2.4 Unit test the probe against a fake `tokio::net::TcpListener` that accepts but never responds (verifies the 2s SQL-ping timeout).
- [x] 2.5 Unit test the probe against a closed port (verifies the 1s connect timeout).

## 3. Process Enumeration and Classification

- [x] 3.1 Implement `enumerate_dolt_processes(data_dir)` using `sysinfo` — return all current-user processes whose command line contains `dolt sql-server` and references the canonicalized `data_dir`.
- [x] 3.2 Implement `read_supervisor_pid(project)` that loads `.beads/embeddeddolt/.supervisor.pid` and returns `Option<SupervisorRecord { pid, port, started_at }>`. Unreadable / corrupt file returns `None` and logs a warning.
- [x] 3.3 Implement `classify(candidates, supervisor_record)` returning `Vec<OrphanInfo>` excluding the current supervisor (by PID + start time disambiguation per design §2).
- [x] 3.4 Unit test classification with: no supervisor file → all are orphans; matching supervisor PID + start time → none orphans; recycled PID with later start time → orphan.

## 4. Safety Predicates

- [x] 4.1 Implement predicate `same_user(pid)` using `sysinfo::Process::user_id()`.
- [x] 4.2 Implement predicate `data_dir_matches(process_cmdline, expected_dir)` with canonicalized path comparison.
- [x] 4.3 Implement predicate `no_clients_connected(port)` via a quick `SHOW PROCESSLIST` if the port responds; if unreachable, return `true` by definition (no clients can talk to it either).
- [x] 4.4 Implement predicate `working_set_clean(port)` via a quick `SELECT dolt_status()` if the port responds; if unreachable, return `Err(NotVerifiable)` which forces escalation.
- [x] 4.5 Compose `is_safe_to_auto_kill(orphan)` returning `SafetyDecision::{Allowed, Escalate(reason)}`.
- [x] 4.6 Unit test that data-dir mismatch always escalates regardless of `force` flag.
- [x] 4.7 Unit test that different-user ownership always escalates regardless of `force` flag.

## 5. Kill Sequence and Respawn

- [x] 5.1 Implement `terminate_graceful(pid)` (SIGTERM on POSIX, graceful TerminateProcess on Windows) via `sysinfo::Process::kill_with(Signal::Term)` with a platform shim.
- [x] 5.2 Implement `wait_for_exit(pid, Duration::from_secs(5))` polling every 250ms.
- [x] 5.3 Implement `terminate_forceful(pid)` (SIGKILL / forceful TerminateProcess) as fallback.
- [x] 5.4 Implement `cleanup_lock_files(project)` removing `.beads/embeddeddolt/.dolt/.lock` and `.beads/embeddeddolt/.supervisor.pid` if present.
- [x] 5.5 Implement `respawn_supervisor(project)` that calls the existing dolt-spawn code path and, on first SQL-ping success, writes the new supervisor PID/port/started_at to `.supervisor.pid` atomically (write to temp + rename).
- [x] 5.6 Append `.beads/embeddeddolt/.supervisor.pid` to project's `.gitignore` patterns (one-line addition).

## 6. Recovery State Machine

- [x] 6.1 Implement `guard(project) -> Result<(), RecoveryError>`:
  1. Run probe; if `Ok`, return.
  2. Enumerate + classify orphans.
  3. For each orphan, check safety predicates.
  4. If all safe, run kill sequence + respawn + return Ok.
  5. If any unsafe, emit `dolt-recovery-required` event and wait for `attempt_dolt_recovery(force)` Tauri command.
- [x] 6.2 Implement Tauri command `probe_dolt_health(project_id) -> HealthReport` (typed via `specta`/`tauri-specta`).
- [x] 6.3 Implement Tauri command `attempt_dolt_recovery(project_id, force: bool) -> RecoveryResult` (typed).
- [x] 6.4 Verify auto-generated TS bindings compile from the frontend (`bun run tsc --noEmit`).

## 7. Recovery Log

- [x] 7.1 Implement `log_path()` returning the platform-appropriate location (macOS `~/Library/Logs/beads-ui/recovery.log`, Linux `~/.local/share/beads-ui/recovery.log`, Windows `%LOCALAPPDATA%\beads-ui\Logs\recovery.log`).
- [x] 7.2 Implement `append(entry: LogEntry)` that writes one JSON-Lines record with a file lock to avoid interleaving across processes.
- [x] 7.3 Implement rotation: when size > 5MB, rename to `.log.1` (overwriting any existing) and start a fresh `.log`.
- [x] 7.4 Instrument `guard()`, `classify()`, kill sequence, and respawn with appropriate log events (`probe_ok`, `orphan_detected`, `auto_kill`, `force_kill`, `spawn_supervisor`, `modal_shown`, `user_force`).
- [x] 7.5 Unit test that 6MB of writes produces one rotation and that both files together preserve all entries.

## 8. Frontend Recovery Modal

- [x] 8.1 Create `src/components/recovery/RecoveryDialog.tsx` modal with: plain-language summary, table of (PID, port, data_dir, status), buttons (Try again / Force kill and retry / Open recovery log / Quit app).
- [x] 8.2 Make the modal non-dismissable: no Escape, no outside-click handlers; only the explicit buttons advance state.
- [x] 8.3 Wire the modal into `App.tsx` provider stack near the project-open boundary; render it when a `dolt-recovery-required` Tauri event has fired and not yet been resolved.
- [x] 8.4 Wire "Try again" → `probe_dolt_health(projectId)`, "Force kill and retry" → `attempt_dolt_recovery(projectId, true)`, "Open recovery log" → Tauri `shell.open(log_path)`, "Quit app" → Tauri `app.exit(0)` (with all pools drained).
- [x] 8.5 Visual review: matches existing Tailwind palette (`border-neutral-800`, `bg-neutral-900`); modal renders above all other UI.

## 9. End-to-End Verification

- [x] 9.1 Reproduce the original wedge: kill the supervisor's parent (e.g. `pkill -9 beads-ui`), confirm a stale `dolt sql-server` survives. Relaunch the app and confirm it auto-recovers without a modal in under 8s, and the recovery log has `auto_kill` + `spawn_supervisor` entries.
- [x] 9.2 Reproduce the unsafe path: start the app, make and don't commit a dolt edit, kill the app, restart. Confirm the modal appears citing dirty working set. Click "Force kill and retry"; confirm a `user_force` log entry and successful respawn.
- [x] 9.3 Reproduce the foreign-port case: bind port 49226 (or whatever is configured) with `nc -l` and launch the app. Confirm the modal appears citing `ForeignProcessHoldingPort` and that the "Force kill and retry" button is disabled (or the underlying command refuses) since the holder isn't a dolt process.
- [x] 9.4 Reproduce the different-user case (skip on single-user dev box): use `sudo -u other` to spawn a dolt sql-server matching this data dir. Confirm the modal appears citing different-user, and that "Force kill and retry" does NOT bypass the ownership predicate.
- [x] 9.5 Run `cargo test --workspace` and confirm all Rust unit tests pass.
- [x] 9.6 Run `bun run tsc --noEmit && bun run build` and confirm both succeed.
- [x] 9.7 Run `openspec validate dolt-server-self-recovery` and confirm the change is valid.
