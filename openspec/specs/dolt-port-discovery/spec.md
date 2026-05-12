# Dolt Port Discovery Specification

## Purpose

Defines how the Beads UI resolves which port a server-mode project's Dolt SQL server is running on, probes it before opening a connection pool, and surfaces actionable errors when the server is absent or unresponsive.

---

## Requirements

### Requirement: Server-Mode Port Resolution
The system SHALL resolve the Dolt SQL port for a server-mode project via a defined lookup sequence before attempting any connection. The lookup order is: (1) contents of `.beads/dolt-server.port` (written fresh by `bd` on every start), (2) contents of `.beads/port` (legacy), (3) `dolt_port` field in `.beads/metadata.json` (static fallback, may be stale). If none of these sources yields a valid port, the connection SHALL be aborted with a `port_not_configured` error. The fallback to port 3306 SHALL NOT exist.

#### Scenario: Port found in dolt-server.port (primary)
- **WHEN** the user switches to a server-mode project
- **AND** `.beads/dolt-server.port` exists and contains a valid port number
- **THEN** the Rust backend SHALL use that port to construct the database URL
- **AND** SHALL NOT consult `.beads/port` or `metadata.json dolt_port`

#### Scenario: Port found in .beads/port fallback
- **WHEN** the user switches to a server-mode project
- **AND** `.beads/dolt-server.port` is absent
- **AND** `.beads/port` exists and contains a valid port number
- **THEN** the Rust backend SHALL use the port from `.beads/port`

#### Scenario: Port found in metadata.json as last resort
- **WHEN** the user switches to a server-mode project
- **AND** neither `.beads/dolt-server.port` nor `.beads/port` is present
- **AND** `.beads/metadata.json` contains a numeric `dolt_port` field
- **THEN** the Rust backend SHALL use that port (noting it may be stale)

#### Scenario: No port source available
- **WHEN** the user switches to a server-mode project
- **AND** none of the three sources contains a valid port
- **THEN** `connect_project` SHALL return an error prefixed with `port_not_configured`
- **AND** the connection pool SHALL NOT be opened
- **AND** the frontend SHALL display: "No Dolt port configured — start the server with `bd dolt-start` in your project"

### Requirement: Pre-Pool TCP Health Probe for Server Mode
Before opening a connection pool in server mode, the system SHALL probe the resolved port using the same `probe_with_deadline` logic used in embedded mode (1 s TCP connect + 2 s SQL ping, 3 s total). If the probe fails, the error SHALL be classified and returned immediately without a pool acquire timeout.

#### Scenario: Probe succeeds — pool opens normally
- **WHEN** the resolved port is bound and responds to `SELECT 1` within the deadline
- **THEN** the Rust backend SHALL proceed to open the connection pool
- **AND** `connect_project` SHALL succeed

#### Scenario: Probe fails — port not bound
- **WHEN** the TCP connect to the resolved port is refused or times out
- **THEN** `connect_project` SHALL return an error prefixed with `server_not_running:<port>`
- **AND** the connection pool SHALL NOT be opened
- **AND** the frontend SHALL display: "Dolt server not running on port <port> — run `bd dolt-start` in your project directory"

#### Scenario: Probe fails — port bound but SQL unresponsive
- **WHEN** the TCP connect succeeds but the `SELECT 1` does not complete within 2 s
- **THEN** `connect_project` SHALL return an error prefixed with `connection_failed:<reason>`
- **AND** the frontend SHALL display a generic "Cannot connect to Dolt" message with the raw reason

### Requirement: Error Prefix Contract
The `connect_project` Tauri command SHALL prefix all server-mode connection failure strings with one of three tokens — `port_not_configured`, `server_not_running:<port>`, `connection_failed:<reason>` — so the frontend can render specific, actionable copy without a full typed-error IPC refactor.

#### Scenario: Frontend receives port_not_configured
- **WHEN** `connect_project` returns an error string starting with `port_not_configured`
- **THEN** the frontend SHALL display: "No Dolt port configured — start the server with `bd dolt-start`"

#### Scenario: Frontend receives server_not_running
- **WHEN** `connect_project` returns an error string starting with `server_not_running:`
- **THEN** the frontend SHALL extract the port from the prefix
- **AND** SHALL display: "Dolt server not running on port <port> — run `bd dolt-start`"

#### Scenario: Frontend receives connection_failed
- **WHEN** `connect_project` returns an error string starting with `connection_failed:`
- **THEN** the frontend SHALL display: "Cannot connect to Dolt: <reason>"
