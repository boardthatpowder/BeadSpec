## MODIFIED Requirements

### Requirement: Detail Panel is Controlled by Workspace Tab

The system SHALL render `TaskDetailPanel` with a fixed set of inner sub-tabs: `details`, `dependencies`, `activity`, and `impact`. Each `TaskDetailPanel` SHALL remember its active inner sub-tab keyed by `${paneId}:${taskId}` in `useWorkspaceStore.innerSubTab`. The valid `TabId` union is `"details" | "dependencies" | "activity" | "impact"`.

#### Scenario: Impact tab is present in every task's tab row

- **WHEN** the user opens any task in `TaskDetailPanel`
- **THEN** the tab row SHALL render the four tabs `Details`, `Dependencies`, `Activity`, and `Impact` in that order
- **AND** the `Impact` tab SHALL be present regardless of the task's labels or status

#### Scenario: Impact tab selection persists across task switches

- **GIVEN** the user has Task A and Task B open in the same pane
- **AND** Task A's inner sub-tab is set to `Impact`
- **AND** Task B's inner sub-tab is set to `Activity`
- **WHEN** the user switches between Task A and Task B
- **THEN** Task A SHALL restore the `Impact` tab and Task B SHALL restore the `Activity` tab
- **AND** both states SHALL be keyed independently by `${paneId}:${taskId}`

#### Scenario: Impact tab selection persists across workspace tab switch

- **GIVEN** the active task detail is on the `Impact` tab
- **WHEN** the user switches to a different workspace tab and switches back
- **THEN** the `Impact` tab SHALL remain selected
- **AND** the `ImpactPanel` SHALL render its initial empty state (no cached result from the previous mount)
