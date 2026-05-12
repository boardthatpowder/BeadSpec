# Proposal: Global Quick Capture

## Why

Creating a new issue in Beads-UI currently requires the main application window to be focused and visible. When a developer is deep in another tool — IDE, browser, terminal — context-switching to the full Beads-UI window breaks flow. A system-wide keyboard shortcut that opens a minimal capture window lets users record work-items instantly from anywhere and then return to what they were doing, with near-zero friction.

## What

A second, lightweight Tauri window (`quick-capture`) is registered but kept hidden at startup. A global keyboard shortcut (`CmdOrCtrl+Shift+N` by default, user-configurable) makes the OS show this window from any application context. The window renders a minimal React form: a title input, pre-populated workspace label chips (branch, worktree, repo), and Submit / Cancel controls. On submit, the existing `create_task` Tauri command is called; on success the quick-capture window closes and the main window receives a toast notification containing the new issue id. Empty titles are blocked. Escape or click-outside also closes the window without creating an issue.

## Capabilities

### New
- **quick-capture**: System-wide shortcut opens a focused capture form from any app context.

### Modified
- **shortcuts-settings**: Existing shortcuts modal gains a configurable entry for the quick-capture shortcut.

## Impact

| Area | Change |
|------|--------|
| `src-tauri/tauri.conf.json` | Declare `quick-capture` window (`visible: false`, min size 480×300) |
| `src-tauri/src/lib.rs` | Register global shortcut at startup; unregister at exit |
| `src-tauri/src/commands/external.rs` | Add `get_workspace_context()` command |
| `src/quick-capture.tsx` | New React entry point for quick-capture window |
| `src/QuickCaptureApp.tsx` | Minimal React tree for the capture form |
| `src/components/ShortcutsModal.tsx` (or equivalent) | Add quick-capture shortcut row |
