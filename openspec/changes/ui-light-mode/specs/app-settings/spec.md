## MODIFIED Requirements

### Requirement: Settings dialog accessible from TopBar
The app SHALL provide a Settings dialog accessible via a gear icon button in the TopBar. The dialog SHALL also be reachable as an action in the CommandPalette. The Settings dialog SHALL use the `<Dialog>` primitive from `src/components/ui/Dialog.tsx`, providing focus trapping, Esc-to-close, and `aria-modal` semantics automatically.

#### Scenario: Gear button opens Settings
- **WHEN** the user clicks the gear icon in the TopBar
- **THEN** the Settings dialog opens as a modal overlay

#### Scenario: CommandPalette opens Settings
- **WHEN** the user selects "Open Settings" from the CommandPalette
- **THEN** the Settings dialog opens as a modal overlay

#### Scenario: Escape closes Settings
- **WHEN** the Settings dialog is open and the user presses Escape
- **THEN** the dialog closes without saving uncommitted changes

#### Scenario: Settings always accessible regardless of feature flags
- **WHEN** OpenSpec or Ruflo are disabled
- **THEN** the gear icon remains visible and Settings is still openable

#### Scenario: Focus is trapped inside Settings dialog
- **WHEN** the Settings dialog is open
- **THEN** pressing Tab cycles focus only among interactive elements inside the dialog

#### Scenario: Backdrop click closes Settings
- **WHEN** the Settings dialog is open and the user clicks outside the dialog panel
- **THEN** the dialog closes

### Requirement: Appearance section includes theme toggle
The Appearance section of Settings SHALL include a three-option Theme toggle with options System, Light, and Dark. The toggle SHALL use the same visual style as the existing Density picker (three equal-width buttons in a row). Selecting a theme SHALL apply it immediately without requiring the dialog to be closed.

#### Scenario: Theme toggle shows three options
- **WHEN** the user opens Settings and navigates to Appearance
- **THEN** a Theme row is visible with System, Light, and Dark buttons

#### Scenario: Active theme button is highlighted
- **WHEN** the current theme is Light
- **THEN** the Light button is highlighted (accent background) and the others are not

#### Scenario: Selecting theme applies immediately
- **WHEN** the user clicks the Light button in the Theme picker
- **THEN** the app switches to light mode immediately while Settings is still open
