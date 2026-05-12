# Dolt Server Recovery Specification

## Purpose

Defines the startup-time guard that probes Dolt SQL server health before opening a connection pool, detects orphaned `dolt sql-server` processes left behind by unclean shutdowns, and either heals the situation automatically or surfaces a user-actionable recovery modal. This capability prevents silent hangs at project-open time caused by stale supervisor state.

---

## Requirements

### Requirement: Health Probe with Hard Deadline

The system SHALL probe Dolt SQL health before opening a connection pool for a project, with a hard total deadline so the app never hangs silently on a wedged server.

#### Scenario: Healthy server responds within deadline
- **WHEN** the app opens a project
- **THEN** it SHALL attempt a TCP connect to the configured port within 1 second
- **AND** SHALL issue a `SELECT 1` query that completes within an additional 2 seconds
- **AND** on success SHALL proceed to open the connection pool
- **AND** the probe outcome SHALL be logged as `probe_ok` with duration_ms

#### Scenario: Server bound to port but not responding to SQL
- **WHEN** the TCP connect succeeds but the SQL ping does not complete within 2 seconds
- **THEN** the probe SHALL classify the port as `PortBoundButNotResponding`
- **AND** the app SHALL escalate to the orphan-detection step
- **AND** the app SHALL NOT block waiting longer

#### Scenario: Probe deadline exceeded overall
- **WHEN** the combined probe steps exceed 3 seconds total
- **THEN** the probe SHALL be aborted
- **AND** the result SHALL be reported as `NotRunning` or the most specific classification reached
- **AND** the app SHALL NOT show a frozen UI

---

### Requirement: Orphan Process Detection

The system SHALL enumerate `dolt sql-server` processes owned by the current user and classify any that match the project's data directory as orphans when they are not the current supervisor.

#### Scenario: Orphan detected via data-dir match and PID mismatch
- **WHEN** the probe finishes (any outcome)
- **THEN** the system SHALL enumerate current-user processes whose command line contains `dolt sql-server` and references this project's `.beads/embeddeddolt/.dolt` data directory
- **AND** for each such process, SHALL compare its PID to the recorded supervisor PID in `.beads/embeddeddolt/.supervisor.pid`
- **AND** any process whose PID does not match the recorded supervisor SHALL be classified as an orphan
- **AND** each orphan SHALL be logged as `orphan_detected` with pid, port, and data_dir

#### Scenario: No supervisor PID file exists
- **WHEN** `.beads/embeddeddolt/.supervisor.pid` is missing or unreadable
- **THEN** any running `dolt sql-server` matching this project's data dir SHALL be classified as an orphan

#### Scenario: Foreign process holding the configured port
- **WHEN** the configured port is bound by a process whose command line is not `dolt sql-server`
- **THEN** the system SHALL classify the situation as `ForeignProcessHoldingPort`
- **AND** SHALL NOT attempt to kill the foreign process
- **AND** SHALL escalate to the user via the recovery modal

---

### Requirement: Safety Predicates Before Automatic Kill

The system SHALL automatically kill an orphan only when ALL safety predicates pass: same-user ownership, exact data-dir match, no connected clients, and a clean working set.

#### Scenario: All predicates pass — auto-kill proceeds
- **WHEN** an orphan is detected
- **AND** the process is owned by the current user (uid match)
- **AND** the canonicalized data-dir in the process command line equals this project's canonicalized data dir
- **AND** no client connections are currently held (verified via `SHOW PROCESSLIST` if accessible, OR trivially satisfied if no client can connect)
- **AND** the working set is clean (verified via `dolt_status()` if accessible, OR escalated if not verifiable)
- **THEN** the system MAY proceed with the automatic kill sequence
- **AND** the decision SHALL be logged as `auto_kill` with all predicate outcomes

#### Scenario: Working set is dirty — escalate
- **WHEN** the orphan responds enough to report a non-clean working set
- **THEN** the system SHALL NOT auto-kill
- **AND** the system SHALL emit a `dolt-recovery-required` Tauri event with the dirty-working-set reason

#### Scenario: Process owned by a different user — escalate without force option
- **WHEN** the orphan's uid does not match the current user
- **THEN** the system SHALL NOT auto-kill
- **AND** the system SHALL escalate with a "different-user" reason
- **AND** the `--force` button SHALL NOT bypass this predicate

#### Scenario: Data-dir mismatch — never act
- **WHEN** the process command line references a data dir that is not this project's
- **THEN** the system SHALL NOT touch the process under any circumstances
- **AND** the `--force` button SHALL NOT bypass this predicate

---

### Requirement: Graceful Kill Sequence

When automatic kill proceeds, the system SHALL follow a graceful-then-forceful sequence and verify port liberation before respawning.

