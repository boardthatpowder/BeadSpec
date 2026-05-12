## ADDED Requirements

### Requirement: Related Memories Section in Task Detail

The task detail panel SHALL render a collapsible "Related memories" section implemented by `RufloMemoryPanel.tsx`, positioned after the OpenSpec section in the details scroll area. The section SHALL be hidden entirely when ruflo is not available on PATH.

#### Scenario: Related memories section visible when ruflo available

- **GIVEN** ruflo is on PATH (AppState.ruflo_path is Some)
- **WHEN** the user opens any task in the detail panel
- **THEN** a collapsible "Related memories" section SHALL appear below the OpenSpec section
- **AND** the section SHALL be collapsed by default

#### Scenario: Related memories section absent when ruflo unavailable

- **GIVEN** ruflo is not on PATH (AppState.ruflo_path is None)
- **WHEN** the user opens any task in the detail panel
- **THEN** no "Related memories" section SHALL be rendered
- **AND** the layout SHALL be identical to the pre-change layout (no extra whitespace or dividers)

#### Scenario: Section ordering with OpenSpec panel

- **WHEN** both the OpenSpec panel section and the Related memories section are rendered
- **THEN** the OpenSpec section SHALL appear first (higher in the DOM and visually)
- **AND** the Related memories section SHALL appear second (below OpenSpec)
