## MODIFIED Requirements

### Requirement: Change card body is the entry point to the Epic Dashboard
A `ChangeCard`'s body SHALL be a click target that opens the Epic Dashboard pane for the change's imported Beads epic, when one exists. The card body's click handler SHALL be suppressed when no epic has been imported. Existing inner affordances on the card (artifact links, `imported → EPIC-ID` pill, status pill, dependency chips) SHALL continue to handle their own clicks without opening the dashboard.

#### Scenario: Body click opens the Epic Dashboard
- **WHEN** the user clicks the body of a `ChangeCard` outside any inner control, for a change whose `ChangeBeadsProgress.epic_id` is non-null
- **THEN** the workspace opens an `epic` tab in the active pane for that change

#### Scenario: Body click is inert without an imported epic
- **WHEN** the user clicks the body of a `ChangeCard` whose `ChangeBeadsProgress.epic_id` is null
- **THEN** no navigation occurs
- **AND** the card displays a tooltip on hover reading "Import to Beads to enable dashboard"

#### Scenario: Inner affordances stop propagation
- **WHEN** the user clicks any existing interactive control inside a `ChangeCard` (artifact link, imported-epic pill, status pill, dependency chip)
- **THEN** the inner control's existing behaviour runs
- **AND** no Epic Dashboard tab is opened
