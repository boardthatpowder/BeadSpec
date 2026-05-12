## ADDED Requirements

### Requirement: OpenSpec artifact opens as a workspace tab

The system SHALL open any OpenSpec artifact (proposal, design, tasks, or delta-spec) as a read-only tab in the active workspace pane when the user clicks its link, rather than opening it in the OS default editor.

#### Scenario: User clicks a proposal link
- **WHEN** the user clicks the "proposal" link for a change in the changes browser or the per-task OpenSpec panel
- **THEN** the file content SHALL open as a new tab in the active workspace pane
- **AND** the tab SHALL render the markdown content in read-only mode
- **AND** the tab title SHALL display `<change-name>/proposal`
- **AND** the tab icon SHALL visually distinguish it from task tabs

#### Scenario: Artifact already open in a tab
- **WHEN** the user clicks an artifact link for a file that is already open in any pane
- **THEN** that existing tab SHALL be brought to focus
- **AND** no duplicate tab SHALL be created

#### Scenario: Artifact tab persists across navigation
- **WHEN** the user opens an artifact tab and then navigates to another view and back
- **THEN** the artifact tab SHALL still be present in the workspace

#### Scenario: Artifact tab can be closed
- **WHEN** the user closes an artifact tab (via the tab's close button or Cmd/Ctrl+W)
- **THEN** the tab SHALL be removed from the workspace
- **AND** the workspace SHALL show the next available tab or the empty-pane placeholder

---

### Requirement: Read-only markdown rendering in doc tab

The system SHALL render the contents of an OpenSpec artifact tab as formatted markdown, with no editing capability.

#### Scenario: Markdown renders correctly
- **WHEN** an artifact tab is open
- **THEN** the content SHALL be rendered as formatted markdown (headings, code blocks, lists, bold/italic)
- **AND** the content SHALL NOT be editable (no cursor, no input handling)

#### Scenario: Content loading state
- **WHEN** an artifact tab is first opened
- **THEN** a loading skeleton SHALL be shown while the file content is being fetched
- **AND** the skeleton SHALL be replaced by the rendered content on success

#### Scenario: Artifact file missing or unreadable
- **WHEN** the artifact file does not exist or cannot be read
- **THEN** an error state SHALL be shown in the tab: "Could not load this artifact"

---

### Requirement: Discriminated workspace tab model

The workspace tab model SHALL support a discriminated union of tab kinds, so non-task content (e.g. OpenSpec docs) can be opened as first-class tabs alongside task tabs.

#### Scenario: Task tab behavior is unchanged
- **WHEN** the user opens a task via single-click or double-click
- **THEN** the task tab SHALL open exactly as before (preview/pinned semantics, task detail panel rendered)
- **AND** existing task tab operations (reorder, split, move, close, persist) SHALL function identically

#### Scenario: Doc tab is always pinned
- **WHEN** the user opens an OpenSpec artifact
- **THEN** the artifact tab SHALL open as a pinned tab (never as a preview/transient tab)

#### Scenario: Layout persists with mixed tab kinds
- **WHEN** the workspace contains both task tabs and doc tabs and the app is restarted
- **THEN** all tabs SHALL be restored in their correct panes and positions
- **AND** doc tabs SHALL re-fetch their content on restore
