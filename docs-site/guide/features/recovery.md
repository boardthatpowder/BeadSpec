# Dolt Recovery

BeadSpec opens projects through the Beads data source. Supported projects use an app-owned loopback `bd serve`; embedded projects use native CLI commands without a BeadSpec Dolt sidecar. Open **bd Health** for current transport, live-update status and connection errors.

The Dolt recovery tools below remain available for database diagnostics where applicable.

## Recovery dialog

The recovery dialog appears when Dolt's health check fails. It shows:
- What went wrong (port conflict, unexpected exit, etc.)
- A **Restart Dolt** button to attempt recovery
- A log of recent recovery events

The dialog cannot be dismissed by clicking outside it or pressing `Escape` — recovery must be resolved before the app can continue.

**To recover:**
1. Click **Restart Dolt** in the dialog
2. BeadSpec will attempt to start a new Dolt server
3. If successful, the dialog closes and the app resumes normally

If restart fails repeatedly:
- Check whether another process is using the Dolt port: `lsof -i :PORT` (macOS/Linux)
- Override the Dolt binary path in **Settings → Binary Paths → dolt** if BeadSpec is using the wrong version

## Recovery log

A log of all recovery events (including timestamps and exit codes) is kept for the current session. It is visible in the recovery dialog's expanded view and is useful for diagnosing persistent Dolt issues.

## Troubleshooting

See [Troubleshooting → Beads connection fails](/guide/troubleshooting#beads-connection-fails) for more detail.
