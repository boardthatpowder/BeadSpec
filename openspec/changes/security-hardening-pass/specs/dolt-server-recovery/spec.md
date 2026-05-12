## MODIFIED Requirements

### Requirement: Safety Predicates Before Automatic Kill
The system SHALL automatically kill an orphan only when ALL safety predicates pass: same-user ownership, exact data-dir match, no connected clients, and a clean working set. The working-set check SHALL connect to the project's Beads database directly to query `dolt_status`; connecting to `information_schema` is not sufficient.

#### Scenario: All predicates pass — auto-kill proceeds
- **WHEN** an orphan is detected
- **AND** the process is owned by the current user (uid match)
- **AND** the canonicalized data-dir in the process command line equals this project's canonicalized data dir
- **AND** no client connections are currently held (verified via `SHOW PROCESSLIST` if accessible, OR trivially satisfied if no client can connect)
- **AND** the working set is clean (verified via `dolt_status()` queried against the Beads DB, OR escalated if not verifiable)
- **THEN** the system MAY proceed with the automatic kill sequence
- **AND** the decision SHALL be logged as `auto_kill` with all predicate outcomes

#### Scenario: working_set_clean connects to the Beads DB
- **WHEN** the working-set-clean predicate runs
- **THEN** it SHALL open a connection to the project's Beads database (not `information_schema`)
- **AND** SHALL execute `SELECT COUNT(*) FROM dolt_status WHERE staged = 1 OR working = 1`
- **AND** SHALL return `false` (not clean) if the count is greater than zero
- **AND** SHALL return `Err` (escalate) if the connection cannot be established

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

### Requirement: Health Probe with Hard Deadline
The system SHALL probe Dolt SQL health before opening a connection pool for a project, with a hard total deadline so the app never hangs silently on a wedged server. After spawning a sidecar, the system SHALL verify SQL and schema readiness against the Beads database (not `information_schema`) before writing the supervisor PID file.

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

#### Scenario: Sidecar spawn verified against Beads DB before PID file write
- **WHEN** the system spawns a new `dolt sql-server` sidecar
- **THEN** before writing `.supervisor.pid`, it SHALL issue a `SELECT 1` to the project's Beads database (not `information_schema`)
- **AND** SHALL only write the PID file after that query succeeds
- **AND** if the query fails within 3 seconds, the spawn SHALL be retried with a new port

---

## ADDED Requirements

### Requirement: Port Race Retry on Sidecar Startup
When a free port is selected for the sidecar but becomes occupied before the sidecar binds it, the system SHALL detect the failure and retry with a newly selected port.

#### Scenario: Port is stolen between free_port and sidecar bind
- **GIVEN** the system selects port P as free
- **WHEN** another process binds port P before the sidecar starts
- **THEN** the health probe's TCP connect SHALL succeed but the Beads DB `SELECT 1` SHALL fail with connection-refused or wrong-server
- **AND** the system SHALL retry the spawn with a freshly selected free port
- **AND** the retry SHALL occur up to 3 times before returning an error to the caller
- **AND** each retry SHALL be logged with the stolen port number

#### Scenario: Port race resolved on second attempt
- **WHEN** the first spawn attempt fails due to a port race
- **AND** the second attempt selects an available port
- **THEN** the sidecar SHALL start successfully on the new port
- **AND** the supervisor PID file SHALL record the new port number
