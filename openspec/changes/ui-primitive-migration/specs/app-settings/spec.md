## MODIFIED Requirements

### Requirement: Settings dialog accessible from TopBar
The app SHALL provide a Settings dialog accessible via a gear icon button in the TopBar. The dialog SHALL also be reachable as an action in the CommandPalette. The Settings dialog SHALL use the `<Dialog>` primitive from `src/components/ui/Dialog.tsx`, providing focus trapping, Esc-to-close, and `aria-modal` semantics automatically. The manual `useEffect` Escape key listener previously in `SettingsDialog.tsx` SHALL be removed.

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
