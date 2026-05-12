# Git History Panel Specification

### Requirement: Commit references shown in task detail
The task detail activity area SHALL display a "Git history" section listing commits whose messages contain the issue id (e.g. `beads-42`). The data is fetched by running `git log --oneline --all --grep=<id>` in the project root via `get_git_refs_for_issue`. The section renders lazily when the activity tab is viewed, cached per task until a sync event fires.

#### Scenario: Commits referencing the issue id are found
- **WHEN** the user views the activity tab for a task whose id appears in one or more git commit messages
- **THEN** those commits are listed with short hash, subject, and author date

#### Scenario: No commits reference the issue id
- **WHEN** no git commits mention the issue id
- **THEN** the Git history section shows "No commits reference this issue"

#### Scenario: Project root is not a git repository
- **WHEN** `get_git_refs_for_issue` finds no `.git` directory in the project root
- **THEN** the Git history section is hidden entirely (not shown as empty)

### Requirement: Active branch indicator in task detail header
If a git branch whose name contains the issue id exists in the project, the task detail header SHALL display a small "Active branch" badge with the branch name.

#### Scenario: Branch named after issue exists
- **WHEN** `get_git_refs_for_issue` returns a branch match for the issue id
- **THEN** the task header shows a branch badge (e.g. `feat/beads-42-fix-login`) next to the title

#### Scenario: No matching branch
- **WHEN** no branch contains the issue id
- **THEN** no branch badge is shown

### Requirement: Dolt row-history diffs alongside activity feed
The activity tab SHALL display Dolt-level field diffs for the task (from `get_dolt_history_for_issue`) interleaved with the existing `task_history` activity entries. Each Dolt diff entry shows which fields changed between Dolt commits with before/after values.

#### Scenario: Dolt history entries interleaved
- **WHEN** the user views the activity tab for a task with multiple Dolt revisions
- **THEN** Dolt diff entries appear chronologically alongside beads history entries, distinguished by a "Dolt" source label

#### Scenario: Dolt history unavailable
- **WHEN** `get_dolt_history_for_issue` returns an error or empty result
- **THEN** the existing beads history entries are shown alone with no error message displayed for the Dolt entries
