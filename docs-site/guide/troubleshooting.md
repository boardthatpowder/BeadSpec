# Troubleshooting

## bd CLI not found

**Symptom**: BeadSpec shows a setup dialog saying "bd CLI not found on PATH" on launch.

**Fix**:
1. Confirm `bd` is installed: open a terminal and run `bd --version`
2. If `bd` is installed but BeadSpec can't find it, use **Settings → Binary Paths → bd** to specify the full path (e.g. `/usr/local/bin/bd`)
3. If `bd` is not installed, see the [Installation guide](/guide/installation)

## Dolt server crash / recovery dialog

**Symptom**: A recovery dialog appears saying the Dolt SQL server stopped unexpectedly.

**What happened**: BeadSpec starts a Dolt SQL server process in the background. If that process crashes (due to a port conflict, an OS-level signal, or a Dolt bug), BeadSpec detects it and shows the recovery dialog.

**Fix**:
1. Click **Restart Dolt** in the recovery dialog. BeadSpec will attempt to start a new Dolt server.
2. If restart fails, check whether another process is using the Dolt port:
   ```bash
   lsof -i :PORT   # macOS/Linux; use the port shown in the error
   ```
3. If the issue persists, override the `dolt` binary path in **Settings → Binary Paths → dolt** (requires app restart).
4. Check the recovery log in the dialog for the underlying error.

See [Recovery](/guide/features/recovery) for more detail.

## Port conflict

**Symptom**: Dolt server fails to start with "address already in use".

**Fix**: BeadSpec normally auto-assigns a free port. If a persistent conflict occurs, check what's occupying the port with `lsof -i :PORT` and stop that process.

## Issues not updating after bd command

**Symptom**: You ran `bd create` or `bd close` in the terminal but the change doesn't appear in BeadSpec.

**Fix**:
- Wait a moment — BeadSpec polls `dolt_log()` every 2 seconds by default. Changes should appear within a few seconds.
- If changes don't appear after 10 seconds, check the connection status indicator in the bottom bar. A red indicator means the Dolt SQL connection is broken — try restarting via the recovery dialog.
- Press `⌘R` / `Ctrl+R` to manually force a refresh.

## OpenSpec features missing

**Symptom**: The Changes view (OpenSpec tab) doesn't appear in the navigation.

**Fix**:
1. Check **Settings → Features** — ensure **OpenSpec integration** is toggled on.
2. Check **Settings → Binary Paths → openspec** — ensure the path is correct or leave blank for auto-detect.
3. Run `openspec --version` in a terminal to confirm the binary is installed and on your PATH.

## Ruflo panel doesn't appear

**Symptom**: No Ruflo memory panel appears in task detail, even with Ruflo enabled in Settings.

**Fix**:
1. Confirm `ruflo` is installed: run `ruflo --version` in a terminal.
2. If installed, check **Settings → Binary Paths → ruflo** or ensure `ruflo` is on your PATH.
3. If not installed, the panel intentionally hides — see [Integrations → Ruflo](/guide/integrations#ruflo).

## Launch at login doesn't work

**Symptom**: "Launch at login" has no effect.

**Status**: This feature is not yet implemented. It will be added in a future release.

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
