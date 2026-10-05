# beads-http-api Specification

## Purpose
TBD - created by archiving change beads-http-data-layer. Update Purpose after archive.
## Requirements
### Requirement: Versioned per-project API transport
The system SHALL require Beads 1.3 or later, supervise a loopback HTTP service per canonical project when supported, verify workspace identity and readiness, select native CLI for embedded mode, and stop owned processes on disconnect or exit. Core task IPC SHALL remain compatible.

#### Scenario: Supported server workspace
- **WHEN** a Beads 1.3 server workspace is connected
- **THEN** an owned loopback service SHALL be verified within a 30-second startup budget and current-state reads SHALL use advertised HTTP capabilities

#### Scenario: Embedded workspace
- **WHEN** the workspace uses embedded mode
- **THEN** current state and mutations SHALL use serialized native CLI operations without an application-owned Dolt SQL server

#### Scenario: Older binary
- **WHEN** the selected binary is older than 1.3
- **THEN** connection SHALL fail with upgrade guidance before data operations

### Requirement: Compatible writes and explicit journal opt-in
The system SHALL offer journal enablement per project, enable it through native config, restart its owned HTTP service, and preserve relevant executable hooks, explicit commit policies and enabled command maintenance through native CLI writes. Uncertain mutation responses SHALL cause reconciliation rather than blind replay.

#### Scenario: User enables live updates
- **WHEN** Enable live updates is selected
- **THEN** the resolved workspace configuration SHALL enable events-journal and the service SHALL restart before following events

#### Scenario: Hooks or maintenance apply
- **WHEN** an affected mutation requires native command behavior
- **THEN** it SHALL execute through CLI even when HTTP reads are available

#### Scenario: Mutation completion is uncertain
- **WHEN** transport fails after a mutation may have reached the server
- **THEN** the operation SHALL NOT be automatically repeated and current state SHALL be refreshed

### Requirement: Typed transport status
The system SHALL expose typed project-scoped read/write transport, live-update mode, journal enablement, historical coverage and an optional reason without exposing credentials.

#### Scenario: Status changes
- **WHEN** a provider reconnects or journal availability changes
- **THEN** a project-scoped status event SHALL update health UI

