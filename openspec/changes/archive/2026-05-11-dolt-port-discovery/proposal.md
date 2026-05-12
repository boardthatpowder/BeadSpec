## Why

When a user restarts the BeadSpec app and switches to a server-mode project, the `connect_project` Tauri command has no reliable way to find the port the `bd`-spawned `dolt sql-server` is actually listening on. It falls through to port 3306 (a hardcoded default), times out after 5 seconds, and surfaces "Cannot connect to Dolt: pool timed out while waiting for an open connection" — giving the user no recovery path.

## What Changes

- Extend `BeadsMetadata` deserialization to include `dolt_port` from `.beads/metadata.json`.
- Define a canonical port-lookup precedence for server mode: `metadata.json dolt_port` → `.beads/port` → `.beads/dolt-server.port` → explicit error (no 3306 fallback).
- Add a lightweight TCP health probe in server mode before opening the pool, surfacing a clear "server not running" message instead of a pool acquire timeout when the dolt process is absent.
- Replace the opaque "pool timed out" error with actionable frontend copy that distinguishes "server found but slow" from "server not running".

**Non-goals**: This change does not alter embedded-mode startup, the existing `dolt-server-recovery` orphan-kill flow, or the `bd` CLI itself. It does not auto-start a server-mode dolt process.

## Capabilities

### New Capabilities

- `dolt-port-discovery`: How the UI resolves the port for a server-mode project's Dolt SQL endpoint, including lookup precedence, validation, and error classification.

### Modified Capabilities

- `data-layer`: The "Application fetches task list on project open" scenario must specify server-mode port-discovery as a prerequisite step, and the "gracefully handles Dolt unreachable" scenario must show actionable copy distinguishing port-not-found from server-not-responding.

## Impact

- `src-tauri/src/commands/project.rs` — `BeadsMetadata` struct, `server_url()` helper, `connect_project` command.
- `src-tauri/src/db/pool.rs` — `DoltPool::connect` acquire_timeout (currently 5 s, may increase or add pre-probe).
- `src-tauri/src/db/recovery/mod.rs` — `probe` / `probe_with_deadline` reused for server-mode health check.
- Frontend error states (project-switch failure toast / connection-error panel).
- `.beads/metadata.json` schema (documentation only — `bd` CLI not changed).