#### Scenario: SIGTERM succeeds within grace period
- **WHEN** the system sends `SIGTERM` (POSIX) or graceful terminate (Windows)
- **AND** the process exits within 5 seconds
- **THEN** the system SHALL proceed to lock-file cleanup and respawn
- **AND** the outcome SHALL be logged with `kind: "graceful"` and the duration

#### Scenario: SIGTERM does not finish in time, escalate to SIGKILL
- **WHEN** the process is still alive 5 seconds after `SIGTERM`
- **THEN** the system SHALL send `SIGKILL` (POSIX) or forceful `TerminateProcess` (Windows)
- **AND** the outcome SHALL be logged as `force_kill`

#### Scenario: Lock files cleaned after successful kill
- **WHEN** the orphan is confirmed exited
- **THEN** the system SHALL delete `.beads/embeddeddolt/.dolt/.lock` and `.beads/embeddeddolt/.supervisor.pid` if they exist
- **AND** SHALL re-probe the port to confirm it is free before spawning the new supervisor

---

### Requirement: Supervisor PID Bookkeeping

The system SHALL record the PID and port of every supervisor it spawns to `.beads/embeddeddolt/.supervisor.pid` immediately after a successful start, so future launches can distinguish "our supervisor" from "an orphan".

#### Scenario: Successful spawn writes PID file
- **WHEN** the system spawns a `dolt sql-server` and confirms it accepts SQL
- **THEN** it SHALL write `{ "pid": <u32>, "port": <u16>, "started_at": "<RFC3339>" }` to `.beads/embeddeddolt/.supervisor.pid` atomically (write to temp + rename)

#### Scenario: PID file is ignored by version control
- **WHEN** `.beads/embeddeddolt/.supervisor.pid` is written
- **THEN** it SHALL match a pattern in `.gitignore` so it does not get committed

#### Scenario: Process start time disambiguates a recycled PID
- **WHEN** a process exists with the recorded supervisor PID
- **AND** that process's start time is earlier than the recorded `started_at`
- **THEN** the recorded supervisor SHALL be treated as gone (PID recycled), and the running process SHALL be classified per the foreign / orphan rules

---

### Requirement: Recovery Modal for Manual Override

The system SHALL display a non-dismissable modal in the frontend whenever automatic recovery is unsafe, allowing the user to retry the probe, force kill, or quit the app cleanly.

#### Scenario: Modal renders with diagnostic detail
- **WHEN** the Rust backend emits `dolt-recovery-required`
- **THEN** the frontend SHALL render `RecoveryDialog` modally over the app
- **AND** the modal SHALL display: a plain-language summary, a table of (PID, port, data_dir, status) per offending process, and the underlying reason auto-recovery declined
- **AND** the modal SHALL include buttons: "Try again", "Force kill and retry", "Open recovery log", "Quit app"

#### Scenario: Modal is non-dismissable
- **WHEN** the modal is open
- **THEN** pressing Escape SHALL NOT close it
- **AND** clicking outside the modal SHALL NOT close it
- **AND** only the explicit buttons SHALL advance state

#### Scenario: Force kill never bypasses ownership predicates
- **WHEN** the user clicks "Force kill and retry"
- **THEN** the backend SHALL re-run the safety predicates with `force: true`
- **AND** predicates 1 (same-user ownership) and 2 (data-dir match) SHALL still be enforced
- **AND** predicates 3 (no clients) and 4 (clean working set) SHALL be skipped
- **AND** the action SHALL be logged as `user_force` with the user's choice

#### Scenario: Quit app exits cleanly
- **WHEN** the user clicks "Quit app"
- **THEN** the app SHALL invoke the standard Tauri exit path
- **AND** any other open projects' connection pools SHALL be drained before exit

---

### Requirement: Structured Recovery Log

The system SHALL append JSON-Lines entries to a platform-appropriate recovery log capturing every probe, classification, kill, and respawn decision.

#### Scenario: Log location per platform
- **WHEN** the recovery layer writes an entry
- **THEN** the log path SHALL be:
  - macOS: `~/Library/Logs/beads-ui/recovery.log`
  - Linux: `~/.local/share/beads-ui/recovery.log`
  - Windows: `%LOCALAPPDATA%\beads-ui\Logs\recovery.log`
- **AND** the parent directory SHALL be created if missing

#### Scenario: Entry shape
- **WHEN** an entry is appended
- **THEN** it SHALL be a single line of valid JSON with at minimum: `ts` (RFC3339), `project` (absolute path), `event` (enum), `outcome` (string), `duration_ms` (number when applicable)
- **AND** PID, port, and data_dir SHALL be included when relevant to the event

#### Scenario: Log file rotation
- **WHEN** `recovery.log` exceeds 5 MB
- **THEN** the file SHALL be rotated to `recovery.log.1` (overwriting any existing rotation)
- **AND** the new `recovery.log` SHALL start empty
