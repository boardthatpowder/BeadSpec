## ADDED Requirements

### Requirement: Tailwind v4 design token block
The app SHALL define a `@theme { … }` block in `src/index.css` establishing the following CSS custom properties usable as Tailwind utility classes: `--color-bg`, `--color-surface`, `--color-surface-hi`, `--color-surface-overlay`, `--color-border`, `--color-border-strong`, `--color-fg`, `--color-fg-muted`, `--color-fg-subtle`, `--color-accent`, `--color-accent-fg`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`. All token values SHALL reference existing Tailwind v4 palette variables (e.g., `var(--color-neutral-950)`) rather than hard-coded hex values.

#### Scenario: Token resolves to a CSS custom property
- **WHEN** Tailwind processes `bg-[--color-surface]` in a component
- **THEN** the compiled CSS contains the token value without any build error

#### Scenario: Token values reference palette, not hex
- **WHEN** inspecting the compiled CSS for `--color-bg`
- **THEN** the value is `var(--color-neutral-950)` or resolved from the Tailwind palette, not a literal hex string

### Requirement: Inter variable font loaded
The app SHALL install `@fontsource-variable/inter` and import it in `src/main.tsx` so that the Inter variable font is bundled with the app. The `@theme` block SHALL declare `--font-sans` as `'InterVariable', sans-serif`. The dead `src/App.css` scaffold file SHALL be deleted.

#### Scenario: Inter renders in the app
- **WHEN** the app loads in a browser or Tauri webview without Inter installed on the OS
- **THEN** text still renders in Inter (bundled font, not OS fallback)

#### Scenario: App.css is removed
- **WHEN** searching `src/` for `import.*App.css`
- **THEN** no active import is found

### Requirement: Centralised palette library
The app SHALL provide `src/lib/palettes.ts` exporting `STATUS_PALETTE`, `PRIORITY_PALETTE`, `RISK_PALETTE`, and `OUTCOME_PALETTE`. Each palette SHALL be a `Record<string, { bg: string; text: string; border: string }>` where values are Tailwind utility class strings. These SHALL replace all inline status/priority/risk color maps in individual components.

#### Scenario: STATUS_PALETTE covers all known status values
- **WHEN** `STATUS_PALETTE` is imported and accessed with `"open"`, `"in_progress"`, `"done"`, `"blocked"`, `"paused"`
- **THEN** each key returns an object with non-empty `bg`, `text`, and `border` strings

#### Scenario: PRIORITY_PALETTE covers all known priority values
- **WHEN** `PRIORITY_PALETTE` is imported and accessed with `"critical"`, `"high"`, `"medium"`, `"low"`
- **THEN** each key returns an object with non-empty `bg`, `text`, and `border` strings

#### Scenario: RISK_PALETTE covers known risk levels
- **WHEN** `RISK_PALETTE` is imported and accessed with `"critical"`, `"high"`, `"medium"`, `"low"`, `"none"`
- **THEN** each key returns a valid palette object

### Requirement: Centralised date formatting helpers
The app SHALL provide `src/lib/format/date.ts` exporting `formatRelative(ts: Date | string | number): string` and `formatAbsolute(ts: Date | string | number, opts?: { includeTime?: boolean }): string`. `formatRelative` SHALL return a human-readable relative string (e.g., "2 hours ago"). `formatAbsolute` SHALL return a locale-aware formatted date string. Both SHALL accept `Date`, ISO string, or Unix timestamp (ms) inputs.

#### Scenario: formatRelative returns relative string
- **WHEN** `formatRelative(Date.now() - 7200000)` is called (2 hours ago)
- **THEN** the return value is approximately `"2 hours ago"` (locale-dependent wording)

#### Scenario: formatAbsolute returns formatted date
- **WHEN** `formatAbsolute(new Date('2025-01-15'))` is called
- **THEN** the return value is a human-readable date string (e.g., `"Jan 15, 2025"`)

#### Scenario: formatAbsolute includes time when requested
- **WHEN** `formatAbsolute(ts, { includeTime: true })` is called
- **THEN** the return value includes both date and time components

#### Scenario: Both helpers accept ISO string input
- **WHEN** an ISO string like `"2025-01-15T12:00:00.000Z"` is passed to either helper
- **THEN** no error is thrown and a valid formatted string is returned
