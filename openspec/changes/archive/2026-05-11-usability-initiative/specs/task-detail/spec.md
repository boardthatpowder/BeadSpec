## ADDED Requirements

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
