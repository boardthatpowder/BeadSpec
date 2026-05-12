# Task Detail Panel Specification

## Purpose

Defines the right-side detail panel for a selected task: inline editing of all fields, the rich-text markdown editor with slash commands, task reference autocomplete, the activity/history timeline with diff view, and breadcrumb navigation for tasks deep in dependency chains.

---

## Requirements

### Requirement: Task detail panel tabs respect feature flags
The task detail panel SHALL conditionally render the OpenSpec panel section and the Ruflo memory panel section based on the corresponding feature flags. When a feature is disabled, its panel SHALL be entirely absent — not rendered, not hidden with CSS, and no Tauri IPC calls made for it.

#### Scenario: OpenSpec panel absent when OpenSpec disabled
- **WHEN** OpenSpec is disabled in Settings
- **THEN** the OpenSpec panel section does not appear in the task detail panel

#### Scenario: OpenSpec panel present when OpenSpec enabled
- **WHEN** OpenSpec is enabled in Settings and the task has an `openspec:*` label
- **THEN** the OpenSpec panel section appears in the task detail panel in its normal position

#### Scenario: Ruflo memory panel absent when Ruflo disabled
- **WHEN** Ruflo is disabled in Settings
- **THEN** the Ruflo memory panel section does not appear in the task detail panel

#### Scenario: Ruflo memory panel present when Ruflo enabled
- **WHEN** Ruflo is enabled in Settings and ruflo is on PATH
- **THEN** the Ruflo memory panel section appears in the task detail panel in its normal position

---

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

#### Scenario: User adds a label
- **WHEN** the user clicks "+ Add Label" in the detail panel
- **THEN** an inline input SHALL appear with fuzzy autocomplete over existing labels in the project
- **AND** typing a new label value SHALL allow creating it
- **AND** confirming SHALL add the label via `bd`

#### Scenario: User removes a label
- **WHEN** the user clicks the × on a label chip
- **THEN** the label SHALL be removed via `bd` immediately
- **AND** if removing the label causes it to no longer match active filters, the detail panel SHALL remain open but the task SHALL be visually marked as outside the current filter

---

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

### Requirement: Task Reference Autocomplete

The system SHALL surface task reference autocomplete anywhere a task ID is typed.

#### Scenario: User types bd- in any text input
- **WHEN** the user types `bd-` (case-insensitive) in a description, comment, or any text field
- **THEN** a floating task picker SHALL appear with fuzzy search over all task IDs and titles in the current project
- **AND** selecting a task SHALL insert the task ID or a formatted link depending on context

#### Scenario: No match found for typed bd- query
- **WHEN** the user types `bd-99999` and no task matches
- **THEN** the picker SHALL show "No tasks found"
- **AND** the picker SHALL dismiss on Escape, leaving the typed text intact

---

### Requirement: Activity Timeline with Diff View

The system SHALL show a chronological feed of all changes to the selected task, with the ability to view what changed between any two timeline entries.

#### Scenario: Task detail panel shows activity tab
- **WHEN** the user opens the "Activity" tab in the detail panel
- **THEN** all recorded changes SHALL be shown in reverse chronological order
- **AND** each entry SHALL show: timestamp, actor (user or CLI), change type (status change, label add, comment, description edit)

#### Scenario: User views a diff between two history entries
- **WHEN** the user selects two activity entries (or clicks "View changes" on any entry)
- **THEN** a diff view SHALL display what changed: field-level diffs for status/priority/labels, and a text diff for description changes

#### Scenario: Comment added appears in timeline
- **WHEN** a comment is added to a task (by the user or externally via real-time sync)
- **THEN** it SHALL appear in the activity timeline immediately
- **AND** the comment body SHALL be rendered as markdown

---

### Requirement: Breadcrumb Navigation

The system SHALL show a breadcrumb trail when a task is reached by navigating through a dependency chain, so the user knows their location.

#### Scenario: User navigates to a task via its dependency graph
- **GIVEN** the user is viewing Task A
- **AND** Task A depends on Task B which depends on Task C
- **WHEN** the user clicks Task C in the dependency graph
- **THEN** the breadcrumb bar SHALL show: `Task A → Task C`
- **AND** clicking `Task A` in the breadcrumb SHALL navigate back to Task A

#### Scenario: User opens a task directly from the task list
- **WHEN** the user selects a task directly from the left list panel
- **THEN** no breadcrumb SHALL be shown (navigation history starts fresh)

#### Scenario: Navigation history limit
- **WHEN** the breadcrumb chain exceeds 5 levels deep
- **THEN** the breadcrumb SHALL collapse the middle entries into `...`
- **AND** the first and last entries SHALL always be visible

---

### Requirement: OpenSpec panel section in task detail
The task detail pane SHALL render an "OpenSpec" accordion section below the existing content area when the task has an `openspec:*` label. See the `openspec-panel` spec for full requirements. The section SHALL be compatible with the future `multi-tab-task-detail-workspace` migration path: it accepts a `containerMode: 'section' | 'tab'` prop so migration is a one-prop change.

#### Scenario: OpenSpec section present for labelled task
- **WHEN** the user opens a task with an `openspec:some-change` label
- **THEN** an "OpenSpec" collapsible section appears in the task detail pane below the activity content

#### Scenario: OpenSpec section absent for unlabelled task
- **WHEN** the user opens a task with no `openspec:*` label
- **THEN** no OpenSpec section is rendered and layout is unchanged

### Requirement: Ruflo memory panel section in task detail
The task detail pane SHALL render a "Related memories" accordion section. See the `ruflo-memory-panel` spec for full requirements. The section SHALL render `null` when `ruflo` is not on PATH.

#### Scenario: Related memories section shown when ruflo available
- **WHEN** the app has resolved `ruflo` on PATH
- **THEN** a collapsed "Related memories" section appears in the task detail pane for every task

#### Scenario: Related memories section hidden when ruflo unavailable
- **WHEN** `ruflo` is not found on PATH at app startup
- **THEN** the "Related memories" section does not appear in the task detail pane

### Requirement: Git/Dolt history panel section in task detail
The task detail activity area SHALL integrate git commit references, active branch indicator, and Dolt row-history entries. See the `git-history-panel` spec for full requirements.

#### Scenario: Git history section rendered in activity tab
- **WHEN** the user opens the activity tab for a task in a git-tracked project
- **THEN** a "Git history" sub-section appears within the activity tab content

#### Scenario: Git history section absent for non-git project
- **WHEN** the project root is not a git repository
- **THEN** no Git history section is rendered in the activity tab

### Requirement: Additive section ordering
The three new sections (OpenSpec, Related Memories, Git/Dolt History) SHALL appear in the task detail pane in this order: OpenSpec panel first (most workflow-critical), Ruflo memories second, Git/Dolt history third. All three sections SHALL be individually collapsible and SHALL NOT cause layout shift for tasks where they are absent.

#### Scenario: Section ordering maintained
- **WHEN** a task has all three sections rendered
- **THEN** OpenSpec appears first, Related Memories second, Git/Dolt History third in the DOM and visual layout
