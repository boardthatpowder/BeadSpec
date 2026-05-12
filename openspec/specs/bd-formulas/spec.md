# BD Formulas Specification

### Requirement: Formulas browser lists available workflows
The app SHALL provide a Formulas view (accessible from the navigation or within the Health view area) that runs `bd formula list --json` and displays each formula as a card with its name, description, and a "Pour" action button.

#### Scenario: Formulas loaded and displayed
- **WHEN** the user opens the Formulas view
- **THEN** the app runs `bd formula list --json` and renders one card per formula with name and description

#### Scenario: No formulas available
- **WHEN** `bd formula list` returns an empty list
- **THEN** the view shows "No formulas configured for this project"

### Requirement: Pour formula with confirmation
Clicking the "Pour" button on a formula card SHALL prompt the user to confirm before running `bd mol pour <name>`. On confirmation the command SHALL execute and its output SHALL stream into a result panel. The action is irreversible (creates new issues), so the confirmation step is mandatory.

#### Scenario: User pours a formula after confirming
- **WHEN** the user clicks "Pour" on a formula card and confirms in the dialog
- **THEN** `bd mol pour <name>` runs in the project root and the output streams into a result panel within the view

#### Scenario: User cancels pour
- **WHEN** the user clicks "Pour" but dismisses the confirmation dialog
- **THEN** no command is run and the view returns to the formula card list

#### Scenario: Pour output references created issue ids
- **WHEN** the pour command completes and the output contains issue ids (e.g. `beads-42`)
- **THEN** each id in the output is rendered as a clickable chip that navigates to that task
