## 1. Rust Backend — Port Resolution

- [x] 1.1 Add `dolt_port: Option<u16>` field to `BeadsMetadata` struct in `src-tauri/src/commands/project.rs:21-30`
- [x] 1.2 Rewrite `server_url()` to use precedence order: `metadata.dolt_port` → `.beads/port` → `.beads/dolt-server.port` → `Err("port_not_configured")`; remove the 3306 fallback
- [x] 1.3 Update `connect_project` server-mode branch to propagate the `Err` from `server_url()` as a `port_not_configured`-prefixed error string

## 2. Rust Backend — Pre-Pool Health Probe for Server Mode

- [x] 2.1 In `connect_project`, call `recovery::probe_with_deadline` for server mode (same as embedded mode) using the resolved port before calling `registry.get_or_connect`
- [x] 2.2 Map probe failure to `server_not_running:<port>` or `connection_failed:<reason>` error prefix per the spec contract

## 3. Frontend — Actionable Error Copy

- [x] 3.1 Locate the project-switch error handler in the frontend (wherever `connectProject` Tauri command errors are displayed)
- [x] 3.2 Parse the error prefix (`port_not_configured`, `server_not_running:`, `connection_failed:`) and render specific copy per the `dolt-port-discovery` error prefix contract spec

## 4. Immediate Workaround (pre-deploy unblock)

- [x] 4.1 Write `60000` to `/Users/dean/workspaces/BeadSpec/.beads/port` so the app can connect now with the current code while the fix is implemented; remove this file once 1.2 lands and the port is read from `metadata.json`

## 5. Verification

- [x] 5.1 Kill the running dolt server (PID 91820), attempt project switch — confirm `server_not_running:60000` error copy appears in the UI
- [x] 5.2 Restart dolt (`bd dolt-start` or `dolt sql-server -H 127.0.0.1 -P 60000` from `.beads/dolt`), switch to project — confirm successful connect
- [x] 5.3 Remove `dolt_port` from `metadata.json` and delete `.beads/port` — confirm `port_not_configured` error copy appears
- [x] 5.4 Run `cargo test` in `src-tauri/` — confirm no regressions
