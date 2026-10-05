# Troubleshooting

## bd CLI not found

**Symptom**: BeadSpec shows a setup dialog saying "bd CLI not found on PATH" on launch.

**Fix**:
1. Confirm `bd` 1.3 or newer is installed: open a terminal and run `bd --version`
2. If `bd` is installed but BeadSpec can't find it, use **Settings → Binary Paths → bd** to specify the full path (e.g. `/usr/local/bin/bd`)
3. If `bd` is not installed, see the [Installation guide](/guide/installation)

## Beads connection fails

Open **bd Health** to inspect read/write transport, journal state and the reported reason. Verify `bd --version` is at least 1.3, check the configured binary path, and reopen the project. BeadSpec owns a loopback `bd serve` process for HTTP projects; embedded projects use native CLI commands.

A project can use HTTP reads and CLI writes when hooks or maintenance policies require native commands. This is expected and is shown in the connection status.

## Issues not updating after bd command

- Open **bd Health** and choose **Enable live updates** if journaling is disabled. This is a per-project opt-in and changes the project journal configuration.
- Journal updates should appear promptly. Full refreshes run every 30 seconds, including changes from pull, merge and direct database edits that may not create journal events.
- Return focus to BeadSpec or press `⌘R` / `Ctrl+R` to refresh immediately.
- If the connection reports an error, reopen the project and inspect the connection reason.

## Activity history is incomplete

The activity feed contains retained journal and session activity, bounded to seven days or 5,000 events per project. Events from before journaling was enabled or outside retention may be absent. Open an individual task timeline for native history and comments.

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
