## MODIFIED Requirements

### Requirement: Workspace tab kinds include `epic`
The workspace pane tree SHALL recognise a third tab kind `epic` alongside `task` and `doc`. An `epic` tab SHALL be identified by `EpicTab { kind: 'epic'; id: string; change: string; epicId: string }` with `id === epicTabId(change)`. The leaf-pane renderer SHALL dispatch on `tab.kind === 'epic'` and render the Epic Dashboard for the referenced change and epic. Pane operations — split, drag, pin, close, persistence — SHALL treat `epic` tabs identically to `task` and `doc` tabs.

#### Scenario: Open epic tab via store action
- **WHEN** `openEpicTab(change, epicId)` is called on the workspace store
- **THEN** if no tab with `id === epicTabId(change)` exists, an `epic` tab is appended to the active pane, pinned, and made active
- **AND** if such a tab already exists in any pane, that pane is focused and that tab is activated (mirroring `openDocTab`)

#### Scenario: Leaf pane renders the dashboard for an epic tab
- **WHEN** the active tab in a leaf pane has `kind === 'epic'`
- **THEN** the leaf-pane content renders `<EpicDashboard change={tab.change} epicId={tab.epicId} />`

#### Scenario: Persistence round-trips epic tabs
- **WHEN** the workspace state is persisted and then rehydrated
- **THEN** any `epic` tabs present at persist time are restored with their `change` and `epicId` fields intact
- **AND** unknown tab kinds are dropped without throwing

#### Scenario: Pane operations treat epic tabs uniformly
- **WHEN** the user splits, drags, pins, or closes an `epic` tab
- **THEN** the pane-tree helpers (`findLeaf`, `replaceLeaf`, `nextTabAfterClose`, `collapseEmptyParents`) operate on the tab using the same code paths as `task` and `doc` tabs
