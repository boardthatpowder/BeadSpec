## Context

In server mode, a project's `dolt sql-server` is spawned and managed by the `bd` CLI (not by BeadSpec). The CLI picks an ephemeral port and records it in `.beads/metadata.json` as `dolt_port`. However, the Tauri backend's `BeadsMetadata` struct (`commands/project.rs:21`) only deserialises `dolt_mode` and `dolt_database` — `dolt_port` is silently dropped. The `server_url()` helper then reads `.beads/port` or `.beads/dolt-server.port` (neither written by the current `bd`) and falls back to 3306. Nothing listens on 3306, the pool's 5 s `acquire_timeout` fires, and the user sees an opaque "pool timed out" error.

Embedded-mode projects already work correctly because `recovery::guard` probes the port before the pool opens and the server is spawned by the app itself.

## Goals / Non-Goals

**Goals:**
- Make server-mode project switch succeed when `bd` has already started the dolt server.
- Surface a clear, actionable error when the port is unavailable (dolt not running), rather than a generic pool timeout.
- Establish a single, documented lookup order for the port so future `bd` changes have a clear contract to target.

**Non-Goals:**
- Auto-starting a server-mode dolt process from within the app.
- Changing embedded-mode startup or the existing orphan-kill recovery flow.
- Modifying the `bd` CLI source.
- Supporting password-protected server-mode connections (out of scope for now).

## Decisions

### Decision 1: Port lookup precedence — metadata.json first, port files as fallback, hard error if absent

**Chosen**: `.beads/dolt-server.port` → `.beads/port` → `metadata.json dolt_port` → return `Err("port_not_configured: ...")`.

**Why**: `dolt-server.port` is written fresh by `bd` every time it starts the server, so it always reflects the current running port. `metadata.json dolt_port` is set at project initialisation and goes stale across restarts when bd picks a new ephemeral port — verified in practice (metadata had 56341 while server ran on 56243). Removing the 3306 fallback prevents silent misconfiguration.

**Alternatives considered**:
- Keep 3306 fallback: rejected — masks misconfiguration, always wrong for `bd`-managed projects.
- OS-level process enumeration (find the dolt process and read its port from `/proc` or `lsof`): rejected — fragile, requires elevated access on some platforms, wrong abstraction level for this layer.

### Decision 2: Pre-pool TCP probe reused from `recovery::probe`

**Chosen**: Reuse `recovery::probe_with_deadline` (already exists at `db/recovery/mod.rs:94`) before opening the pool in server mode, the same as embedded mode.

**Why**: The function already has the right semantics (1 s TCP + 2 s SQL ping, 3 s total deadline). Duplicating it would be wrong; skipping it leaves the pool timeout as the only error signal.

**Alternatives considered**:
- Just increase `acquire_timeout` from 5 s to 15 s: rejected — hides the "server not running" case behind a longer hang, no better error message.

### Decision 3: Error classification returned to frontend

**Chosen**: `connect_project` returns one of three string-tagged error variants that the frontend can distinguish: `"port_not_configured"`, `"server_not_running:<port>"`, `"connection_failed:<reason>"`. These are returned as structured `Err(String)` (existing Tauri error contract) with a prefix the frontend can parse.

**Why**: The frontend already shows a generic toast for any `connect_project` error. Adding a short prefix lets the frontend render specific copy ("Dolt server not running — run `bd dolt-start` in your project") without a full typed-error refactor.

**Alternatives considered**:
- Full typed error enum via specta: cleaner long-term but requires a larger refactor of the IPC contract. Tracked as future work in `data-layer` spec.

## Risks / Trade-offs

- **bd CLI version drift** → `bd` may change where it writes `dolt_port`. Mitigation: port-file fallback remains, and the lookup logic is isolated to `server_url()` making future updates a one-function change.
- **Race condition on slow start** → probe passes, pool opens, dolt not yet ready. Mitigation: probe already issues `SELECT 1`, not just TCP connect.
- **Windows path differences** → no OS-specific code introduced; `metadata.json` paths are all handled by `std::path::Path`. Low risk.
