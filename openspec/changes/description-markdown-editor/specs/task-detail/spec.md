## MODIFIED Requirements

### Requirement: Rich Markdown Editor with Slash Commands

The system SHALL provide a rich text editor (TipTap) for task descriptions and comments, supporting markdown round-trip (parse on load, serialize on save), live preview, and slash commands. Descriptions SHALL be stored as markdown; the editor SHALL produce markdown on save and accept markdown as input.

#### Scenario: User opens the description editor
- **WHEN** the user clicks the task description area
- **THEN** the area SHALL switch from rendered markdown to an editable rich-text view
- **AND** the editor SHALL correctly render the markdown content (headings, bold, italic, lists, code fences, task items)
- **AND** the editor SHALL preserve all markdown formatting when the user returns to view mode without editing

#### Scenario: Description created via CLI renders correctly
- **WHEN** a description was created or edited via the `bd` CLI (stored as plain markdown)
- **AND** the user opens the task detail panel
- **THEN** the description SHALL render with correct formatting (no literal asterisks, no collapsed line breaks)
- **AND** line breaks, lists, code blocks, and inline formatting SHALL all display as intended

#### Scenario: User edits and saves a description
- **WHEN** the user edits the description in the rich-text editor and saves
- **THEN** the description SHALL be persisted as markdown (not HTML)
- **AND** running `bd show <id>` SHALL display human-readable markdown for the description field

#### Scenario: Legacy HTML description loads without corruption
- **WHEN** a description in storage begins with a `<` character (legacy HTML saved by the UI)
- **THEN** the editor SHALL load and render it without stripping or corrupting its content
- **AND** if the user saves without editing, the description SHALL remain unchanged in storage

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
