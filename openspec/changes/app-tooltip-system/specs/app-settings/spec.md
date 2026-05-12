## ADDED Requirements

### Requirement: Tooltip preferences in Settings
The Settings dialog SHALL include a Tooltips section allowing the user to enable or disable tooltips globally and to choose a hover delay. The `tooltips` preference block (`{ enabled: boolean, delayMs: number }`) SHALL be persisted in `settings.json` alongside other settings. Default values are `enabled: true` and `delayMs: 500`.

#### Scenario: Tooltip enable toggle turns off all tooltips
- **WHEN** the user disables tooltips in Settings
- **THEN** no tooltip popovers appear anywhere in the app on hover or focus, and the toggle state is persisted

#### Scenario: Re-enabling tooltips restores them
- **WHEN** the user re-enables tooltips in Settings
- **THEN** tooltips reappear on hover and focus across the app

#### Scenario: Delay preset updates tooltip responsiveness
- **WHEN** the user selects a delay of 0 ms in Settings
- **THEN** tooltips appear immediately on hover with no perceptible delay

#### Scenario: Delay preset of 1000 ms makes tooltips feel unhurried
- **WHEN** the user selects a delay of 1000 ms in Settings
- **THEN** tooltips only appear after the pointer has rested on a button for at least one second

#### Scenario: Tooltip preferences survive restart
- **WHEN** the user sets tooltip preferences and restarts the app
- **THEN** the `enabled` and `delayMs` values are restored from `settings.json`

#### Scenario: Missing tooltip key in settings.json falls back to defaults
- **WHEN** an existing `settings.json` has no `tooltips` key (pre-migration install)
- **THEN** the app uses `enabled: true` and `delayMs: 500` without error
