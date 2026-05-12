## MODIFIED Requirements

### Requirement: Rich Markdown Editor with Slash Commands
The system SHALL provide a rich text editor (TipTap) for task descriptions and comments, supporting markdown rendering, live preview, and slash commands. Unsaved-edits prompts SHALL fire on workspace tab close and on app exit (not only on navigation away from the task). The editor SHALL NOT parse or render raw HTML from user-supplied content.

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

#### Scenario: Raw HTML in description is not rendered
- **WHEN** a task description contains raw HTML tags (e.g., `<script>`, `<img onerror=...>`, `<a href="javascript:...">`)
- **THEN** the editor SHALL NOT execute or render the HTML as markup
- **AND** the tags SHALL be treated as plain text or stripped entirely
- **AND** no script SHALL execute and no external resource SHALL be loaded as a result

#### Scenario: Legacy HTML description is sanitized at load time
- **WHEN** a task description stored in the database contains raw HTML
- **THEN** the frontend SHALL pass it through DOMPurify before handing it to the TipTap editor
- **AND** the sanitized version SHALL be displayed; the raw HTML SHALL NOT be parsed by TipTap
