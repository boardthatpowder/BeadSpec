# Layout Shell — Delta Spec

_Status: delta to `openspec/specs/layout-shell/spec.md`_
_Change: openspec-change-browser_

## ADDED Requirements

### Requirement: Changes view as a top-level navigation entry

The app's navigation bar (rendered in `TopBar` via `ViewSwitcher`) SHALL include a "Changes" entry that is reachable in at most 2 clicks from any other top-level view.

#### Scenario: Changes entry visible in navigation bar

- **WHEN** the app is open with a project connected
- **THEN** the "Changes" button SHALL be visible in the top bar view switcher alongside the existing view options (list, focus, ready)

#### Scenario: User navigates to Changes from any other view

- **GIVEN** the user is on any existing view (list view, focus view, or ready view)
- **WHEN** the user clicks "Changes" in the navigation bar
- **THEN** the Changes view SHALL be displayed within 1 click
- **AND** no intermediate screen or confirmation SHALL be required

#### Scenario: Changes entry indicates active state

- **WHEN** the Changes view is the currently active view
- **THEN** the "Changes" button in the nav bar SHALL be visually indicated as active (e.g. highlighted background, accent color) consistent with how other active view buttons are styled

#### Scenario: Changes entry not shown when no project connected

- **WHEN** no project is connected
- **THEN** the "Changes" button SHALL still be visible in the nav bar
- **AND** clicking it SHALL show the Changes empty state ("Connect a project to see its OpenSpec changes") rather than an error
