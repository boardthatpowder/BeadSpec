## ADDED Requirements

### Requirement: All interactive elements have visible focus rings
Every interactive element (button, link, tab trigger, input, select) SHALL show a visible focus indicator when focused via keyboard (`Tab` key). The indicator SHALL use `focus-visible:ring-2` styling referencing the `--color-accent` token. No element SHALL show the browser's default blue outline (suppressed via `*:focus-visible { outline: none }` in `src/index.css`). Mouse focus SHALL NOT show the ring (only keyboard focus).

#### Scenario: Button shows focus ring on keyboard focus
- **WHEN** the user focuses a `<Button>` using the Tab key
- **THEN** a visible ring using `--color-accent` color appears around the button

#### Scenario: Tab trigger shows focus ring
- **WHEN** the user focuses a `<Tabs.Trigger>` using the Tab key
- **THEN** a visible ring appears around the tab trigger

#### Scenario: Mouse click does not show focus ring
- **WHEN** the user clicks a button with the mouse
- **THEN** no focus ring appears (focus-visible behavior, not focus behavior)

### Requirement: All icon-only controls have accessible names
Every control that renders only an icon (no visible text label) SHALL have an accessible name provided via `aria-label` attribute or the `<IconButton>` tooltip prop. No icon-only control SHALL rely solely on a visual icon for identification.

#### Scenario: TaskList sort header has aria-label
- **WHEN** a screen reader focuses the sort chevron in the TaskList header
- **THEN** it announces a descriptive label (e.g., "Sort ascending")

#### Scenario: ChangesBrowser archived chevron has aria-label
- **WHEN** a screen reader focuses the archived-section expand/collapse chevron
- **THEN** it announces "Show archived changes" or "Hide archived changes"

#### Scenario: ProcessBrowser cluster filter has aria-label
- **WHEN** a screen reader focuses the cluster filter control
- **THEN** it announces a descriptive label

### Requirement: Form inputs have associated labels
Every form input (text, search, select, textarea) in the app SHALL have an associated `<label>` element. The label MAY be visually hidden (using Tailwind `sr-only`) at compact density but SHALL always be present in the accessibility tree.

#### Scenario: MemoryBrowser key input has label
- **WHEN** a screen reader focuses the "key" input in the MemoryBrowser store dialog
- **THEN** it announces "Key" as the input label

#### Scenario: ProcessBrowser search has label
- **WHEN** a screen reader focuses the search input in ProcessBrowser
- **THEN** it announces "Search processes" as the label

#### Scenario: ReviewsHealthTab search has label
- **WHEN** a screen reader focuses the search input in the Reviews tab
- **THEN** it announces "Search reviews" as the label

### Requirement: State indicators have redundant non-color cues
Every visual state indicator that uses color to communicate meaning SHALL also provide a non-color cue (icon, text label, or aria attribute). Color alone SHALL NOT be the only means of conveying status, risk, or outcome.

#### Scenario: StatusDropdown chips show status icon
- **WHEN** a status chip renders in the StatusDropdown
- **THEN** a small icon appears alongside the color/text label providing a redundant visual cue

#### Scenario: OpenSpecPanel validate result has aria-label
- **WHEN** the OpenSpec validation result glyph (✓ or ✗) renders
- **THEN** it has `aria-label="passed"` or `aria-label="failed"` respectively

#### Scenario: ImpactPanel risk chips have aria-label
- **WHEN** a risk level chip renders in the ImpactPanel
- **THEN** it has `aria-label` including the risk level text (e.g., "risk: high")

#### Scenario: BdHumanQueue dot has aria-live and numeric label
- **WHEN** the BdHumanQueue pulsing dot is visible
- **THEN** the container has `aria-live="polite"` and `aria-label` with the numeric queue count

### Requirement: Project uses jsx-a11y lint rules
The project SHALL have `eslint-plugin-jsx-a11y` installed and configured at warn level so future accessibility regressions are caught in CI.

#### Scenario: jsx-a11y warns on icon-only button without aria-label
- **WHEN** a new `<button>` with only icon content and no `aria-label` is added
- **THEN** `bun run lint` outputs a jsx-a11y warning for that file
