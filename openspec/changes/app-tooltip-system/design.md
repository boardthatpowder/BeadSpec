## Context

Beads-UI currently has no tooltip primitive. Icon-only buttons — ~75 of them across the app — rely on scattered native `title=` attributes (8 sites) or have no discoverability at all (~70+ sites). Accessibility coverage via `aria-label` exists in only 9 places.

The app uses React + Tailwind v4, with a layered provider tree rooted at `App.tsx`: `QueryClientProvider → SettingsProvider → TauriSyncProvider → ShortcutProvider → ...`. Settings are loaded from `settings.json` via `@tauri-apps/plugin-store`, managed in `SettingsContext` (`src/contexts/SettingsContext.tsx`), and consumed via `useSettings()`. There is no existing Radix dependency.

## Goals / Non-Goals

**Goals:**
- Ship a single, styled `Tooltip` primitive and an `IconButton` wrapper that covers the entire app
- Every icon-only button gets a tooltip + `aria-label` in one pass (no partial rollout)
- Users can disable tooltips or tune their delay in the existing Settings dialog
- `TooltipProvider` is mounted once at the app root; per-tooltip state is zero

**Non-Goals:**
- Rich content tooltips (images, links) — plain text + optional kbd shortcut only
- Tooltip-on-hover for non-interactive elements (status dots, decorative icons)
- Server-side or persistence of tooltip interaction data
- Animated tooltip variants or placement customization per site

## Decisions

### 1. Library: `@radix-ui/react-tooltip`

**Chose Radix over hand-rolled** because it handles keyboard focus (tooltip shows on `focus`, not just `hover`), correct ARIA roles (`role="tooltip"`, `aria-describedby`), portal rendering (avoids overflow clipping), and collision/flip positioning for free. Hand-rolling all of that correctly is weeks of edge-case work. This will be the first Radix package in the project — its addition is deliberate and bounded.

*Alternative considered:* `@floating-ui/react` (positioning only, still requires manual ARIA + focus wiring). Rejected: more code owned, same footprint.

### 2. Provider placement: `AppTooltipProvider` inside `SettingsProvider`

A thin `AppTooltipProvider` component (exported from `src/components/ui/Tooltip.tsx`) reads `useSettings()` and mounts Radix's `<TooltipProvider delayDuration={settings.tooltips.delayMs}>`. It passes `{ enabled, delayMs }` through a `TooltipConfigContext` for downstream components. Placement in `App.tsx` is between `SettingsProvider` and `TauriSyncProvider`.

```tsx
// App.tsx (simplified new provider tree)
<SettingsProvider>
  <AppTooltipProvider>          {/* new */}
    <TauriSyncProvider>
      ...
    </TauriSyncProvider>
  </AppTooltipProvider>
</SettingsProvider>
```

*Alternative considered:* reading settings directly in each `<Tooltip>` call site. Rejected: unnecessary context lookups on every render; centralizing in the provider means one place to update.

### 3. Disabling tooltips: short-circuit in the wrapper, not via `disableHoverableContent`

When `settings.tooltips.enabled = false`, our `<Tooltip>` wrapper renders only the trigger children — no Radix Root, no Content, no portal. This is a clean runtime no-op with zero DOM overhead.

*Alternative considered:* `<TooltipProvider disableHoverableContent delayDuration={Infinity}>`. Rejected: leaks Radix DOM (portal containers) even when disabled; also disables hover on content, which breaks Radix's own semantics.

### 4. `IconButton` API

```tsx
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string          // required — tooltip text AND aria-label
  shortcut?: string      // e.g. "⌘R" — rendered in a <kbd> next to label
  description?: string   // optional second line (muted, smaller text)
}
// children = the icon node
```

`label` is required (not optional) so TypeScript enforces accessibility at the call site. The component renders:

```
<Tooltip label={label} shortcut={shortcut} description={description}>
  <button aria-label={label} {...rest}>{children}</button>
</Tooltip>
```

Existing `className`, `onClick`, `disabled`, and all native button props pass through via rest spread.

