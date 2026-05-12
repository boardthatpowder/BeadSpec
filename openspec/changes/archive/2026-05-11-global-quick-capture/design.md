## Context

BeadSpec is a Tauri 2 + React 19 + TypeScript + Tailwind v4 desktop app. Issue creation currently requires navigating to the main window. This change adds a system-wide keyboard shortcut that pops up a minimal second Tauri window for rapid capture, then returns focus to whatever the user was doing.

## Goals / Non-Goals

**Goals:**
- System-wide shortcut (`CmdOrCtrl+Shift+N` default) opens quick-capture window from any app
- Window pre-populated with branch/worktree/repo label chips via `get_workspace_context()`
- Submit calls existing `create_task` command, closes window, toasts main window
- Empty title blocked at the form level
- Escape / click-outside dismisses without creating an issue
- Shortcut user-configurable via existing shortcuts modal
- Graceful conflict detection: log at startup, show "Unavailable" in settings

**Non-Goals:**
- Rich text / markdown input in quick-capture (title-only capture)
- Creating issues from git hooks or CLI triggers
- Persisting a draft if the window is closed without submitting

---

## Decisions

### Decision: Declare the quick-capture window in `tauri.conf.json`

Tauri 2 supports multiple windows declared in config. The `quick-capture` window is declared with `visible: false` so it is created at app launch (cheap, pre-warmed) but not shown until the shortcut fires.

**Window config:**
```json
{
  "label": "quick-capture",
  "url": "quick-capture.html",
  "visible": false,
  "alwaysOnTop": true,
  "decorations": false,
  "width": 540,
  "height": 320,
  "minWidth": 480,
  "minHeight": 300,
  "resizable": false,
  "skipTaskbar": true,
  "center": true
}
```

`alwaysOnTop: true` ensures the window floats above the calling application.  
`skipTaskbar: true` prevents it from appearing in Dock / Taskbar.  
`center: true` positions it centrally on the screen it appears on.

**Alternatives considered:**
- Create the window dynamically on shortcut press: adds ~200 ms latency on first open; pre-warming avoids this.
- Use a Tauri dialog/modal instead of a second window: dialogs are owned by a parent window; they cannot appear when the main window is minimised or another app is focused.

---

### Decision: Register global shortcut in `src-tauri/src/lib.rs`

The shortcut is registered inside the `setup` closure using `tauri_plugin_global_shortcut`. A failure to register (conflict) is caught, logged as a `warn!`, and recorded in `AppState` so the frontend can query it.

**Shortcut lifecycle:**
```
App startup
  └─ setup() {
       read shortcut from Tauri store (default: CmdOrCtrl+Shift+N)
       register_shortcut(shortcut) {
         Ok  → AppState.quick_capture_shortcut_available = true
         Err → warn!("quick-capture shortcut conflict: {shortcut}"); AppState.quick_capture_shortcut_available = false
       }
     }
App exit / plugin teardown
  └─ global_shortcut plugin automatically unregisters all shortcuts
```

**Shortcut handler** (inside the registered callback):
1. Get the `quick-capture` window by label.
2. Call `window.show()` and `window.set_focus()`.

---

### Decision: `get_workspace_context()` in `external.rs`, called on window show

Calling `get_workspace_context()` on every window show (not at startup) ensures the labels reflect the current git context at the moment of capture. The command shells out to `git` (branch name) and reads the Tauri store for the active worktree/repo, returning a `WorkspaceContext` struct serialized to JSON.

```rust
#[derive(Serialize)]
pub struct WorkspaceContext {
    pub branch: Option<String>,
    pub worktree: Option<String>,
    pub repo: Option<String>,
}
```

On the frontend, `QuickCaptureApp` listens for the Tauri `window://quick-capture/focus` event (or uses `onMounted`/`useEffect` to call the command when the component mounts after the window becomes visible) and sets chip state from the result. If the command errors, chips are simply omitted — non-fatal.

---

### Decision: Toast from main window via Tauri event

When `create_task` succeeds in the quick-capture window, that window emits a Tauri event:
```
emit_to("main", "quick-capture://issue-created", { id: "BUI-xxxx" })
```

The main window listens for this event and renders a toast (`Sonner` or equivalent already used in the app). The quick-capture window then calls `window.hide()` (not `close()`) so it remains pre-warmed for next use.

**Why `hide()` not `close()`:** Closing and re-creating the window is slow. Hiding preserves the warm React tree.

---

### Decision: Own React entry point for quick-capture

`src/quick-capture.tsx` is a second Vite entry that mounts `QuickCaptureApp`. This keeps the quick-capture bundle isolated from the main app shell (no layout, no sidebar, no router). The `QuickCaptureApp` renders:

```
<div class="quick-capture-root">
  <TitleInput />           // required, auto-focused
  <LabelChips />           // read-only pre-populated chips
  <SubmitCancelRow />      // Submit (primary) | Esc to cancel
</div>
```

`vite.config.ts` gains a second `input` entry: `"quick-capture": "src/quick-capture.html"` (or equivalent multi-page config). `tauri.conf.json` `url` points to the compiled `quick-capture.html`.

---

### Decision: Shortcut configurability via Tauri store

The shortcut string is persisted in the Tauri plugin-store under the key `"quickCaptureShortcut"`. On change via the shortcuts modal:
1. Read the new combo from the form.
2. Attempt to register it (conflict → show error, do not persist).
3. On success: unregister the old shortcut, persist new value to store, update `AppState`.

The shortcuts modal gains one new row: label "Quick Capture", current shortcut display, and a capture-key input. If `AppState.quick_capture_shortcut_available` is `false`, the row shows a "Unavailable — shortcut conflict" badge in place of the current value.

---

## Data Flow Summary

```
User presses CmdOrCtrl+Shift+N (from any app)
  → OS delivers to Tauri global shortcut plugin
  → Handler: show + focus quick-capture window
  → QuickCaptureApp mounts/resumes
  → get_workspace_context() called
  → Labels rendered as chips
  → User types title, clicks Submit
  → create_task(title, labels) called
  → Success: emit_to("main", "quick-capture://issue-created", { id })
  → quick-capture window hides
  → Main window toast appears
```
