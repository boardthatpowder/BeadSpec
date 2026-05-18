## MODIFIED Requirements

### Requirement: openspec validate status
The OpenSpec panel SHALL show the last-known `openspec validate` result for the change with
a timestamp. A "Re-validate" button SHALL trigger `run_openspec_validate` and update the
result in place. The validate call is on-demand only, not automatic. Each invocation of
`run_openspec_validate` initiated from the OpenSpec panel SHALL additionally be persisted as a
Ruflo memory history entry via `record_openspec_validation`, including both successful and
failing outcomes. A recording failure SHALL NOT block, alter, or surface an error in the
in-place validate-result display.

#### Scenario: Validate result shown
- **WHEN** the user clicks "Re-validate" in the OpenSpec panel
- **THEN** the app runs `openspec validate --change <name> --json`, displays "Valid" or a
  list of errors, and records the timestamp
- **AND** the app persists the result via `record_openspec_validation(project_path,
  change_slug, result_json)` before clearing the loading state

#### Scenario: Validate result cached across navigation
- **WHEN** the user navigates away from the task and back
- **THEN** the last validate result and timestamp are shown without re-running the command

#### Scenario: Recording the result fails because ruflo is unavailable
- **WHEN** the user clicks "Re-validate" and `record_openspec_validation` rejects (e.g. the
  `ruflo` CLI is not on PATH)
- **THEN** the in-place validate result still renders normally
- **AND** no error toast or banner is shown for the recording failure
- **AND** the failure is logged to the developer console

## ADDED Requirements

### Requirement: Validation history sub-section
The OpenSpec panel SHALL render a collapsible "Validation history" sub-section directly
below the validate section. The sub-section SHALL list up to the most recent 5 persisted
`record_openspec_validation` entries for the current change, sorted newest-first. Each row
SHALL display a short timestamp, a pass/fail badge, and a one-line summary (`Valid` for
passes; the first error line for failures). Clicking a row SHALL expand it inline to show the
full error list for failures. The sub-section SHALL be gated behind `ruflo_version_probe`:
when the probe rejects, no history queries SHALL be issued and a short muted message SHALL be
shown in place of the list.

#### Scenario: History populated with recent validations
- **WHEN** the user opens a change's OpenSpec panel and the change has 3 prior recorded
  validations
- **THEN** the "Validation history" sub-section lists those 3 entries, newest-first
- **AND** each row shows a timestamp, a pass-or-fail badge, and a one-line summary

#### Scenario: User expands a failing history row
- **WHEN** the user clicks a history row whose entry has `valid: false`
- **THEN** the row expands inline to show the full list of errors recorded with that entry,
  identical in styling to the inline validate-result error list

#### Scenario: History is empty
- **WHEN** the user opens a change's OpenSpec panel and no prior validations have been
  recorded for the current change in the current branch / worktree / repo
- **THEN** the sub-section renders a single muted line stating no validations have been
  recorded yet
- **AND** no row, badge, or footer is rendered

#### Scenario: More than 5 entries — only 5 shown with footer
- **WHEN** the persisted history for the change has more than 5 entries
- **THEN** by default exactly the 5 most-recent entries are listed
- **AND** a footer shows the total count with a "Show all" affordance that expands the list
  inline (up to a backend cap of 50 entries, no separate route or modal)

#### Scenario: Ruflo CLI is unavailable
- **WHEN** `ruflo_version_probe` rejects (e.g. binary missing or permissions error)
- **THEN** the sub-section renders a single muted line indicating that history requires the
  `ruflo` CLI
- **AND** no `list_openspec_validations` IPC call SHALL be issued
- **AND** no `record_openspec_validation` IPC call SHALL be issued from the validate button

#### Scenario: History is scoped to the current branch / worktree / repo
- **WHEN** the user records a validation on branch `feat/x` in worktree `wA` of repo `R`,
  then switches to worktree `wB` of the same repo and opens the same change
- **THEN** the history list in worktree `wB` SHALL NOT include the entry recorded under
  worktree `wA`
