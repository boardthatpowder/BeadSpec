# Tasks: global-quick-capture

## Task 1: Tauri config — declare quick-capture window

Add the `quick-capture` window entry to `src-tauri/tauri.conf.json`:
- `label: "quick-capture"`, `url: "quick-capture.html"`, `visible: false`
- `alwaysOnTop: true`, `decorations: false`, `skipTaskbar: true`, `center: true`
- `width: 540`, `height: 320`, `minWidth: 480`, `minHeight: 300`, `resizable: false`

Also add a second Vite entry in `vite.config.ts` for `src/quick-capture.html` → `src/quick-capture.tsx`, and create the `src/quick-capture.html` stub.

- [x] Add window declaration to `tauri.conf.json`
- [x] Add Vite multi-page entry for `quick-capture`
- [x] Create `src/quick-capture.html` (mirrors `index.html`, script points to `quick-capture.tsx`)

## Task 2: Shortcut registration in `lib.rs`

In the `setup` closure in `src-tauri/src/lib.rs`:
- Read shortcut string from Tauri plugin-store (key `"quickCaptureShortcut"`, default `"CmdOrCtrl+Shift+N"`)
- Register with `tauri_plugin_global_shortcut`
- On `Ok`: set `AppState.quick_capture_shortcut_available = true`
- On `Err`: `warn!("quick-capture global shortcut conflict: {shortcut}")`, set field to `false`
- Handler shows and focuses the `quick-capture` window by label

Extend `AppState` with:
```rust
pub quick_capture_shortcut: String,
pub quick_capture_shortcut_available: bool,
```

Add Tauri command `get_shortcut_status() -> ShortcutStatus` so the frontend can query availability.

- [x] Extend `AppState` with shortcut fields
- [x] Register shortcut in `setup()`, handle conflict
- [x] Implement shortcut handler (show + focus window)
- [x] Add `get_shortcut_status` command

## Task 3: `get_workspace_context` command in `external.rs`

In `src-tauri/src/commands/external.rs`, add:

```rust
#[derive(Serialize)]
pub struct WorkspaceContext {
    pub branch: Option<String>,
    pub worktree: Option<String>,
    pub repo: Option<String>,
}

#[tauri::command]
pub async fn get_workspace_context(app: AppHandle) -> Result<WorkspaceContext, String> { ... }
```

Implementation:
- Branch: run `git rev-parse --abbrev-ref HEAD` in the current directory, trim output
- Worktree: read from Tauri store key `"activeWorktree"` or fall back to directory basename
- Repo: read from Tauri store key `"activeRepo"` or fall back to git remote parse
- Any field that errors becomes `None`
- Register the command in `lib.rs` `invoke_handler`

- [x] Define `WorkspaceContext` struct and `get_workspace_context` command
- [x] Register in invoke handler
- [x] Add to tauri-specta bindings codegen (if applicable)

## Task 4: `QuickCaptureApp` — React entry, form, workspace context

Create `src/QuickCaptureApp.tsx`:
- Minimal tree: no layout shell, no sidebar, no router
- On component mount: call `get_workspace_context()`, set label chips state
- Render:
  - Auto-focused `<TitleInput>` (plain `<input type="text">` with Tailwind styling)
  - `<LabelChips>` — read-only chips for branch/worktree/repo (omit if null)
  - `<SubmitCancelRow>` — "Create Issue" primary button, "Cancel" secondary (or just show "Esc to cancel")
- Keyboard: Enter submits (if title non-empty), Escape calls `appWindow.hide()`
- Window blur: call `appWindow.hide()` (Tauri `onBlurChange` or `window` blur event)

Create `src/quick-capture.tsx`:
- Standard React entry: `ReactDOM.createRoot(document.getElementById('root')!).render(<QuickCaptureApp />)`

- [x] Create `src/QuickCaptureApp.tsx` with form, chips, keyboard handlers
- [x] Create `src/quick-capture.tsx` entry point
- [x] Wire `get_workspace_context()` call on mount

## Task 5: Submit — call `create_task`, toast main window, hide

In `QuickCaptureApp`, on submit:
1. Validate title non-empty → show inline error if empty (do not call backend)
2. Call Tauri command `create_task({ title, labels: [...chip labels] })`
3. On success:
   - `emit("quick-capture://issue-created", { id: result.id })` to main window via `getCurrent().emit` or `emitTo("main", ...)`
   - Call `appWindow.hide()`
4. On error: display error message inline, keep window open

In the main window (e.g. `App.tsx` or a top-level event listener):
- Listen for `"quick-capture://issue-created"` event
- Show a toast: "Issue {id} created" (using existing toast library)

- [x] Implement submit handler with validation
- [x] Emit `quick-capture://issue-created` to main window
- [x] Add main-window event listener and toast
- [x] Hide window on success

## Task 6: Shortcuts modal — add quick-capture shortcut entry

In the existing shortcuts settings component (locate by searching for the shortcuts modal):
- Add a row: label "Quick Capture", current shortcut value from store
- If `quick_capture_shortcut_available` is `false`, show "Unavailable — conflict with another app" badge
- Allow editing: key-capture input → attempt register → on success persist to store, update display; on conflict show error without persisting

- [x] Add "Quick Capture" row to shortcuts modal
- [x] Implement key-capture and re-registration logic
- [x] Show "Unavailable" badge when `available = false`

## Task 7: Manual test checklist

Verify end-to-end behaviour:
- [x] Trigger shortcut from another app (e.g. terminal) — window appears centered and focused
- [x] Label chips are pre-populated with current branch/worktree/repo
- [x] Submit with valid title — issue created, toast appears in main window with id, window hides
- [x] Submit with empty title — validation error, window stays open
- [x] Press Escape — window closes without creating issue
- [x] Click outside window — window closes (blur-to-close)
- [x] Simulate shortcut conflict (register same shortcut in another app) — warning logged, "Unavailable" in settings
- [x] Change shortcut in settings — old unregistered, new registered, next trigger uses new combo

## Task 8: Validate & close

- [x] Run `openspec validate global-quick-capture` and confirm all artifacts pass
- [x] Close this change (mark archived or complete per workflow)
