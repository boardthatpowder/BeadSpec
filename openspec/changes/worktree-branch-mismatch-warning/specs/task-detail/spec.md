## MODIFIED Requirements

### Requirement: Branch / worktree mismatch warning chips on detail header

The task detail panel SHALL render up to two inline warning chips on its
header — one for the `branch:` axis and one for the `worktree:` axis —
to flag when the active issue's workspace labels differ from the
project's current `WorkspaceContext`. Each chip is purely informational
(no click action) and uses an amber/warning visual treatment consistent
with existing chip palettes. A chip SHALL render only when (a) the
active issue carries the corresponding `<axis>:` label, (b) the
`WorkspaceContext.<axis>` value is non-null, and (c) the parsed values
differ. The two axes SHALL be evaluated independently. No `repo:`
mismatch chip SHALL be rendered. When no chip is required, no DOM SHALL
be emitted for the chip row (no layout shift on the matching path).

#### Scenario: Issue branch label differs from workspace branch
- **GIVEN** the project's `WorkspaceContext.label_branch` is `branch:feat/y`
- **AND** the open issue carries label `branch:feat/x`
- **WHEN** the user views the task detail panel
- **THEN** an amber chip reading `branch: feat/x (current: feat/y)` SHALL appear in the header

#### Scenario: Issue worktree label differs from workspace worktree
- **GIVEN** the project's `WorkspaceContext.label_worktree` is `worktree:foo`
- **AND** the open issue carries label `worktree:bar`
- **WHEN** the user views the task detail panel
- **THEN** an amber chip reading `worktree: bar (current: foo)` SHALL appear in the header

#### Scenario: Both axes mismatch independently
- **WHEN** both the branch label and the worktree label differ from workspace context
- **THEN** two chips SHALL render in the same row, one per axis
- **AND** the order SHALL be branch first, worktree second

#### Scenario: Branch matches but worktree differs
- **WHEN** the branch label matches workspace context but the worktree label does not
- **THEN** only the worktree mismatch chip SHALL render
- **AND** no branch chip SHALL be rendered

#### Scenario: All workspace labels match
- **WHEN** the active issue's `branch:` and `worktree:` labels match the workspace context
- **THEN** no mismatch chip SHALL be rendered
- **AND** the mismatch chip row SHALL produce no DOM

#### Scenario: Issue is missing an axis label
- **WHEN** the active issue carries no `branch:` label
- **THEN** the branch axis chip SHALL NOT render regardless of workspace context
- **AND** the worktree axis SHALL still be evaluated independently

#### Scenario: Workspace context is unavailable
- **WHEN** the project root is not a git repository and `useWorkspaceContext()` returns `null`
- **THEN** no mismatch chips SHALL render regardless of issue labels

#### Scenario: Hovering or focusing a mismatch chip reveals the recommendation tooltip
- **WHEN** the user hovers or keyboard-focuses a branch mismatch chip
- **THEN** a tooltip SHALL display "This issue belongs to a different branch; switching to that branch is recommended."
- **AND** the equivalent worktree-axis copy SHALL apply for the worktree chip

#### Scenario: Mismatch chip is non-interactive
- **WHEN** the user clicks a mismatch chip
- **THEN** no navigation, no mutation, and no IPC call SHALL occur
- **AND** the chip remains a read-only signal

#### Scenario: Label value contains additional colons
- **WHEN** an issue label is `branch:feat/foo:bar` (i.e. its value contains a colon)
- **THEN** the parsed branch value SHALL be `feat/foo:bar` (split on first colon only)
- **AND** the chip comparison SHALL use that full value
