## ADDED Requirements

### Requirement: Git history section appears in activity tab

The system SHALL render a collapsible "Git history" section in the activity tab of the task detail panel for projects with a `.git` directory. The section SHALL appear after the existing beads history entries.

#### Scenario: User opens activity tab with git history
- **WHEN** the user opens the "Activity" tab for a task in a git-tracked project
- **THEN** the activity tab SHALL show beads history entries followed by a collapsible "Git history" section
- **AND** the "Git history" section header SHALL indicate how many commits were found (e.g., "Git history (3)")

#### Scenario: Section order
- **WHEN** the activity tab renders
- **THEN** the section order SHALL be: beads history entries first, then "Git history" section last

---

### Requirement: Branch badge in task detail header

The system SHALL render a branch badge in the task detail panel header when a Git branch name containing the current task ID is found.

#### Scenario: Branch badge visible
- **GIVEN** `get_git_refs_for_issue` returns a non-empty `branches` array
- **WHEN** the task detail panel header is rendered (regardless of active tab)
- **THEN** a branch badge SHALL be visible in the header showing the branch name
- **AND** the badge SHALL be styled distinctly from label chips (e.g., a muted git-branch icon prefix)

#### Scenario: Branch badge absent for non-git projects
- **GIVEN** the project root has no `.git` directory
- **THEN** no branch badge SHALL appear in the task detail header
