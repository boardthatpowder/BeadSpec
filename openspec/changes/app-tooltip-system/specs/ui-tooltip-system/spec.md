## ADDED Requirements

### Requirement: Tooltip primitive available app-wide
The app SHALL provide a `Tooltip` component backed by `@radix-ui/react-tooltip` that renders styled contextual help on hover and keyboard focus. A single `AppTooltipProvider` SHALL be mounted at the app root inside `SettingsProvider`, supplying the global delay and enabled state to all tooltips.

#### Scenario: Tooltip appears on hover after delay
- **WHEN** the user hovers over a button wrapped in `<Tooltip>`
- **THEN** a tooltip popover appears after the configured delay (default 500 ms) showing the label text

#### Scenario: Tooltip appears on keyboard focus
- **WHEN** the user navigates to a `<Tooltip>`-wrapped button via the Tab key
- **THEN** the tooltip appears immediately (no delay) while the button has focus

#### Scenario: Tooltip dismisses on Escape
- **WHEN** a tooltip is visible and the user presses Escape
- **THEN** the tooltip is dismissed and focus remains on the trigger element

#### Scenario: Tooltip dismisses when pointer leaves
- **WHEN** the user moves the pointer away from the trigger
- **THEN** the tooltip disappears

#### Scenario: Tooltip does not appear when tooltips are disabled
- **WHEN** `settings.tooltips.enabled` is `false`
- **THEN** no tooltip popover renders anywhere in the app, but trigger elements remain fully interactive

#### Scenario: Tooltip flips to avoid viewport overflow
- **WHEN** a tooltip trigger is near the edge of the window and the default placement would clip
- **THEN** the tooltip repositions (flips side or shifts) to remain fully visible

### Requirement: Tooltip content supports label, shortcut hint, and description
The `Tooltip` component SHALL render up to three content regions: a primary label (always shown), an optional keyboard shortcut hint displayed in a `<kbd>` element, and an optional secondary description line in muted smaller text.

#### Scenario: Label-only tooltip
- **WHEN** a tooltip is configured with only a `label` prop
- **THEN** the tooltip shows only the label text with no other content

#### Scenario: Tooltip with shortcut hint
- **WHEN** a tooltip is configured with `label="Refresh"` and `shortcut="⌘R"`
- **THEN** the tooltip shows "Refresh" on the left and a `<kbd>⌘R</kbd>` badge on the right of the same line

#### Scenario: Tooltip with description
- **WHEN** a tooltip is configured with a `description` prop
- **THEN** the description appears on a second line below the label in muted, smaller text

### Requirement: IconButton wrapper enforces accessible labeling
The app SHALL provide an `IconButton` component that wraps a `<button>` inside a `<Tooltip>`. The `label` prop is required and SHALL be used as both the tooltip text and the button's `aria-label`. All standard `HTMLButtonElement` props (including `onClick`, `disabled`, `className`) SHALL be forwarded to the underlying `<button>`.

#### Scenario: IconButton renders accessible button
- **WHEN** `<IconButton label="Delete task">` is rendered
- **THEN** the DOM button element has `aria-label="Delete task"` and hovering shows a tooltip with text "Delete task"

#### Scenario: Disabled IconButton suppresses tooltip
- **WHEN** an `IconButton` has `disabled={true}`
- **THEN** the button is non-interactive and no tooltip appears on hover or focus

#### Scenario: IconButton with shortcut shows shortcut in tooltip
- **WHEN** `<IconButton label="Refresh" shortcut="⌘R">` is rendered and hovered
- **THEN** the tooltip shows "Refresh" with a `⌘R` kbd hint

#### Scenario: TypeScript enforces required label
- **WHEN** a developer renders `<IconButton>` without a `label` prop
- **THEN** the TypeScript compiler reports a type error

### Requirement: All icon-only action buttons carry accessible labels and tooltips
Every icon-only interactive button throughout the app SHALL be rendered as an `<IconButton>` or equivalent tooltip-wrapped element. No icon-only button SHALL rely on a bare native `title=` attribute as its sole discoverability mechanism.

#### Scenario: Layout shell buttons have tooltips
- **WHEN** the user hovers over the Refresh, Settings, or view-switcher buttons in the TopBar
- **THEN** a tooltip appears identifying each button by name (and shortcut where applicable)

#### Scenario: FilterBar icon buttons have tooltips
- **WHEN** the user hovers over any icon button in the FilterBar (group toggle, dimension chip removers, menu openers)
- **THEN** a tooltip appears with a concise label describing the action

#### Scenario: Task detail strip buttons have tooltips
- **WHEN** the user hovers over any icon button in the task-detail metadata strip or panel toolbar
- **THEN** a tooltip appears identifying the action (e.g. "Flag for human decision", "Open in new tab", "Go back")

#### Scenario: Changes browser buttons have tooltips
- **WHEN** the user hovers over action icons in ChangeCard, ChangesBrowser, or ImportModal
- **THEN** a tooltip appears for each icon button

#### Scenario: No bare title attributes remain on interactive elements
- **WHEN** a developer inspects any `<button>` or `<a>` in the rendered DOM
- **THEN** no element has a `title` attribute as its only accessible name; `aria-label` is present on all icon-only buttons
