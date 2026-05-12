## ADDED Requirements

Defines how Beads UI connects to Dolt SQL, shells out to the `bd` CLI, maintains real-time sync, and manages connections across multiple projects. This layer is entirely in Rust and exposed to the TypeScript frontend via typed Tauri commands.

### Requirement: Direct Dolt SQL Reads

The system SHALL connect directly to Dolt SQL using `sqlx` or `mysql_async` for all read operations, bypassing the `bd` CLI entirely.

#### Scenario: Application fetches task list on project open
- **WHEN** the user opens a Beads project
- **THEN** the Rust backend SHALL open a connection pool to the project's Dolt SQL endpoint
- **AND** task list queries SHALL execute directly against Dolt SQL
- **AND** the `bd` CLI SHALL NOT be invoked for read operations

#### Scenario: Application gracefully handles Dolt connection failure
- **WHEN** the Dolt SQL endpoint is unreachable
- **THEN** the frontend SHALL display a connection-error state with a retry button
- **AND** the application SHALL NOT crash
- **AND** previously cached data SHALL remain visible with a "stale" indicator

#### Scenario: Schema version mismatch detected on startup
- **GIVEN** the Dolt database has a schema version that differs from the pinned version in the app
- **WHEN** the app connects to the project
- **THEN** the app SHALL display a schema mismatch warning
- **AND** the app SHALL NOT attempt queries that rely on changed schema
- **AND** the user SHALL be prompted to upgrade either the app or the Beads CLI

### Requirement: bd CLI for Writes

The system SHALL use the `bd` CLI for all write operations that carry side effects (ID assignment, label normalization, hook execution).

#### Scenario: User creates a new task
- **WHEN** the user submits a new task via the UI
- **THEN** the Rust backend SHALL invoke `bd create` with the appropriate arguments
- **AND** the resulting task ID assigned by `bd` SHALL be returned to the frontend
- **AND** the TanStack Query cache SHALL be invalidated for the task list

#### Scenario: User changes task status
- **WHEN** the user changes a task status in the UI
- **THEN** the Rust backend SHALL invoke the appropriate `bd` command
- **AND** an optimistic update SHALL be applied immediately in the frontend
- **AND** if the `bd` command fails, the optimistic update SHALL be rolled back with a toast error

#### Scenario: bd CLI not found on PATH
- **WHEN** the Rust backend attempts to invoke the `bd` CLI
- **AND** the `bd` binary is not found on the system PATH
- **THEN** the frontend SHALL display a clear error: "Beads CLI (bd) not found — install it to enable editing"
- **AND** read-only mode SHALL remain functional

### Requirement: Real-Time Sync via Dolt Log Polling

The system SHALL poll `dolt_log()` every 2 seconds to detect changes made externally (another client, direct CLI usage, etc.) and reflect them in the UI without a full reload.

#### Scenario: External change detected via commit hash diff
- **GIVEN** the app is polling and the current known commit hash is H1
- **WHEN** Dolt reports a new commit hash H2
- **THEN** the Rust backend SHALL query which task IDs were modified between H1 and H2
- **AND** a Tauri event SHALL be emitted containing only the changed task IDs
- **AND** the frontend SHALL invalidate TanStack Query cache entries for only those task IDs
- **AND** the full task list SHALL NOT be re-fetched unless a structural change (task created/deleted) is detected

#### Scenario: No external changes during polling interval
- **GIVEN** the commit hash has not changed since the last poll
- **WHEN** the 2-second poll fires
- **THEN** no Tauri event SHALL be emitted
- **AND** the frontend cache SHALL not be invalidated

#### Scenario: Polling resumes after network interruption
- **GIVEN** the Dolt connection was lost
- **WHEN** connectivity is restored
- **THEN** the poller SHALL resume and emit a full-refresh event to reconcile missed changes

### Requirement: Multi-Project Connection Management

The system SHALL maintain one independent Dolt connection pool per open project, with no shared singleton.

#### Scenario: User opens a second project
- **GIVEN** Project A is open with its own connection pool
- **WHEN** the user opens Project B
- **THEN** a new independent connection pool SHALL be created for Project B
- **AND** Project A's pool SHALL remain active and unaffected

#### Scenario: User closes a project
- **WHEN** the user closes a project
- **THEN** that project's Dolt connection pool SHALL be gracefully drained and closed
- **AND** no connections SHALL be leaked

#### Scenario: Project list discovery
- **WHEN** the app starts
- **THEN** it SHALL invoke `bd list` (or equivalent) to discover available Beads projects on the machine
- **AND** the discovered projects SHALL be shown in the project switcher

### Requirement: Typed IPC Contract

The system SHALL use `specta` + `tauri-specta` to auto-generate TypeScript type bindings from all Rust Tauri command signatures.

#### Scenario: Rust command signature changes
- **WHEN** a developer changes the return type or parameters of a Tauri command in Rust
- **THEN** the TypeScript binding generation SHALL fail to compile if the frontend uses the old types
- **AND** the mismatch SHALL be caught before runtime

#### Scenario: Frontend calls a Tauri command
- **WHEN** the TypeScript frontend invokes a Tauri command
- **THEN** it SHALL use the auto-generated typed wrapper, not a raw `invoke()` string call
- **AND** all parameters and return values SHALL be fully typed
