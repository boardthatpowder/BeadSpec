## ADDED Requirements

### Requirement: Drag Tab to Another Pane

The system SHALL allow a tab to be dragged from one pane's tab bar and dropped onto another pane's tab bar, moving that tab to the target pane.

#### Scenario: User drops tab onto another pane's tab bar
- **WHEN** the user drags a tab and releases it over a different pane's tab bar (not over a specific tab slot)
- **THEN** the tab SHALL be appended to the end of the target pane's tab list
- **AND** the tab SHALL be removed from the source pane
- **AND** the tab SHALL become the active tab in the target pane
- **AND** the target pane SHALL become the active pane
- **AND** the new state SHALL persist across reloads

#### Scenario: User drops tab between existing tabs in another pane
- **WHEN** the user drags a tab and releases it between two tabs in a different pane's tab bar
- **THEN** the tab SHALL be inserted at that position in the target pane's tab list
- **AND** the tab SHALL be removed from the source pane
- **AND** the tab SHALL become the active tab in the target pane

#### Scenario: Tab is preview when dragged cross-pane
- **WHEN** the user drags a preview tab (unpinned) to another pane
- **THEN** the tab SHALL be promoted to pinned upon insertion in the target pane

#### Scenario: Source pane becomes empty after move
- **WHEN** the last tab is dragged out of a pane
- **THEN** the now-empty pane SHALL be collapsed from the split tree
- **AND** its sibling pane SHALL expand to fill the available space

#### Scenario: User cancels drag (no valid target)
- **WHEN** the user drags a tab and releases it outside any pane's tab bar or edge zone
- **THEN** the drag SHALL be cancelled
- **AND** the tab SHALL remain in its original pane at its original position

---

### Requirement: Drag Tab to Pane Edge to Create Split

The system SHALL allow a tab to be dragged to a pane's edge drop zone (left, right, top, or bottom), splitting that pane and placing the dragged tab in the new leaf.

#### Scenario: User drops tab on the right edge of a pane
- **WHEN** the user drags a tab and releases it on the right edge zone of a target pane
- **THEN** the target pane SHALL be split horizontally
- **AND** a new leaf pane SHALL be created to the right of the target pane
- **AND** the dragged tab SHALL move into the new leaf pane and become its active tab
- **AND** the new leaf pane SHALL become the active pane
- **AND** the split SHALL initialize at 50/50 sizes

#### Scenario: User drops tab on the left edge of a pane
- **WHEN** the user drags a tab and releases it on the left edge zone of a target pane
- **THEN** the target pane SHALL be split horizontally
- **AND** a new leaf pane SHALL be created to the left of the target pane
- **AND** the dragged tab SHALL move into the new leaf pane

#### Scenario: User drops tab on the bottom edge of a pane
- **WHEN** the user drags a tab and releases it on the bottom edge zone of a target pane
- **THEN** the target pane SHALL be split vertically
- **AND** a new leaf pane SHALL be created below the target pane
- **AND** the dragged tab SHALL move into the new leaf pane

#### Scenario: User drops tab on the top edge of a pane
- **WHEN** the user drags a tab and releases it on the top edge zone of a target pane
- **THEN** the target pane SHALL be split vertically
- **AND** a new leaf pane SHALL be created above the target pane
- **AND** the dragged tab SHALL move into the new leaf pane

#### Scenario: Tab dropped on own pane's edge
- **WHEN** the user drags a tab and releases it on an edge zone of the same pane it originated from
- **THEN** the behaviour SHALL be identical to dropping on a foreign pane's edge (a new split is created)
- **AND** if the tab was the only tab in the source pane, the source pane SHALL be the split target itself (no empty-pane collapse occurs first)

---

### Requirement: Edge Drop Zone Visibility

The system SHALL make edge drop zones visible only while a drag is active, providing clear feedback on where splits can be created.

#### Scenario: User begins dragging a tab
- **WHEN** the user starts dragging a tab
- **THEN** edge drop zones SHALL appear on all visible leaf panes (semi-transparent overlay strips on each of the four edges)
- **AND** the currently-hovered edge zone SHALL highlight distinctly from inactive zones

#### Scenario: User ends or cancels drag
- **WHEN** the drag ends (drop or cancel)
- **THEN** all edge drop zones SHALL disappear
