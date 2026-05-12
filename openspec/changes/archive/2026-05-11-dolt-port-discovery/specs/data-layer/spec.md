## MODIFIED Requirements

### Requirement: Direct Dolt SQL Reads
The system SHALL connect directly to Dolt SQL using `sqlx` or `mysql_async` for all read operations, bypassing the `bd` CLI entirely. For **embedded-mode** projects, connection pool open SHALL be preceded by the connectivity guard defined in the `dolt-server-recovery` capability. For **server-mode** projects, connection pool open SHALL be preceded by the port-resolution and health-probe steps defined in the `dolt-port-discovery` capability, so missing or unresponsive servers surface actionable errors rather than pool timeouts.

#### Scenario: Application fetches task list on project open — embedded mode
- **WHEN** the user opens an embedded-mode Beads project
- **THEN** the Rust backend SHALL run the Dolt health probe per `dolt-server-recovery`
- **AND** SHALL open a connection pool to the project's Dolt SQL endpoint only after the probe succeeds (directly or after recovery)
- **AND** task list queries SHALL execute directly against Dolt SQL
- **AND** the `bd` CLI SHALL NOT be invoked for read operations

#### Scenario: Application fetches task list on project open — server mode
- **WHEN** the user opens a server-mode Beads project
- **THEN** the Rust backend SHALL resolve the port per `dolt-port-discovery` (metadata.json → .beads/port → .beads/dolt-server.port → error)
- **AND** SHALL run the pre-pool TCP health probe per `dolt-port-discovery`
- **AND** SHALL open a connection pool only after the probe succeeds
- **AND** task list queries SHALL execute directly against Dolt SQL
- **AND** the `bd` CLI SHALL NOT be invoked for read operations

#### Scenario: Application gracefully handles Dolt unreachable
- **WHEN** the Dolt SQL endpoint is unreachable
- **THEN** the frontend SHALL display a connection-error state with actionable copy matching the error prefix (`port_not_configured`, `server_not_running:<port>`, or `connection_failed:<reason>`) per the `dolt-port-discovery` error prefix contract
- **AND** the application SHALL NOT crash
- **AND** previously cached data SHALL remain visible with a "stale" indicator

#### Scenario: Application escalates wedged Dolt to recovery flow
- **WHEN** the Dolt health probe classifies the server as `PortBoundButNotResponding`, `PortUnboundButOrphanRunning`, or `ForeignProcessHoldingPort`
- **THEN** the simple "unreachable" connection-error state SHALL NOT be shown
- **AND** the recovery flow defined by `dolt-server-recovery` SHALL run instead

#### Scenario: Schema version mismatch detected on startup
- **GIVEN** the Dolt database has a schema version that differs from the pinned version in the app
- **WHEN** the app connects to the project
- **THEN** the app SHALL display a schema mismatch warning
- **AND** the app SHALL NOT attempt queries that rely on changed schema
- **AND** the user SHALL be prompted to upgrade either the app or the Beads CLI
