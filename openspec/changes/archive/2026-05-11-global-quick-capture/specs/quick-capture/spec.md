## ADDED Requirements

### Requirement: Global Shortcut Activation

The system SHALL register a global keyboard shortcut that opens the quick-capture window from any application context.

#### Scenario: User triggers shortcut while another app is focused

- **GIVEN** the quick-capture window is hidden
- **WHEN** the user presses the configured global shortcut (default `CmdOrCtrl+Shift+N`)
- **THEN** the quick-capture window SHALL become visible and focused
- **AND** the title input SHALL receive keyboard focus automatically

#### Scenario: Shortcut triggered while window is already open

- **GIVEN** the quick-capture window is already visible
- **WHEN** the user presses the global shortcut again
- **THEN** the quick-capture window SHALL be brought to the front and remain visible
- **AND** no duplicate window SHALL be created

---

### Requirement: Workspace Label Pre-Population

The system SHALL pre-populate the capture form with workspace context labels before the user begins typing.

#### Scenario: Window opens with workspace context loaded

- **GIVEN** the quick-capture window is hidden
- **WHEN** the window is shown via the global shortcut
- **THEN** `get_workspace_context()` SHALL be called to retrieve branch, worktree, and repo labels
- **AND** each label SHALL be displayed as a read-only chip in the form
- **AND** the chips SHALL be included as labels when the issue is submitted

#### Scenario: Workspace context unavailable

- **GIVEN** `get_workspace_context()` returns an error or empty context
- **WHEN** the quick-capture window opens
- **THEN** the form SHALL render without label chips
- **AND** the user SHALL still be able to submit a title-only issue

---

### Requirement: Issue Creation on Submit

The system SHALL create a new issue using the existing `create_task` command when the form is submitted.

#### Scenario: User submits a valid title

- **GIVEN** the quick-capture window is open
- **WHEN** the user types a non-empty title and clicks Submit or presses Enter
- **THEN** `create_task` SHALL be called with the title and pre-populated labels
- **AND** on success the quick-capture window SHALL close
- **AND** the main window SHALL receive a toast notification containing the new issue id

#### Scenario: User attempts to submit an empty title

- **GIVEN** the quick-capture window is open with the title field empty
- **WHEN** the user clicks Submit or presses Enter
- **THEN** the form SHALL NOT call `create_task`
- **AND** the title input SHALL display an inline validation error
- **AND** the window SHALL remain open

---

### Requirement: Dismissal Without Creating an Issue

The system SHALL allow the user to dismiss the quick-capture window without creating an issue.

#### Scenario: User presses Escape

- **GIVEN** the quick-capture window is open
- **WHEN** the user presses the Escape key
- **THEN** the quick-capture window SHALL close without calling `create_task`

#### Scenario: User clicks outside the window

- **GIVEN** the quick-capture window is open
- **WHEN** the window loses focus (user clicks elsewhere)
- **THEN** the quick-capture window SHALL hide (blur-to-close)
- **AND** no issue SHALL be created

---

### Requirement: Shortcut Conflict Handling

The system SHALL gracefully handle the case where the configured shortcut is already registered by another application.

#### Scenario: Shortcut registration fails at startup

- **GIVEN** the global shortcut is already claimed by another application
- **WHEN** Tauri attempts to register the shortcut during app startup
- **THEN** the registration SHALL fail without crashing the application
- **AND** a warning SHALL be logged at startup describing the conflict
- **AND** the shortcut entry in the shortcuts settings SHALL display as "Unavailable"

---

### Requirement: Shortcut Configurability

The system SHALL allow the user to change the quick-capture shortcut via the existing shortcuts settings UI.

#### Scenario: User changes the shortcut successfully

- **GIVEN** the shortcuts settings modal is open
- **WHEN** the user selects a new key combination for "Quick Capture" that is not already in use
- **THEN** the new shortcut SHALL be persisted to the Tauri store
- **AND** the old shortcut SHALL be unregistered and the new one registered immediately

#### Scenario: User attempts to set a conflicting shortcut

- **GIVEN** the shortcuts settings modal is open
- **WHEN** the user selects a key combination already registered by another application
- **THEN** the system SHALL display an "Unavailable" error without applying the change
- **AND** the previous shortcut SHALL remain active
