# System Tray

BeadSpec runs a system tray icon so you can access key actions without bringing the main window to the foreground.

## Tray icon

On macOS the icon appears in the menu bar. On Windows it appears in the notification area (system tray). On Linux it appears in the tray area of compatible desktop environments.

## Tray popover

Click the tray icon to open a popover showing:
- **Quick Capture** button — same as the global shortcut
- **Recent issues** — the last few issues you touched, with status badges
- **Project name** and connection status
- **Open BeadSpec** — bring the main window to the foreground

## Hiding the main window

Closing the main window (clicking the red ✕ on macOS or X on Windows) hides it to the tray rather than quitting. To fully quit BeadSpec, use **Tray → Quit BeadSpec** or the **File → Quit** menu.

## Auto-launch

To launch BeadSpec at login, enable it in **Settings → General → Launch at login**.

## Troubleshooting

**The tray icon is missing**:
- On macOS: tray icons can be hidden if the menu bar is full. Use third-party menu bar managers (Bartender, Ice) to unhide it.
- On Linux: the system tray requires `libayatana-appindicator3` to be installed and a compatible desktop environment (GNOME with AppIndicator extension, KDE, XFCE, etc.).
