## ADDED Requirements

### Requirement: App supports system, dark, and light theme modes
The app SHALL support three theme modes: `system` (follows OS preference), `dark` (always dark), and `light` (always light). The resolved theme SHALL be applied by setting `data-theme="dark"` or `data-theme="light"` on `document.documentElement`. When `system` is selected and the OS preference changes at runtime, the applied theme SHALL update without requiring a restart.

#### Scenario: System mode follows OS dark preference
- **WHEN** theme is set to `system` and the OS uses a dark colour scheme
- **THEN** `document.documentElement` has `data-theme="dark"` and the app renders in dark mode

#### Scenario: System mode follows OS light preference
- **WHEN** theme is set to `system` and the OS uses a light colour scheme
- **THEN** `document.documentElement` has `data-theme="light"` and the app renders in light mode

#### Scenario: System mode updates when OS preference changes at runtime
- **WHEN** theme is set to `system` and the user switches OS appearance while the app is open
- **THEN** the app theme updates immediately without a restart

#### Scenario: Light mode forces light theme regardless of OS
- **WHEN** theme is set to `light`
- **THEN** `document.documentElement` has `data-theme="light"` even if the OS is in dark mode

#### Scenario: Dark mode forces dark theme regardless of OS
- **WHEN** theme is set to `dark`
- **THEN** `document.documentElement` has `data-theme="dark"` even if the OS is in light mode

### Requirement: All color tokens resolve correctly in both themes
All `--color-*` CSS custom properties SHALL have correct values in both `data-theme="dark"` (the default from `@theme`) and `data-theme="light"` (the override from `[data-theme="light"]`). No UI surface SHALL show white-on-white or black-on-black contrast in either theme.

#### Scenario: Light mode surfaces use light token values
- **WHEN** `data-theme="light"` is set
- **THEN** `--color-bg` resolves to white or near-white, `--color-fg` resolves to near-black, and `--color-border` resolves to a light gray

#### Scenario: Dark mode surfaces use dark token values
- **WHEN** `data-theme="dark"` is set
- **THEN** `--color-bg` resolves to `neutral-950`, `--color-fg` resolves to `neutral-100`

### Requirement: Theme persists across restarts
The user's theme selection SHALL persist to `AppSettings` and be restored on next launch. The default value SHALL be `system`.

#### Scenario: Theme selection persists
- **WHEN** the user selects Light theme and restarts the app
- **THEN** the app opens in light mode

#### Scenario: Default theme is system
- **WHEN** no theme has been explicitly set (first launch)
- **THEN** the app follows the OS colour scheme

### Requirement: Quick Capture window respects theme
The Quick Capture window SHALL apply the same resolved theme as the main window by reading `theme` from `AppSettings` and applying `data-theme` to its own `document.documentElement`.

#### Scenario: Quick Capture renders in light mode when app is set to light
- **WHEN** the app theme is set to light and Quick Capture is opened
- **THEN** Quick Capture renders with the light token values

### Requirement: No hardcoded dark-only color classes remain
After the color audit, no component in `src/components/` SHALL use `bg-neutral-950`, `bg-neutral-900`, `bg-black`, or `text-neutral-100` directly as a background or primary text color. All such usages SHALL be replaced with the corresponding `--color-*` token via Tailwind arbitrary value syntax (`bg-[--color-bg]`, etc.).

#### Scenario: Color audit passes after migration
- **WHEN** running `grep -r "bg-neutral-950\|bg-black\|text-neutral-100" src/components/`
- **THEN** no matches are found (excepting intentional exceptions documented with a comment)
