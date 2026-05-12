## Why

Most action buttons in beads-ui are icon-only and carry no discoverability: ~8 sites rely on native `title=` attributes, ~70+ have neither tooltip nor `aria-label`, and there is no shared tooltip primitive in the codebase. Users must guess the purpose of icon buttons across the layout shell, FilterBar, task-detail strip, changes browser, workspace tabs, and smart views — and assistive technology users get no label at all.

## What Changes

- Add `@radix-ui/react-tooltip` as the first Radix UI dependency
- Introduce `src/components/ui/Tooltip.tsx` — styled Radix wrapper (Provider, Root, Trigger, Content) with theme-aware tokens matching the existing popover visual language
- Introduce `src/components/ui/IconButton.tsx` — button wrapper that requires a `label` prop (becomes both tooltip text and `aria-label`), with optional `shortcut` (keyboard hint rendered in a `<kbd>` element) and `description` (secondary help line)
- Migrate all ~75 icon-only and action buttons app-wide to `IconButton` or `<Tooltip>`-wrapped equivalents; remove all bare `title=` attributes on interactive elements
- Add `tooltips: { enabled: boolean; delayMs: number }` to `AppSettings` (defaults: `enabled: true`, `delayMs: 500`)
- Add a "Tooltips" section to the existing Settings dialog with an enable toggle and a delay preset selector (0 / 250 / 500 / 1000 ms)
- Mount `<TooltipProvider>` at the app root, wired to the user's delay preference; when `enabled` is false, tooltips are skipped entirely
- Migrate sites in order: layout shell → FilterBar → task-detail strip → changes browser → workspace tabs → smart views / quick-capture / notifications / command palette

**Non-goals:** No tooltip on the non-interactive "unsaved changes" status dot (`DescriptionEditor.tsx`). No layout or shortcut changes. No redesign of existing action surfaces.

## Capabilities

### New Capabilities
- `ui-tooltip-system`: Tooltip and IconButton primitives, TooltipProvider root mount, accessibility labeling contract, and migration of all existing action buttons

### Modified Capabilities
- `app-settings`: Adds `tooltips` preference block (`enabled`, `delayMs`) to the AppSettings schema and exposes it in the Settings dialog as a new Tooltips section

## Impact

**New dependency:** `@radix-ui/react-tooltip` (first Radix package in the project)

**New files:**
- `src/components/ui/Tooltip.tsx`
- `src/components/ui/IconButton.tsx`

**Modified files:**
- `src/stores/settingsStore.ts` — `AppSettings` type + `DEFAULT_SETTINGS`
- `src/components/settings/SettingsDialog.tsx` — new Tooltips section
- `src/App.tsx` or `src/components/layout/index.tsx` — `<TooltipProvider>` root mount
- ~75 component files across layout, filters, task-detail, changes-browser, workspace, smart-views, quick-capture, notifications, command palette

**No Tauri IPC changes** — tooltip state is purely client-side; settings persist via the existing `@tauri-apps/plugin-store` mechanism already used by `app-settings`.
