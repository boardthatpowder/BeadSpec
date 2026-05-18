## MODIFIED Requirements

### Requirement: Paused issue indicator on TaskListItem
Each `TaskListItem` SHALL render a distinct "⏸ paused" violet pill in the status badge slot whenever the task's labels include `openspec:paused`. The status dot at the leading edge of the row SHALL remain driven by `task.status` and SHALL NOT be replaced. The pill text SHALL be `"⏸ paused"` and the pill's `title` attribute SHALL contain the most recent pause reason parsed from `task.notes` by `parsePausedNote`, or an empty string if no reason is present.

#### Scenario: Task carries `openspec:paused` label
- **WHEN** a task's `labels` array includes `openspec:paused`
- **THEN** the status badge slot renders the violet `"⏸ paused"` pill using the `STATUS_BADGE_PAUSED` constant
- **AND** the leading status dot remains coloured by `task.status`
- **AND** the pill's `title` attribute contains the parsed pause reason

#### Scenario: Task does not carry `openspec:paused` label
- **WHEN** a task's `labels` array does not include `openspec:paused`
- **THEN** the existing status badge for `task.status` is rendered unchanged

#### Scenario: Task is `closed` and carries `openspec:paused`
- **WHEN** a task has `status = 'closed'` and also has `openspec:paused` in its labels
- **THEN** the pause pill takes visual precedence over the closed badge
- **AND** the leading status dot still reflects `closed` so the status remains scannable

#### Scenario: Task has `openspec:paused` but notes contain no `Paused:` line
- **WHEN** a task carries `openspec:paused` and `parsePausedNote(task.notes)` returns `null`
- **THEN** the pill's `title` attribute is empty (no tooltip text shown)

---

### Requirement: Paused counter chip on KpiBar
The `KpiBar` SHALL render a `"⏸ N Paused"` chip after the Closed status chip, separated by a thin divider, showing the count of tasks in the current project view whose `labels` include `openspec:paused`. The chip participates in label-filter toggling — clicking it adds or removes `openspec:paused` from the active `labels` filter dimension.

#### Scenario: Project has at least one paused task
- **WHEN** one or more tasks in the current view carry `openspec:paused`
- **THEN** the KPI bar renders a `"⏸ N Paused"` chip after the Closed chip, where N is the exact count
- **AND** a thin divider separates the Paused chip from the Closed chip

#### Scenario: Project has no paused tasks and paused filter is inactive
- **WHEN** no tasks carry `openspec:paused` AND `state.filters.labels` does not include `openspec:paused`
- **THEN** the Paused chip is not rendered (no empty chip, no zero-count chip)

#### Scenario: Paused filter is active but count drops to zero
- **WHEN** `state.filters.labels` includes `openspec:paused` AND no tasks currently carry the label
- **THEN** the Paused chip remains visible (so the user can de-activate the filter)
- **AND** the chip shows count `0`

#### Scenario: User clicks the Paused chip (filter inactive)
- **WHEN** the Paused chip is visible and `openspec:paused` is not in `state.filters.labels`
- **THEN** `openspec:paused` is added to `state.filters.labels`
- **AND** the chip renders with the ring-active treatment (`ring-1 ring-violet-500`)
- **AND** the task list re-filters to show only tasks labelled `openspec:paused`

#### Scenario: User clicks the Paused chip (filter active)
- **WHEN** the Paused chip is visible and `openspec:paused` is already in `state.filters.labels`
- **THEN** `openspec:paused` is removed from `state.filters.labels`
- **AND** the chip's active ring is removed
- **AND** the task list reverts to unfiltered-by-pause state
