# Proposal: Dolt Server Self-Recovery

## Why

Today the app (and the `bd` CLI it shells out to) silently hangs when stale `dolt sql-server` processes remain alive after a prior bad shutdown or crash. We just observed this live: two zombie dolt servers (PIDs 51084 from a previous evening, 42791 from earlier the same day) were bound to historic ports, the current bd config pointed at port 49226 with nothing listening, and every `bd list` / `bd create` call hung indefinitely with no diagnostic output. The only fix was a human noticing the wedge and manually killing the stale processes. From a real user's point of view, the app would appear frozen on launch with no actionable signal — exactly the failure mode the `data-layer` "Application gracefully handles Dolt connection failure" requirement was meant to prevent, but the current implementation only covers *unreachable*, not *stale-but-orphaned*.

This is a reliability gap we will hit again — Tauri windows get force-quit, laptops sleep, OOM-kills happen — and each occurrence wedges the app on next launch. The goal is a self-recovery path: detect the wedge, attempt safe automatic recovery, and surface a clear actionable error if automatic recovery isn't safe.

## What Changes

- **NEW**: A "Dolt connectivity guard" that runs at project-open time. Before issuing any read or write, it probes the configured Dolt SQL endpoint, detects stale supervisor state, and either heals it or fails fast with a user-actionable error — never hangs silently.
- **NEW**: Detection of *orphaned* `dolt sql-server` processes — running but not bound to the project's configured port, OR bound to a different project's data dir, OR with a stale `.dolt/.lock` file pointing at a dead PID.
- **NEW**: Safe automatic remediation when ownership is provable (PID belongs to current user, command line includes this project's data dir, no clients are connected, no uncommitted working set). Kills the orphan and respawns the supervisor.
- **NEW**: An in-app "Recovery" modal that surfaces the problem when remediation is NOT safe (e.g. uncommitted dolt working set, or the orphan owns a different open project). The modal lists the offending PIDs and offers one-click "Kill and retry" with a `--force` flag the user must opt into.
- **MODIFIED**: The `data-layer` "Application gracefully handles Dolt connection failure" scenario expands to cover hang detection (a probe deadline, not just connection refusal) and a distinguishing of "unreachable" vs "wedged".
- **NEW**: Telemetry-quality logging — every probe attempt, every detected orphan, every kill, and every successful re-spawn is logged with PIDs and ports so a future incident is debuggable in seconds.

## Capabilities

### New Capabilities

- `dolt-server-recovery`: The startup-time guard that probes, classifies, and (when safe) heals stale Dolt SQL server state for a given project. Owns the recovery state machine, the per-project safety predicates, the one-click manual-override UI, and the logging surface.

### Modified Capabilities

- `data-layer`: The "Direct Dolt SQL Reads" requirement gains a "Connection probe with deadline before opening pool" scenario; the existing "Application gracefully handles Dolt connection failure" requirement is split to distinguish *unreachable* from *wedged*, and the wedged case is delegated to the new `dolt-server-recovery` capability.

## Impact

- **Affected Rust modules**: `src-tauri/src/db/` (whatever owns the Dolt connection pool today), plus a new `src-tauri/src/db/recovery.rs` that owns the probe + classify + remediate state machine. Process listing uses `sysinfo` crate (already common in Tauri stacks) or a thin `ps`/`lsof` shell-out where `sysinfo` is insufficient.
- **Affected frontend**: A new `src/components/recovery/RecoveryDialog.tsx` rendered when the Rust backend emits a `dolt-recovery-required` event. Wired into `App.tsx` provider stack near the project-open boundary.
- **New dependencies**: Possibly `sysinfo` (~1MB Rust crate, MIT) for cross-platform PID/cmdline enumeration. Already-present `serde`/`serde_json` are sufficient for the event payloads.
- **New Tauri commands**: `probe_dolt_health(projectId) -> HealthReport`, `attempt_dolt_recovery(projectId, force: bool) -> RecoveryResult`. Typed end-to-end via `specta` + `tauri-specta` (per existing IPC contract).
- **No bd CLI changes**: This is purely an app-side recovery layer; we do not modify bd itself. If a user invokes `bd` from a terminal while the app is wedged, that is out of scope for this change — but the app's recovery will make it more likely the next CLI invocation succeeds.
- **Cross-platform**: Implementation must work on macOS, Windows, and Linux. Process kill semantics differ (POSIX `SIGTERM` then `SIGKILL` vs Windows `TerminateProcess`); `sysinfo` abstracts this where used.
- **Safety boundary**: Recovery NEVER kills a `dolt sql-server` whose data-dir does not match the project we are trying to open, NEVER touches processes owned by other users, and NEVER force-kills when the working set has uncommitted writes (probed via a quick read-only connection if any port responds).
- **Out of scope (follow-ups)**: Health monitoring during steady-state (we only run the guard at project-open), automatic recovery from mid-session disconnects (today the existing "stale indicator" path remains), and recovery of dolt-side data corruption (this change addresses *supervisor*-level wedges only).
