# System Tray

BeadSpec runs a system tray icon so you can create issues and bring the app to the foreground without keeping the main window visible.

## Tray icon

On macOS the icon appears in the menu bar. On Windows it appears in the notification area (system tray). On Linux it appears in the tray area of compatible desktop environments.

## Tray popover

Click the tray icon to open a popover with:
- **Quick Create** — a minimal form to create a new issue (title + priority) without opening the main window
- **Open BeadSpec** — bring the main window to the foreground

## Badge

When there are pending notifications or flagged human-decision items, the tray icon shows a badge count.

## Hiding the main window

Closing the main window (clicking the red ✕ on macOS or X on Windows) hides it to the tray rather than quitting. To fully quit BeadSpec, use **Tray → Quit BeadSpec** or the **File → Quit** menu.

## Troubleshooting

**The tray icon is missing**:
- On macOS: tray icons can be hidden if the menu bar is full. Use third-party menu bar managers (Bartender, Ice) to unhide it.
- On Linux: the system tray requires `libayatana-appindicator3` to be installed and a compatible desktop environment (GNOME with AppIndicator extension, KDE, XFCE, etc.).