*Alternative considered:* separate `tooltipLabel` prop to decouple visual label from aria-label. Rejected: they should always be the same; keeping one prop prevents divergence.

### 5. Tooltip content layout

```
┌──────────────────────────┐
│ Open Settings        ⌘,  │  ← label (left) + shortcut kbd (right), always shown
│ Configure preferences    │  ← description, optional, muted smaller text
└──────────────────────────┘
```

Tooltip width is `max-w-xs`, content is `text-xs`, shortcut uses `<kbd>` with monospace styling. Matches the visual weight of the existing custom popover in `FilterBar.tsx`.

### 6. Settings shape and persistence

```ts
// settingsStore.ts additions
export interface TooltipPrefs {
  enabled: boolean
  delayMs: number          // 0 | 250 | 500 | 1000
}

export interface AppSettings {
  // ... existing fields
  tooltips: TooltipPrefs
}

export const DEFAULT_SETTINGS: AppSettings = {
  // ... existing defaults
  tooltips: { enabled: true, delayMs: 500 },
}
```

`loadSettings` gets a deep-merge line for `tooltips: { ...DEFAULT_SETTINGS.tooltips, ...raw.tooltips }` — same pattern as `notificationPrefs`, `binaryPaths`, etc.

### 7. Migration order and strategy

Sites are migrated area-by-area, largest impact first:

| Wave | Files | Sites |
|---|---|---|
| 1 — Layout shell | `RefreshButton`, `SettingsButton`, `ProjectSwitcher`, `ViewSwitcher` | ~8 |
| 2 — FilterBar | `FilterBar.tsx`, `KpiBar.tsx` | ~12 |
| 3 — Task detail | all `task-detail/*.tsx` | ~28 |
| 4 — Changes browser | `ChangeCard`, `ChangesBrowser`, `ImportModal` | ~15 |
| 5 — Workspace / Smart views / Rest | tabs, quick-capture, notifications, command palette | ~12 |

Each migration is: replace `<button ... title="X">` with `<IconButton label="X">`, or wrap a text button in `<Tooltip label="X">`. Remove bare `title=` attributes from interactive elements as they appear.

## Risks / Trade-offs

**[Risk] First Radix dep sets a precedent** → Mitigation: scope the import to `@radix-ui/react-tooltip` only; document in proposal that broader Radix adoption is out of scope for this change.

**[Risk] `delayMs` change requires provider remount** → Mitigation: Radix's `<TooltipProvider>` accepts `delayDuration` as a live prop; React reconciliation updates it without remounting. No remount needed.

**[Risk] ~75 touch-points = high diff, merge conflicts on active files** → Mitigation: Wave 3 (task-detail) touches the most files. If other branches are modifying the same files, rebase after each wave.

**[Risk] `IconButton` rest-spread could conflict with future HTML attributes** → Mitigation: `extends React.ButtonHTMLAttributes<HTMLButtonElement>` is the standard pattern; TypeScript will catch conflicts at build time.

**[Trade-off] Required `label` prop breaks existing bare `<button>` usages** → This is intentional: migration forces correct labeling. Any site that genuinely cannot provide a label (e.g. a `<button>` used as a layout container) should not use `IconButton` and instead use a plain `<button>` with a comment explaining why.

## Migration Plan

1. Install `@radix-ui/react-tooltip` via `bun add`
2. Create `src/components/ui/Tooltip.tsx` (AppTooltipProvider + Tooltip component)
3. Create `src/components/ui/IconButton.tsx`
4. Update `settingsStore.ts` (type + defaults + loadSettings merge)
5. Mount `<AppTooltipProvider>` in `App.tsx`
6. Add Tooltips section to `SettingsDialog.tsx`
7. Wave 1–5 migration sweeps
8. Remove all remaining bare `title=` attributes on interactive elements

**Rollback:** Remove `<AppTooltipProvider>` from `App.tsx` and `bun remove @radix-ui/react-tooltip`. No data migration needed — `settings.tooltips` is additive and `loadSettings` deep-merges with defaults, so old `settings.json` files without the key continue working.

## Open Questions

- None. All decisions are resolved.
