# Quick Capture Specification

### Requirement: Global shortcut opens quick-capture window
The app SHALL register a system-wide keyboard shortcut that opens a minimal capture window regardless of which application has focus. The shortcut SHALL be registered via `tauri-plugin-global-shortcut` at app startup and unregistered on app exit. The shortcut is user-configurable via the Settings dialog (default: `CmdOrCtrl+Shift+N`). When the user changes the shortcut, the old shortcut is unregistered and the new one is registered immediately without restart.

#### Scenario: Shortcut fires while another app is focused
- **WHEN** the user presses `Cmd+Shift+N` (macOS) while a browser is in focus
- **THEN** the beads-ui quick-capture window appears in the foreground

#### Scenario: Shortcut fires when beads-ui is already focused
- **WHEN** the user presses `Cmd+Shift+N` while beads-ui is the active app
- **THEN** the quick-capture window opens (or focuses if already open)

#### Scenario: Custom shortcut registered on settings save
- **WHEN** the user changes the quick-capture shortcut in Settings and saves
- **THEN** the previous shortcut stops triggering quick capture and the new shortcut triggers it instead

#### Scenario: Invalid shortcut registration shows error
- **WHEN** the user saves a quick-capture shortcut that cannot be registered (e.g., OS-reserved)
- **THEN** the Settings dialog shows an inline error for the shortcut field and the previous shortcut remains active

#### Scenario: Default shortcut restored when field cleared
- **WHEN** the user clears the quick-capture shortcut field and saves
- **THEN** the default shortcut `CmdOrCtrl+Shift+N` is registered

#### Scenario: Shortcut conflicts
- **WHEN** another application has registered the same global shortcut
- **THEN** beads-ui logs a warning at startup and disables its own registration; the Settings dialog shows "Shortcut unavailable — change to a different binding"

### Requirement: Quick-capture window pre-populates workspace labels
The quick-capture window SHALL pre-populate three label chips (`branch:<HEAD>`, `worktree:<segment>`, `repo:<name>`) derived from the active project's workspace context. The user MAY remove any pre-populated label before submitting. If no project is connected or workspace context is unavailable, no labels are pre-populated.

#### Scenario: Workspace context available — labels pre-filled
- **WHEN** the quick-capture window opens with an active project that has workspace context
- **THEN** three label chips are shown pre-filled and the user can optionally remove them

#### Scenario: No project connected — labels absent
- **WHEN** the quick-capture window opens with no project connected
- **THEN** no label chips are pre-populated; the user may type labels manually

### Requirement: Submit creates issue in active project
Submitting the quick-capture form SHALL call the existing `create_task` Tauri command against the active project, apply any labels shown in the form, and close the window. The newly created issue id SHALL be shown briefly as a toast in the main window.

#### Scenario: Successful capture
- **WHEN** the user types a title in the quick-capture window and presses Enter or clicks "Create"
- **THEN** the issue is created, the window closes, and a toast in the main window shows the new issue id (e.g. "Created beads-47")

#### Scenario: Empty title — submit blocked
- **WHEN** the user attempts to submit with an empty title field
- **THEN** the form shows an inline validation error "Title is required" and does not submit

#### Scenario: Window dismissed without submitting
- **WHEN** the user presses Escape or clicks outside the window
- **THEN** the window closes with no issue created
