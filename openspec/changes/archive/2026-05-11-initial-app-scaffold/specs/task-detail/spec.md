## ADDED Requirements

Defines the right-side detail panel for a selected task: inline editing of all fields, the rich-text markdown editor with slash commands, task reference autocomplete, the activity/history timeline with diff view, and breadcrumb navigation for tasks deep in dependency chains.

### Requirement: Inline Editing of All Task Fields

The system SHALL allow all task fields — title, status, priority, assignee, labels — to be edited inline within the detail panel without opening a modal dialog.

#### Scenario: User edits the task title
- **WHEN** the user clicks the task title in the detail panel
- **THEN** the title SHALL become an editable text input in place
- **AND** pressing Enter or clicking outside SHALL save the change via `bd`
- **AND** pressing Escape SHALL discard the change and restore the original title

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

### Requirement: Rich Markdown Editor with Slash Commands

The system SHALL provide a rich text editor (TipTap or Milkdown) for task descriptions and comments, supporting markdown rendering, live preview, and slash commands.

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

#### Scenario: Unsaved changes to description
- **WHEN** the user has edited the description without saving
- **AND** attempts to navigate away from the task
- **THEN** a confirmation SHALL prompt: "You have unsaved changes. Save or discard?"

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
