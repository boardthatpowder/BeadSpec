# Data Layer Specification

## Purpose

Defines how BeadSpec connects to Dolt SQL, shells out to the `bd` CLI, maintains real-time sync, and manages connections across multiple projects. This layer is entirely in Rust and exposed to the TypeScript frontend via typed Tauri commands.

---
## Requirements
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

### Requirement: API-backed complete current state
The system SHALL use HTTP current-state reads or native CLI fallback, retain complete non-deleted issue coverage including closed/template/gate/infra rows, status OR and label AND filters, existing fuzzy ranking, descending-priority/date/id ordering, notes provenance and raw dependency direction/targets. Issue queries for workers, OpenSpec, epics and GitNexus SHALL reuse this adapter.

#### Scenario: Complete list and aggregates
- **WHEN** a task list or aggregate is requested
- **THEN** all matching rows SHALL be fetched and existing filter, ordering and provenance behavior SHALL be retained

### Requirement: Journal sync with current-state reconciliation
The system SHALL consume ordered changes with per-session per-project checkpoints, deduplicate reconnect delivery, normalize omitted is_blocked to false, and refresh all affected caches for create/update/close/delete/comment/dependency records. Disabled/truncated/malformed/dropped/saturated feeds SHALL have explicit recovery. Full current state SHALL reconcile every 30 seconds and on focus/manual refresh.

#### Scenario: Dependency-only or comment-only update
- **WHEN** a journal record changes dependencies or comments without moving a Dolt commit
- **THEN** relevant detail, history, graph and aggregate caches SHALL refresh

#### Scenario: Pruned checkpoint
- **WHEN** a checkpoint is below journal retention or the stream reports truncation
- **THEN** current state SHALL be rebuilt and the checkpoint SHALL restart from a valid baseline

#### Scenario: Unjournaled change
- **WHEN** a pull, merge, restore or raw SQL edit changes current state
- **THEN** the change SHALL appear by the next 30-second reconciliation while connected

### Requirement: Independent project clients
The system SHALL maintain independent project clients, watchers, activity buffers and checkpoints and SHALL clean up owned resources on disconnect/exit.

#### Scenario: Concurrent projects
- **WHEN** two projects are connected
- **THEN** events and cache invalidations from one SHALL NOT populate the other project's state
