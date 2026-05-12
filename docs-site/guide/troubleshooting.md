# Troubleshooting

## bd CLI not found

**Symptom**: BeadSpec shows a setup dialog saying "bd CLI not found on PATH" on launch.

**Fix**:
1. Confirm `bd` is installed: open a terminal and run `bd --version`
2. If `bd` is installed but BeadSpec can't find it, use the path field in the setup dialog to specify the full path (e.g. `/usr/local/bin/bd`)
3. If `bd` is not installed, see the [Installation guide](/guide/installation)

## Dolt server crash / recovery dialog

**Symptom**: A recovery dialog appears saying the Dolt SQL server stopped unexpectedly.

**What happened**: BeadSpec starts a Dolt SQL server process in the background. If that process crashes (due to a port conflict, an OS-level signal, or a Dolt bug), BeadSpec detects it and shows the recovery dialog.

**Fix**:
1. Click **Restart** in the recovery dialog. BeadSpec will attempt to start a new Dolt server.
2. If restart fails, check whether another process is using the Dolt port:
   ```bash
   lsof -i :PORT   # macOS/Linux; use the port shown in the error
   ```
3. Override the port in [Settings → Advanced → Dolt server port](/guide/features/settings#advanced) if there is a persistent conflict.
4. If the issue persists, check the BeadSpec logs in the recovery dialog for the underlying error.

## Port conflict

**Symptom**: Dolt server fails to start with "address already in use".

**Fix**: Manually specify a free port in **Settings → Advanced → Dolt server port**. BeadSpec normally auto-assigns a free port, but a static override can help if auto-assignment keeps picking a conflicted port.

## Issues not updating after bd command

**Symptom**: You ran `bd create` or `bd close` in the terminal but the change doesn't appear in BeadSpec.

**Fix**:
- Wait a moment — BeadSpec polls `dolt_log()` every 2 seconds by default. Changes should appear within a few seconds.
- If changes don't appear after 10 seconds, check the connection status indicator in the bottom bar. A red indicator means the Dolt SQL connection is broken — try restarting via the recovery dialog.
- The poll interval can be adjusted in [Settings → Advanced](/guide/features/settings#advanced).

## macOS: App won't open (Gatekeeper)

**Symptom**: macOS says "BeadSpec cannot be opened because the developer cannot be verified."

**Fix**: Right-click the app → **Open** → **Open**. Or:
```bash
xattr -d com.apple.quarantine /Applications/BeadSpec.app
```

## Linux: App won't launch (WebKit missing)

**Symptom**: BeadSpec crashes immediately on Linux.

**Fix**: Install the WebKit runtime:
```bash
# Ubuntu/Debian
sudo apt-get install libwebkit2gtk-4.1-0

# Fedora
sudo dnf install webkit2gtk4.1
```

## Still stuck?

Open a [GitHub Discussion](https://github.com/boardthatpowder/BeadSpec/discussions) with:
- Your OS and version
- BeadSpec version (`Help → About`)
- `bd --version` output
- The error message or screenshot
