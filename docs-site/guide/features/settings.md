# Settings

Open Settings via **BeadSpec → Settings** (macOS) or **File → Settings** (Windows/Linux), or press `⌘,` / `Ctrl+,`.

## General

| Setting | Description |
|---|---|
| Launch at login | Start BeadSpec automatically when you log in |
| Show in Dock / taskbar | Control whether BeadSpec appears in the Dock (macOS) |

## bd Binary

If BeadSpec can't find `bd` automatically (i.e., `bd` is not on your `PATH`), use this setting to specify the path manually.

**Path override**: enter the full path to the `bd` executable, e.g. `/usr/local/bin/bd` or `C:\Users\you\bin\bd.exe`.

Click **Verify** to confirm BeadSpec can find and run `bd` at the specified path.

## Appearance

| Setting | Description |
|---|---|
| Theme | System (follows OS dark/light mode), Light, or Dark |
| Density | Comfortable (default), Compact, or Spacious — controls row height in the task list |

## Shortcuts

Override the default global keyboard shortcuts:
- **Quick Capture** — default: `⌘ Shift Space` / `Ctrl Shift Space`

Click a shortcut field, then press your desired key combination. Click **Reset** to restore the default.

## Advanced

| Setting | Description |
|---|---|
| Dolt server port | Override the port BeadSpec uses to connect to the Dolt SQL server (default: auto-assigned) |
| Poll interval | How frequently BeadSpec polls `dolt_log()` for changes (default: 2 seconds) |
