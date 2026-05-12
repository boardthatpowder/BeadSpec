## MODIFIED Requirements

### Requirement: Drag to Reorder Tabs Within a Pane

The system SHALL allow tabs within a single pane to be reordered by drag and drop, with keyboard accessibility for the reorder gesture. Dropping a tab outside the source pane onto a valid target (another pane's tab bar or an edge zone) SHALL execute a cross-pane move or split as defined in the `cross-split-tab-drag` capability; dropping onto no valid target SHALL cancel.

#### Scenario: User drags a tab to a new position
- **WHEN** the user drags a tab to the left or right within the same pane
- **THEN** the tab SHALL be reinserted at the drop position
- **AND** the new order SHALL persist across reloads
- **AND** if the dragged tab was a preview tab, it SHALL be promoted to pinned

#### Scenario: User drops tab on another pane or edge zone
- **WHEN** the user drags a tab and releases it over a different pane's tab bar or over an edge drop zone
- **THEN** the drop SHALL execute the corresponding cross-pane move or edge-split action
- **AND** the tab SHALL NOT remain in the source pane

#### Scenario: User drags a tab to an invalid target
- **WHEN** the user drags a tab and releases it outside any pane's tab bar and outside all edge zones
- **THEN** the drop SHALL be cancelled
- **AND** the dragged tab SHALL remain at its original position in the source pane
