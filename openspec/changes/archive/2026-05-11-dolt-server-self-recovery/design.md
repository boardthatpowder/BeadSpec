## Context

`beads-ui` opens a project by spawning or connecting to a `dolt sql-server` whose port is recorded in `.beads/embeddeddolt/config.yaml`. When the previous process supervising the server dies uncleanly (Tauri force-quit, OOM, laptop sleep, `kill -9`), the dolt process can survive — orphaned but still bound to a port — while the next launch tries to spawn a new server on the configured port and hangs because the data dir is locked. The `bd` CLI, which shares the same backend, exhibits identical symptoms (silent hang). We observed this live during a session: two stale `dolt sql-server` processes (PIDs 51084 from a Friday evening, 42791 from earlier the same day) were running on `:59523` and `:64223` respectively, while the current `config.yaml` pointed at `:49226` with nothing listening, and every `bd` call hung indefinitely.

The recovery layer lives in Rust because that is where the connection pool lives, and because process enumeration + kill is cleanest from a native binary. The frontend's job is to surface the situation when the safe-path remediation is not possible and to provide a one-click override.

## Goals / Non-Goals

**Goals:**

- Launch never hangs. Either we connect, or we surface a user-actionable error within a known deadline (target: 8 seconds from project-open).
- Automatic remediation when ownership and safety are provable (current user, this project's data dir, no uncommitted working set).
- Clear escalation when automatic remediation is unsafe: a modal lists offending PIDs/ports, explains why we can't act, and offers a `--force` button the user must opt into.
- All probe attempts, classification decisions, kill operations, and respawns are logged to `~/Library/Logs/beads-ui/recovery.log` (or platform-equivalent) with enough context that a remote incident can be diagnosed.
- Cross-platform: macOS, Windows, Linux.

**Non-Goals:**

- Mid-session disconnect recovery (the existing "stale" indicator from `data-layer` continues to handle that).
- Dolt data corruption recovery — out of scope; this addresses supervisor-level wedges only.
- Modifying the `bd` CLI. The fix lives in `beads-ui`; bd benefits indirectly because the app's recovery clears the same wedge bd is hitting.
- A separate steady-state health monitor. We only run the guard at project-open.

## Decisions

### 1. Probe with a hard deadline, not just TCP connect

A simple TCP connect can succeed against a zombie server that no longer accepts queries. The probe issues a real SQL ping (`SELECT 1`) with a 3-second total deadline (1s connect + 2s query). Failure modes are classified into a typed enum:

```rust
enum DoltHealth {
    Ok,
    PortBoundButNotResponding { pid: Option<u32> },
    PortUnboundButOrphanRunning { pid: u32, port: u16, data_dir: PathBuf },
    NotRunning,
    ForeignProcessHoldingPort { pid: u32, exe: String },
}
```

**Alternative considered:** Rely on `bd`'s own retry logic. Rejected — bd hangs silently on the same wedge today; the recovery has to live above it.

### 2. Orphan detection via process enumeration

On every project-open, enumerate processes named `dolt`, owned by the current user, with `sql-server` in their argv. For each candidate, read its `--data-dir` (or default `.`) argument and compare to the project's expected data dir. A process is an orphan when:

- (`data-dir == this project's .beads/embeddeddolt/.dolt`) AND (`port mismatch from config.yaml` OR `port matches but SQL ping failed`), OR
- (`data-dir matches`) AND (`PID does not match the supervisor PID we last recorded in .beads/embeddeddolt/.supervisor.pid`).

We persist our supervisor PID + port to `.beads/embeddeddolt/.supervisor.pid` (and ignore in `.gitignore`) at spawn time. This makes "is this our current supervisor or a stranger" a one-line check next launch.

**Alternative considered:** Use OS process trees / parent-PID chains. Rejected — Tauri lifecycle on macOS reparents to launchd on crash; PPID becomes unreliable.

### 3. Safety predicates before automatic kill

Auto-kill is allowed only when ALL of:

1. Process is owned by current user (`uid` check via `sysinfo`).
2. Command line includes our exact data dir (string match against canonicalized path).
3. No clients are currently connected (probe via `SHOW PROCESSLIST` if we can briefly connect; if we can't connect at all, this check is satisfied by definition since no one else can either).
4. Working set is clean (probe via `SELECT dolt_status()` — if we can connect; if not, skip and warn in the modal).

If any predicate fails, escalate to the modal. The user can override with `--force`, which bypasses 3 and 4 but never 1 or 2 (we will never kill another user's process or a process for a different project, even on force).

### 4. Remediation sequence

When safety predicates pass:

1. Send `SIGTERM` (POSIX) / `TerminateProcess` graceful (Windows).
2. Wait up to 5 seconds for exit (poll every 250ms).
3. If still alive, send `SIGKILL` / `TerminateProcess` forceful.
4. Delete stale lock files: `.beads/embeddeddolt/.dolt/.lock`, `.beads/embeddeddolt/.supervisor.pid`.
5. Re-probe — port should be free.
6. Spawn the new supervisor per current code path.
7. Record new supervisor PID + port to `.beads/embeddeddolt/.supervisor.pid`.

Each step logs to `recovery.log` with timestamp, PIDs, and outcome.

### 5. Frontend escalation: RecoveryDialog

When the Rust backend cannot safely auto-recover, it emits a Tauri event `dolt-recovery-required` with the `HealthReport` payload. The frontend renders `RecoveryDialog` modally over `App.tsx`, showing:

- A plain-language summary ("A previous Dolt server is still running on port 64223 and we can't safely kill it because it has uncommitted edits.").
- A table of offending PIDs / ports / data-dirs / status.
- Two buttons: "Try again" (re-probe) and "Force kill and retry" (calls `attempt_dolt_recovery(projectId, force: true)`).
- An "Open recovery log" link that opens the platform-appropriate location.

**Alternative considered:** Crash to a toast with retry. Rejected — the user needs to see *why* and *what*, not just "try again".

### 6. Logging shape

`recovery.log` is JSON-Lines. Each entry:

```json
{
  "ts": "2026-05-11T14:33:11Z",
  "project": "/Users/dean/workspaces/beads-ui",
  "event": "orphan_detected" | "auto_kill" | "force_kill" | "probe_ok" | "spawn_supervisor" | "modal_shown" | "user_force",
  "pid": 51084,
  "port": 59523,
  "data_dir": "/Users/dean/workspaces/beads-ui/.beads/embeddeddolt/.dolt",
  "outcome": "...",
  "duration_ms": 124
}
```

A future incident becomes "send me your recovery.log."

### 7. Probe is invoked on every project-open

The guard runs unconditionally before any read or write against a freshly opened project. It does NOT run on every query (too noisy). Mid-session connection failures continue to flow through the existing `data-layer` stale-data indicator path.

## Risks / Trade-offs

- **False-positive orphan classification**: Two beads-ui windows opening the same project nearly simultaneously could mis-identify each other's supervisor. → Mitigated by writing the supervisor PID atomically and checking process start time (a process older than this launch is not "us").
- **Process-list permission issues on Windows**: Enumerating other-user processes on Windows requires elevated permissions. → Restrict to current-user processes (predicate 1); if a different user owns the orphan, escalate to the modal with a "can't act, please log out the other session" message.
- **Stale `.supervisor.pid` after disk-full or crash mid-write**: → Treat unreadable / partial supervisor.pid as "no supervisor"; safer to escalate than to assume.
- **`sysinfo` crate bloat**: Adds ~1MB to the binary. → Acceptable given the scope of the problem it solves; the alternative (shell out to `ps`/`tasklist`) is more fragile and platform-divergent.
- **Frontend modal can be dismissed before recovery decision**: → Modal is non-dismissable (no Escape, no outside-click); only the explicit buttons advance state.
- **Kill of orphan that is mid-commit could leave Dolt in a recoverable but worrying state**: → That is precisely why the working-set predicate runs before auto-kill; the modal path makes the user own that risk.
- **Cross-platform process kill semantics**: `SIGTERM` is meaningless on Windows. → Use `sysinfo::Process::kill_with(Signal::Term)` on POSIX and `Process::kill()` on Windows, abstracted via a small `process::terminate()` helper.

## Migration Plan

1. Land the recovery guard behind no flag — it runs on every project-open.
2. No data migration; `.beads/embeddeddolt/.supervisor.pid` is created on first successful spawn after the upgrade.
3. Rollback: revert the PR — the absence of `.supervisor.pid` is handled gracefully by the old code (it never read it).

## Open Questions

- Should the modal include a "Quit beads-ui" button that exits the app cleanly without retrying? **Tentative:** yes, since a user who can't recover should be able to leave with a clean Tauri exit (which itself flushes any uncommitted writes from other projects).
- Where exactly does `recovery.log` live on Linux? **Tentative:** `~/.local/share/beads-ui/recovery.log` per XDG. macOS: `~/Library/Logs/beads-ui/recovery.log`. Windows: `%LOCALAPPDATA%\beads-ui\Logs\recovery.log`.
- Do we want to bound the recovery.log file size? **Tentative:** rotate at 5MB with one backup file; not load-bearing for v1.
