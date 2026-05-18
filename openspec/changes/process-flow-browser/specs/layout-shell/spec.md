## MODIFIED Requirements

### Requirement: Processes view entry in top navigation
The top navigation bar SHALL include a **Processes** entry that renders the `process-flow-browser` view. The entry SHALL be visible whenever a project is connected. It SHALL NOT be gated on the OpenSpec feature flag — GitNexus is an independent capability. The Processes entry SHALL be positioned between the `Health` and `OpenSpec` entries in the nav bar ordering.

#### Scenario: Processes nav entry visible with project connected
- **WHEN** a project is connected and the user is on any view
- **THEN** the `Processes` entry is visible and enabled in the top navigation bar

#### Scenario: Processes nav entry hidden or disabled without project
- **WHEN** no project is connected
- **THEN** the `Processes` nav entry is either hidden or rendered in a disabled state
- **AND** clicking it has no effect

#### Scenario: Processes view replaces list-pane content when active
- **WHEN** the user clicks the `Processes` nav entry
- **THEN** the main content area renders `ProcessBrowser` in place of the default list view
- **AND** the nav entry is highlighted as the active route

#### Scenario: Hash with view=processes restores the Processes view on launch
- **WHEN** the app is launched with hash `#view=processes` (with or without a `processId`)
- **THEN** the Processes view is rendered as the active view on startup
- **AND** the `Processes` nav entry is highlighted
