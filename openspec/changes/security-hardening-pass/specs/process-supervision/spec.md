## ADDED Requirements

### Requirement: Mandatory Timeout on All Spawned Processes
Every subprocess spawned by the app (bd, ruflo, git, or any sidecar) SHALL be subject to a hard timeout, after which the child is killed and an error is returned.

#### Scenario: Command completes within timeout
- **WHEN** a subprocess completes before the timeout elapses
- **THEN** its output SHALL be returned to the caller
- **AND** no kill signal SHALL be sent

#### Scenario: Command exceeds timeout
- **WHEN** a subprocess is still running after the configured timeout
- **THEN** the process SHALL be killed immediately (SIGKILL on POSIX, TerminateProcess on Windows)
- **AND** the caller SHALL receive a `ProcessTimeout` error with the command name and timeout duration
- **AND** the child SHALL NOT be left running as an orphan

#### Scenario: Write-path bd commands use a longer timeout than read-path commands
- **WHEN** a write-path bd command (create, update, close) is invoked
- **THEN** it SHALL be allowed up to 30 seconds before timeout
- **WHEN** a read-path or utility command is invoked
- **THEN** it SHALL be allowed up to 10 seconds before timeout

---

### Requirement: Kill-on-Drop Semantics
The subprocess handle SHALL be configured to kill the child process when the handle is dropped, so cancellation or panic paths do not leave orphan processes.

#### Scenario: Handle dropped without awaiting output
- **WHEN** the process handle is dropped (e.g., via early return or panic) before the process exits
- **THEN** the child process SHALL receive a kill signal
- **AND** no orphan process SHALL remain running

#### Scenario: Explicit kill before wait
- **WHEN** the timeout fires
- **THEN** the implementation SHALL call `child.kill()` explicitly and then `child.wait()` before returning the error
- **AND** the wait SHALL complete without blocking indefinitely (bounded by an additional 2-second grace period)

---

### Requirement: Bounded Output Collection
Output from spawned processes SHALL be collected up to a fixed size cap to prevent unbounded memory allocation from malicious or runaway CLIs.

#### Scenario: Output within cap is returned verbatim
- **WHEN** a process produces less than 1 MiB of combined stdout + stderr
- **THEN** the full output SHALL be returned to the caller

#### Scenario: Output exceeds cap
- **WHEN** a process produces more than 1 MiB of output
- **THEN** collection SHALL stop at the cap
- **AND** the truncated output SHALL be returned with a `truncated: true` flag in the result
- **AND** a warning SHALL be logged at the Rust `warn!` level with the command name and actual byte count

---

### Requirement: Long-Running Command Tests
The process supervision implementation SHALL be tested with simulated long-running commands.

#### Scenario: Fake long-running command is killed at timeout
- **GIVEN** a fake command that sleeps indefinitely is configured with a short test timeout (e.g., 100ms)
- **WHEN** `spawn_managed` is called with that command
- **THEN** the call SHALL return a `ProcessTimeout` error within 200ms of invocation
- **AND** the fake child process SHALL be terminated (verifiable via process table)

#### Scenario: Normal command completes and returns output
- **GIVEN** a real command (e.g., `echo hello`) is configured
- **WHEN** `spawn_managed` is called
- **THEN** the output SHALL contain "hello"
- **AND** the call SHALL return before the timeout
