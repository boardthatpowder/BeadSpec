## Why

BeadSpec is dark-only today, hardcoded at `bg-neutral-950`. The `@theme` token block from `ui-design-foundation` maps every surface, border, text, and semantic color to a named CSS custom property. A light mode is now a ~30-line CSS override block and a theme toggle in Settings — no component rewrites required, provided hardcoded color classes are replaced with tokens first.

## What Changes

- Add a `[data-theme="light"]` block to `src/index.css` that overrides all `--color-*` tokens with light-appropriate values (light grays, dark text, adjusted semantic colors).
- Add `theme: 'system' | 'dark' | 'light'` to `AppSettings` in `src/contexts/SettingsContext.tsx` with default `'system'`.
- Apply `data-theme` attribute to `document.documentElement` reactively based on resolved theme (system follows `prefers-color-scheme`).
- Add a **Theme** picker row to the existing `AppearanceSection` in `src/components/settings/SettingsDialog.tsx` (three-button toggle: System / Light / Dark — same pattern as the existing Density picker).
- Audit all remaining hardcoded `bg-neutral-950`, `bg-black`, `bg-neutral-900`, `bg-neutral-800` class references that were not migrated through the token layer in Phase 3 — replace with `bg-[--color-bg]`, `bg-[--color-surface]`, `bg-[--color-surface-hi]` etc.
- Quick Capture window (`QuickCaptureApp.tsx`) reads the same `theme` setting and applies `data-theme` to its own root.
- Tauri `theme` in `tauri.conf.json` main window: set to `"default"` (follows OS) so native decorations respect the OS colour scheme.

## Capabilities

### New Capabilities

- `light-mode-theme`: The app supports three theme modes (system/dark/light). All `--color-*` token values resolve correctly in both dark and light themes. Theme persists across restarts via `AppSettings`.

### Modified Capabilities

- `app-settings`: The Appearance section gains a Theme toggle (system/light/dark). `AppSettings` gains a `theme` field.
- `quick-capture`: Quick Capture window respects the same theme setting.

## Impact

**Files modified**: `src/index.css`, `src/contexts/SettingsContext.tsx`, `src/components/settings/SettingsDialog.tsx`, `src/QuickCaptureApp.tsx`, `src-tauri/tauri.conf.json`.

**Files audited for hardcoded colors** (replace remaining non-tokenized classes): `src/components/layout/index.tsx`, `src/components/task-list/TaskList.tsx`, `src/components/task-detail/TaskDetailPanel.tsx`, `src/components/workspace/WorkspacePane.tsx`, `src/components/tray/TrayPopover.tsx`, plus any file still using `bg-neutral-950` / `bg-black` / `text-neutral-100` directly.

**Prerequisite**: `ui-design-foundation` complete (tokens defined) — ✅. `ui-primitive-migration` and `ui-dashboard-cohesion` recommended but not strictly required; hardcoded colors in unmigrated components will be caught by the audit task.
