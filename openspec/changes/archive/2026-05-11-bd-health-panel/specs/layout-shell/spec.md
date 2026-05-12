## ADDED Requirements

### Requirement: Health view reachable in two clicks or fewer
The layout shell SHALL include a navigation entry for the Health view such that a user can reach it from any other view in at most two clicks (e.g., a top-level nav item or a clearly labeled Tools menu).

#### Scenario: User navigates to Health from task list
- **WHEN** the user is on the task list view
- **THEN** clicking the Health nav entry SHALL navigate to the Health view in one click

#### Scenario: Health entry visible in navigation
- **WHEN** any view is active
- **THEN** the Health navigation entry SHALL be visible in the primary navigation without scrolling or expanding submenus
