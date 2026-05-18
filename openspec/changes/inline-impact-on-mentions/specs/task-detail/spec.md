## MODIFIED Requirements

### Requirement: Rich Markdown Editor with Slash Commands

The system SHALL provide a rich text editor (TipTap) for task descriptions and comments, supporting markdown rendering, live preview, and slash commands. Unsaved-edits prompts SHALL fire on workspace tab close and on app exit (not only on navigation away from the task). The editor SHALL additionally support a render-time symbol-mention decoration layer that does NOT enter the persisted markdown — `editor.storage.markdown.getMarkdown()` output SHALL be byte-identical with and without the decoration extension loaded.

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

#### Scenario: Markdown round-trip is byte-identical with the symbol-mention extension loaded
- **WHEN** a description is loaded into the editor and immediately serialized via `editor.storage.markdown.getMarkdown()`
- **THEN** the output SHALL equal the input byte-for-byte
- **AND** the symbol-mention extension SHALL NOT have added any nodes or marks to the document JSON

---

## ADDED Requirements

### Requirement: Inline GitNexus impact on symbol mentions in description editor

The `DescriptionEditor` SHALL detect symbol-like tokens in the rendered description and, for tokens that match a symbol in the GitNexus index for the active project, display a hover popover with an impact summary and a deep-link to the full impact panel. The decoration SHALL be render-only and never persisted.

Token detection priority: (1) tokens inside inline-code backticks; (2) CamelCase identifiers ≥ 3 chars with at least one internal lowercase→uppercase boundary; (3) snake_case identifiers with at least one underscore and total length > 4. Tokens shorter than 3 chars or present in a built-in stoplist SHALL NOT be decorated.

#### Scenario: Backtick-fenced symbol with a GitNexus match
- **GIVEN** a description containing `` `lookup_symbols` `` and GitNexus has a matching symbol
- **WHEN** the editor renders the description
- **THEN** the token `lookup_symbols` SHALL appear with a subtle 1px dotted underline
- **AND** hovering the token SHALL open a popover showing the qualified path, a 1-line description, a risk badge, and up to 3 upstream callers

#### Scenario: Token with no GitNexus match renders plain
- **GIVEN** a description contains the CamelCase token `RandomNonExistentSymbol`
- **WHEN** `lookup_symbols` returns `None` for it
- **THEN** no underline SHALL be applied
- **AND** no popover SHALL be available for that token

#### Scenario: "Open full impact" deep-links to the Impact tab
- **GIVEN** the popover is open for a matched symbol
- **WHEN** the user activates the "Open full impact" CTA
- **THEN** the parent `TaskDetailPanel` SHALL switch to its Impact inner sub-tab with the symbol pre-selected
- **AND** the state update SHALL use `{ view: 'all', taskId, innerTab: 'impact', impactSymbol: qualifiedPath }` per the contract supplied by the `gitnexus-impact-panel` change
- **AND** if the Impact tab is not yet registered, the CTA SHALL silently no-op without throwing an error

#### Scenario: GitNexus unavailable degrades gracefully
- **WHEN** the `lookup_symbols` Tauri command returns an error (e.g. GitNexus not installed or index stale)
- **THEN** no decorations SHALL be applied
- **AND** the editor SHALL remain fully functional
- **AND** no user-visible error banner SHALL appear in the editor surface

#### Scenario: Markdown round-trip is preserved with decorations present
- **WHEN** the editor serializes a description that contains decorated symbol tokens
- **THEN** the serialized markdown SHALL be byte-identical to the input markdown

#### Scenario: Stoplisted token is not decorated
- **GIVEN** a description contains `useEffect` (in the built-in stoplist)
- **WHEN** the editor renders the description
- **THEN** the token SHALL render as plain text regardless of whether GitNexus could match it

#### Scenario: Lookup is debounced and batched
- **WHEN** the user types continuously in the editor
- **THEN** at most one `lookup_symbols` Tauri call SHALL be in-flight per editor instance at a time
- **AND** the call SHALL batch all candidate token names accumulated within the 300 ms debounce window
