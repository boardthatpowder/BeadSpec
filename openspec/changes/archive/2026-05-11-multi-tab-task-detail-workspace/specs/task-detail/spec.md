## ADDED Requirements

### Requirement: Detail Panel is Controlled by Workspace Tab

The system SHALL render `TaskDetailPanel` as a controlled component that receives its `taskId` as a prop from the enclosing workspace tab, allowing multiple `TaskDetailPanel` instances to coexist (one per workspace tab) without sharing state.

#### Scenario: Multiple tabs show different tasks simultaneously
- **GIVEN** the user has two pinned tabs (Task A and Task B) in the same pane
- **WHEN** the user switches between the tabs
- **THEN** each `TaskDetailPanel` SHALL render its own task data
- **AND** edits made to Task A SHALL NOT affect the rendering of Task B

#### Scenario: Inner sub-tab is remembered per workspace tab
- **GIVEN** the user has Task A and Task B open in the same pane
- **AND** Task A's inner sub-tab is set to "Activity"
- **AND** Task B's inner sub-tab is set to "Dependencies"
- **WHEN** the user switches between the tabs
- **THEN** Task A SHALL show the Activity sub-tab and Task B SHALL show the Dependencies sub-tab
- **AND** the inner sub-tab state SHALL persist across reloads as part of the workspace

#### Scenario: Detail panel cleans up on tab close
- **WHEN** a workspace tab is closed
- **THEN** the corresponding `TaskDetailPanel` instance SHALL unmount
- **AND** its inner sub-tab state SHALL be discarded

---

## MODIFIED Requirements

### Requirement: Rich Markdown Editor with Slash Commands

The system SHALL provide a rich text editor (TipTap) for task descriptions and comments, supporting markdown rendering, live preview, and slash commands. Unsaved-edits prompts SHALL fire on workspace tab close and on app exit (not only on navigation away from the task).

#### Scenario: User opens the description editor
- **WHEN** the user clicks the task description area
- **THEN** the area SHALL switch from rendered markdown to an editable rich-text view
- **AND** the editor SHALL preserve markdown formatting

#### Scenario: User types a slash command
- **WHEN** the user types `/` in the editor
- **THEN** a command menu SHALL appear with options including: `/task`, `/code`, `/checklist`, `/heading`, `/quote`
- **AND** pressing Escape SHALL dismiss the menu and keep the `/` character

#### Scenario: User inserts a task reference with /task
- **WHEN** the user selects `/task` from the slash command menu
- **THEN** a fuzzy task picker SHALL appear, seeded with the query typed after `/task `
- **AND** selecting a task SHALL insert a clickable task link: `[BD-123: Task Title](beads://task/123)`
- **AND** in rendered mode, the link SHALL display the current task title (resolved at render time)

#### Scenario: User inserts a code block with /code
- **WHEN** the user selects `/code` from the slash command menu
- **THEN** a code block SHALL be inserted with syntax highlighting
- **AND** a language selector SHALL appear to choose the language

#### Scenario: Unsaved changes when closing a workspace tab
- **WHEN** the user closes a workspace tab (via ×, middle-click, Close/Close Others/Close to the Right/Close All, or Cmd/Ctrl+W) while its description has unpersisted edits
- **THEN** a confirmation SHALL prompt: "You have unsaved changes. Save or discard?"
- **AND** if the user picks Save, the edit SHALL persist before the tab closes
- **AND** if the user picks Discard, the edit SHALL be dropped and the tab SHALL close
- **AND** if the user picks Cancel, the tab SHALL remain open

#### Scenario: Unsaved changes when exiting the app
- **WHEN** the user closes the app window while any open tab has unpersisted edits
- **THEN** the same "Save / Discard / Cancel" prompt SHALL appear once, listing affected tabs
- **AND** picking Save SHALL persist all unsaved edits before exit

---

### Requirement: Inline Editing of All Task Fields

The system SHALL allow all task fields — title, status, priority, assignee, labels — to be edited inline within the detail panel without opening a modal dialog. Any persisted field edit performed inside a preview tab SHALL promote that tab to a pinned tab before the mutation is dispatched.

#### Scenario: User edits the task title
- **WHEN** the user clicks the task title in the detail panel
- **THEN** the title SHALL become an editable text input in place
- **AND** pressing Enter or clicking outside SHALL save the change via `bd`
- **AND** pressing Escape SHALL discard the change and restore the original title
- **AND** if the edit occurred in a preview tab, the tab SHALL be promoted to pinned before the save dispatches

#### Scenario: User changes task status via dropdown
- **WHEN** the user clicks the status badge in the detail panel
- **THEN** a dropdown SHALL appear with all valid status transitions
- **AND** selecting a status SHALL apply it immediately with an optimistic update
- **AND** the change SHALL be persisted via `bd`
- **AND** if the edit occurred in a preview tab, the tab SHALL be promoted to pinned before the dispatch

#### Scenario: User adds a label
- **WHEN** the user clicks "+ Add Label" in the detail panel
- **THEN** an inline input SHALL appear with fuzzy autocomplete over existing labels in the project
- **AND** typing a new label value SHALL allow creating it
- **AND** confirming SHALL add the label via `bd`
- **AND** if the edit occurred in a preview tab, the tab SHALL be promoted to pinned before the dispatch

#### Scenario: User removes a label
- **WHEN** the user clicks the × on a label chip
- **THEN** the label SHALL be removed via `bd` immediately
- **AND** if removing the label causes it to no longer match active filters, the detail panel SHALL remain open but the task SHALL be visually marked as outside the current filter
- **AND** if the edit occurred in a preview tab, the tab SHALL be promoted to pinned before the dispatch
