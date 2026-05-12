## ADDED Requirements

### Requirement: OpenSpec panel section in task detail
The task detail pane SHALL conditionally render an "OpenSpec" collapsible accordion section when the current task has at least one label matching `openspec:<change-name>`. The section is implemented by `OpenSpecPanel.tsx` and rendered within the "Details" tab scroll area. See `specs/openspec-panel/spec.md` for the full panel requirements.

The section SHALL accept a `containerMode: 'section' | 'tab'` prop so that the future `multi-tab-task-detail-workspace` migration can move the section to a dedicated tab by changing a single prop at the call site in `TaskDetailPanel.tsx`.

#### Scenario: OpenSpec section present for labelled task
- **WHEN** the user opens a task with an `openspec:some-change` label
- **THEN** an "OpenSpec" collapsible section appears in the task detail pane, within the "Details" tab, below any existing field content

#### Scenario: OpenSpec section absent for unlabelled task
- **WHEN** the user opens a task with no `openspec:*` label
- **THEN** no OpenSpec section is rendered and the layout is visually unchanged

#### Scenario: containerMode prop accepted
- **WHEN** `<OpenSpecPanel containerMode="section" ... />` is rendered by `TaskDetailPanel`
- **THEN** the section renders in collapsible mode; replacing with `containerMode="tab"` renders in full-height pane mode without crashing

### Requirement: OpenSpec section ordering relative to future additive sections
When the OpenSpec section is co-present with sections added by later sub-changes (Ruflo memory panel, Git/Dolt history panel), the OpenSpec section SHALL appear first. The section ordering in the "Details" tab SHALL be:

1. OpenSpec panel (workflow-critical: artifact links, progress, validate)
2. Ruflo memory panel (future sub-change `ruflo-memory-panel`)
3. Git/Dolt history panel (future sub-change `git-history-panel`)

In this change only the OpenSpec panel is implemented. The ordering constraint is enforced by the placement of the `OpenSpecPanel` render call in `TaskDetailPanel.tsx` — it SHALL be the last item rendered inside the details scroll area in this change so that prepending future panels naturally gives them lower visual priority.

#### Scenario: OpenSpec section position when alone
- **WHEN** only the OpenSpec panel section is rendered (Ruflo and Git panels not yet implemented)
- **THEN** the OpenSpec section appears at the bottom of the "Details" tab content, after the description editor and any existing field content

#### Scenario: Section ordering maintained when all three panels present (future)
- **WHEN** all three additive sections (OpenSpec, Ruflo, Git) are rendered
- **THEN** OpenSpec appears first, Ruflo second, Git/Dolt history third in the DOM and visual layout

### Requirement: No layout shift for tasks without OpenSpec sections
Tasks that do not have an `openspec:*` label SHALL have an identical layout to the pre-change `TaskDetailPanel`. The conditional render SHALL not introduce any empty containers, padding, or margin when the panel is absent.

#### Scenario: Non-openspec task layout unchanged
- **WHEN** a task has no `openspec:*` label
- **THEN** the "Details" tab layout is pixel-identical to the pre-change layout (no extra whitespace or dividers)
