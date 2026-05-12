# Task List Specification — Delta (configurable-list-groupings)

## Purpose

This is a **delta spec** that extends `openspec/specs/task-list/spec.md` with requirements added by the `configurable-list-groupings` change. It covers: grouped rendering in the virtual list via a mixed-item-type architecture, workspace scope applied at mount without a flash, and bulk selection across group boundaries.

---

## ADDED Requirements

### Requirement: Mixed-Item-Type Virtual List

The system SHALL extend the TanStack Virtual list to support two item types: GroupHeader and TaskRow rendered in a single continuous virtual scroll container.

#### Scenario: Virtual list renders section headers inline
- **GIVEN** grouping by status is active
- **WHEN** the virtual list renders
- **THEN** each status section SHALL be preceded by a GroupHeader row in the virtual item array
- **AND** GroupHeader items SHALL use an estimated height of 36px
- **AND** TaskRow items SHALL use the existing estimated height of 54px

#### Scenario: Collapsed section removes task rows from virtual items
- **GIVEN** the "Closed" section is collapsed
- **WHEN** the virtual item array is built
- **THEN** task rows for the "Closed" section SHALL NOT appear in the virtual item array
- **AND** the virtual list total height SHALL decrease accordingly
- **AND** the GroupHeader for "Closed" SHALL remain in the virtual item array

#### Scenario: Flat list renders no section headers
- **GIVEN** no grouping is active (groupBy is null)
- **WHEN** the task list renders
- **THEN** NO GroupHeader items SHALL appear in the virtual item array
- **AND** the rendering SHALL be identical to the pre-grouping flat list behavior

#### Scenario: Virtual list correctly positions items after a collapsed section
- **GIVEN** the "Open" section is collapsed and the "In Progress" section follows
- **WHEN** the virtual list calculates scroll offsets
- **THEN** the "In Progress" section header SHALL be positioned immediately after the "Open" GroupHeader row
- **AND** the scroll position accounting SHALL be accurate with no gaps or overlaps

---

### Requirement: Sort Behavior Within Grouped Sections

The system SHALL maintain existing sort controls when grouping is active and apply sort independently within each section.

#### Scenario: Sort applies within each section independently
- **GIVEN** the list is grouped by status and sorted by priority ascending
- **WHEN** the "Open" section renders
- **THEN** tasks within "Open" SHALL be sorted by priority ascending
- **AND** tasks in "In Progress" SHALL also be sorted by priority ascending independently

#### Scenario: Sorting does not move tasks between sections
- **WHEN** the user sorts by priority descending while grouped by status
- **THEN** tasks SHALL NOT move between sections
- **AND** each section SHALL independently re-sort by the chosen field

---

### Requirement: No Workspace-Scope Flash on Mount

The system SHALL apply persisted groupBy at mount time without causing a visible transition from flat to grouped.

#### Scenario: Project load with persisted groupBy in layout store
- **GIVEN** a `groupBy` value is stored in `layout.json` and no `groupBy` is present in the URL hash
- **WHEN** the project is loaded
- **THEN** the task list SHALL render in grouped mode from the first render
- **AND** there SHALL be no visible transition from flat to grouped

#### Scenario: URL hash groupBy takes precedence over layout store
- **GIVEN** `layout.json` contains `groupBy: "field:status"` and the URL hash contains `groupBy: "label:openspec"`
- **WHEN** the app loads
- **THEN** the active grouping SHALL be `label:openspec` (URL hash wins)
- **AND** the layout store SHALL not overwrite the hash value

---

### Requirement: Bulk Selection Across Group Boundaries

The system SHALL support shift-click range selection that spans across group section headers.

#### Scenario: Shift-click range spans two sections
- **GIVEN** grouping is active and the user clicks task A in section "Open" (flatIndex 2)
- **WHEN** the user shift-clicks task B in section "In Progress" (flatIndex 7)
- **THEN** all tasks with flatIndex 2 through 7 SHALL be selected
- **AND** the selection SHALL span the group boundary without error
- **AND** the GroupHeader row between the two sections SHALL NOT be included in the selection

#### Scenario: Shift-click cannot select tasks in collapsed sections
- **GIVEN** the "Blocked" section is collapsed and sits between task A and task B
- **WHEN** the user shift-clicks to select from task A to task B
- **THEN** collapsed tasks SHALL NOT be included in the selection
- **AND** the selection range SHALL only include visible expanded task rows

#### Scenario: Section collapse does not break existing selection
- **GIVEN** 5 tasks in the "In Progress" section are selected
- **WHEN** the user collapses the "In Progress" section
- **THEN** the selected task IDs SHALL remain in the selection state
- **AND** the bulk action toolbar SHALL continue to show the correct count
- **AND** re-expanding the section SHALL show the tasks as still selected

#### Scenario: Bulk selection count deduplicates task IDs
- **GIVEN** label-prefix grouping is active and a task appears in two sections
- **WHEN** that task is shift-click selected from one section
- **THEN** the bulk selection SHALL contain the task's ID exactly once
- **AND** the count badge on the bulk toolbar SHALL count unique task IDs

---

### Requirement: Keyboard Navigation Across Groups

The system SHALL maintain keyboard navigation across group section headers.

#### Scenario: Arrow down key skips group headers
- **GIVEN** grouping is active and the keyboard cursor is on the last task in section "Open"
- **WHEN** the user presses the down arrow key
- **THEN** the cursor SHALL move to the first task in the next section
- **AND** the group header row SHALL be skipped and not focusable by navigation

#### Scenario: j/k navigation works in grouped mode
- **WHEN** the user presses j to move forward
- **THEN** the focused item SHALL advance to the next TaskRow skipping GroupHeader rows
- **AND** the virtual list SHALL scroll to keep the focused item visible
