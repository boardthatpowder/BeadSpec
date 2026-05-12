# Dolt Recovery

BeadSpec starts a Dolt SQL server process in the background when you open a project. If that process stops unexpectedly, BeadSpec detects the problem automatically and shows a recovery dialog.

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

See [Troubleshooting → Dolt server crash](/guide/troubleshooting#dolt-server-crash--recovery-dialog) for more detail.
