# Git History Panel Specification

## Purpose

Defines the Git history collapsible section shown in the task detail activity tab and the Git branch badge shown in the task detail header. This panel surfaces Git commit refs and branch associations for a task without requiring context-switching to a terminal.

---

## ADDED Requirements

### Requirement: Git history section is hidden for non-git projects

The system SHALL omit the Git history section entirely when the project root does not contain a `.git` directory. No error state or placeholder SHALL be shown.

#### Scenario: Project root has no .git directory
- **GIVEN** the active project root does not have a `.git` directory
- **WHEN** the user opens the "Activity" tab in the task detail panel
- **THEN** no Git history section SHALL be rendered in the activity tab
- **AND** no branch badge SHALL appear in the task detail header

### Requirement: Git history section is collapsible

The system SHALL render a collapsible "Git history" section in the activity tab when the project root has a `.git` directory, regardless of whether any commits or branches match the current task.

#### Scenario: No matching commits or branches
- **GIVEN** the project root has a `.git` directory
- **AND** no commits or branches reference the current task ID
- **WHEN** the user opens the "Activity" tab
- **THEN** the "Git history" section SHALL be rendered in a collapsed state with a "No commits found" message visible when expanded

#### Scenario: Commits are found
- **GIVEN** `get_git_refs_for_issue` returns one or more `CommitRef` entries
- **WHEN** the user expands the "Git history" section
- **THEN** each commit SHALL be shown as a row with: abbreviated hash (monospace), subject line, and ISO date
- **AND** commits SHALL be displayed in the order returned by `git log` (most recent first)
- **AND** at most 50 commits SHALL be shown

### Requirement: Git history is fetched lazily

The system SHALL only call `get_git_refs_for_issue` when the user opens the "Activity" tab. It SHALL NOT be called on detail panel mount if a different tab is active.

#### Scenario: Activity tab opened for first time
- **WHEN** the user clicks the "Activity" tab
- **THEN** `get_git_refs_for_issue` SHALL be invoked for the current task and project
- **AND** a loading indicator SHALL be shown in the Git history section while the result is pending

#### Scenario: Activity tab revisited within stale time
- **GIVEN** `get_git_refs_for_issue` was already called for the current task within the last 60 seconds
- **WHEN** the user switches away and back to the "Activity" tab
- **THEN** the cached result SHALL be used without re-invoking the command

### Requirement: Branch badge in task header

The system SHALL render a branch badge in the task detail header when `GitRefs.branches` is non-empty.

#### Scenario: One matching branch
- **GIVEN** `get_git_refs_for_issue` returns exactly one branch name
- **THEN** a badge SHALL appear in the task detail header showing that branch name

#### Scenario: Multiple matching branches
- **GIVEN** `get_git_refs_for_issue` returns more than one branch name
- **THEN** the badge SHALL show the first branch name followed by `+N more` where N is the count of additional branches
- **AND** hovering the badge SHALL show all branch names in a tooltip

#### Scenario: No matching branches
- **GIVEN** `get_git_refs_for_issue` returns an empty `branches` array
- **THEN** no branch badge SHALL be rendered in the task detail header

### Requirement: Graceful fallback on subprocess error

If `get_git_refs_for_issue` returns an error (Git not installed, timeout, permission denied), the system SHALL silently return empty results. No error message SHALL be shown in the UI for Git subprocess failures.

#### Scenario: Git subprocess fails
- **GIVEN** `get_git_refs_for_issue` returns an error
- **THEN** the Git history section SHALL display as if no commits were found
- **AND** no error banner or toast SHALL be shown
