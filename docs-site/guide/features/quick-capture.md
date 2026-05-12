# Quick Capture

Quick Capture is a small floating window for creating issues without switching apps. It appears over any window and dismisses itself after you submit.

## Global shortcut

| Platform | Shortcut |
|---|---|
| macOS | `⌘ Shift Space` |
| Windows / Linux | `Ctrl Shift Space` |

The shortcut works even when BeadSpec is not in the foreground. BeadSpec must be running (it can be minimized or in the system tray).

## What you can capture

The Quick Capture window lets you set:
- **Title** (required)
- **Priority** (P0–P4, defaults to P2)
- **Assignee** (optional)

More fields (labels, description) can be added after capture by opening the issue in the full task list.

## Submitting

Press `Enter` (or click **Add**) to create the issue. The window dismisses automatically. The issue appears in the task list within a second or two via real-time sync.

Press `Escape` to dismiss without creating an issue.

## Changing the shortcut

The global shortcut can be changed in **Settings → Shortcuts → Quick Capture**. If the default shortcut conflicts with another app on your system, change it there.

## Troubleshooting

**The shortcut doesn't work**:
- Confirm BeadSpec is running (check the menu bar / system tray)
- On macOS, go to System Settings → Privacy & Security → Accessibility and confirm BeadSpec has permission
- Check for shortcut conflicts with other global shortcut apps (e.g. Raycast, Alfred)
