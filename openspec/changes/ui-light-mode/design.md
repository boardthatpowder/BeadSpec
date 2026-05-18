## Context

`ui-design-foundation` established a `@theme` block with CSS custom properties (`--color-bg`, `--color-surface`, `--color-border`, etc.) mapped to Tailwind's `neutral-950/900/800` palette. Light mode is a second mapping of those same property names to lighter values. Tailwind v4's `@theme` cannot be scoped (it always defines the default); the override lives in a regular `[data-theme="light"] { … }` selector that raises specificity and replaces the token values for any subtree carrying that attribute.

## Goals / Non-Goals

**Goals:**
- `[data-theme="light"]` override in `index.css` covers all `--color-*` tokens.
- `document.documentElement` carries `data-theme="dark"` or `data-theme="light"` based on resolved setting.
- System mode follows `window.matchMedia('(prefers-color-scheme: dark)')` and updates when the OS preference changes.
- Theme persists in `AppSettings` (already persisted to `@tauri-apps/plugin-store`).
- The existing `AppearanceSection` gets a System/Light/Dark toggle styled like the Density picker.
- Quick Capture window reads the same setting.
- Hardcoded non-tokenized color classes are replaced.

**Non-Goals:**
- Per-component dark-variant classes (`dark:bg-*`) — not needed; the token override handles it globally.
- Custom color palettes / user-defined themes.
- High-contrast mode.

## Decisions

### D1 — `data-theme` on `document.documentElement`, not on a wrapper div

Applying on `<html>` means every portal (Radix Dialog, Popover, Tooltip content — which teleport to `<body>`) inherits the theme. A wrapper `<div>` wouldn't cover portals.

Implementation in `SettingsContext` (or a thin `useThemeEffect` hook inside `AppLayout`):
```ts
useEffect(() => {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme
  document.documentElement.setAttribute('data-theme', resolved)
}, [theme])

// Also listen for OS changes when theme === 'system':
useEffect(() => {
  if (theme !== 'system') return
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e: MediaQueryListEvent) =>
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}, [theme])
```

### D2 — Light token values

The light-mode overrides map to Tailwind's lighter neutrals:

```css
[data-theme="light"] {
  --color-bg:              var(--color-white);
  --color-surface:         var(--color-neutral-50);
  --color-surface-hi:      var(--color-neutral-100);
  --color-surface-overlay: color-mix(in srgb, var(--color-neutral-100) 90%, transparent);
  --color-border:          var(--color-neutral-200);
  --color-border-strong:   var(--color-neutral-300);
  --color-fg:              var(--color-neutral-900);
  --color-fg-muted:        var(--color-neutral-600);
  --color-fg-subtle:       var(--color-neutral-500);
  --color-accent:          var(--color-blue-600);
  --color-accent-fg:       var(--color-white);
  --color-success:         var(--color-green-600);
  --color-warning:         var(--color-amber-600);
  --color-danger:          var(--color-red-600);
  --color-info:            var(--color-blue-500);
}
```

All are Tailwind v4 palette vars — no hardcoded hex.

### D3 — AppSettings `theme` field default is `'system'`

`DEFAULT_SETTINGS` gains `theme: 'system'`. On first load with no stored value, the OS preference wins. The existing `loadSettings` migration pattern handles older persisted data gracefully (missing field → falls back to default).

### D4 — Hardcoded color audit strategy

Grep for patterns not using tokens:
```bash
grep -r "bg-neutral-950\|bg-neutral-900\|bg-black\|text-neutral-100\|text-white" src/components/ --include="*.tsx"
```
Replace each with the appropriate token class:
- `bg-neutral-950` → `bg-[--color-bg]`
- `bg-neutral-900` → `bg-[--color-surface]`
- `bg-neutral-800` → `bg-[--color-surface-hi]`
- `text-neutral-100` → `text-[--color-fg]`
- `border-neutral-800` → `border-[--color-border]`
- `border-neutral-700` → `border-[--color-border-strong]`

Do NOT replace colors inside `palettes.ts` status/priority entries — those intentional dark-toned classes will need a `[data-theme="light"]` version of `STATUS_PALETTE` in a later pass if needed. For this change, status chips may look slightly off in light mode; that's acceptable and logged as a follow-up.

### D5 — Quick Capture window

`QuickCaptureApp.tsx` does not use `SettingsContext`. Add a minimal `useEffect` that reads `theme` from `@tauri-apps/plugin-store` directly and applies `data-theme` to its own `document.documentElement`. Alternatively, promote the `useThemeEffect` hook into a shared utility `src/lib/theme.ts` and call it from both `AppLayout` and `QuickCaptureApp`.

Prefer the shared utility (D5 decision): create `src/lib/theme.ts` exporting `useThemeEffect(theme: AppSettings['theme'])`.

### D6 — `tauri.conf.json` theme field

Set `"theme": "Auto"` (or omit, as Auto is the default) on the main window config. This makes the native window chrome (title bar, traffic lights) follow the OS preference, which aligns with the `system` default. The Quick Capture window already has `decorations: false` so it's unaffected.

## Risks / Trade-offs

**[Risk] Status/priority palette chips look wrong in light mode** — `STATUS_PALETTE` uses dark-tinted backgrounds (`bg-blue-900/40` etc.) that are near-invisible on a white surface. → Document as a known limitation; file a follow-up Beads issue for `PALETTE_LIGHT_MODE` audit.

**[Risk] Inline SVG colors not tokenized** — After Phase 2 icon migration, inline SVGs are gone, but if Phase 2 hasn't landed yet, some SVG `fill`/`stroke` values hardcoded to `#fff` or `currentColor` may look wrong. → Proceed; `currentColor` inherits the token-driven text color correctly; explicit `fill="#fff"` is caught by the color audit.

**[Risk] Tiptap editor dark styling** — The rich-text editor in `TaskDetailPanel` uses Tiptap with `proseMirrorClasses.ts` defining dark-specific styles. Those will need a light-mode audit pass. → Acceptable for initial ship; file follow-up.

## Migration Plan

1. Add `theme` to `AppSettings`, update `DEFAULT_SETTINGS` and `loadSettings`.
2. Create `src/lib/theme.ts` with `useThemeEffect`.
3. Call `useThemeEffect` in `AppLayout` and `QuickCaptureApp`.
4. Add `[data-theme="light"]` block to `index.css`.
5. Add Theme picker to `AppearanceSection`.
6. Audit hardcoded color classes and replace with tokens.
7. Set `tauri.conf.json` theme to Auto.
8. Quality gates.

## Open Questions

- Should the palette chips have separate light-mode variants? → Out of scope for this change; file a follow-up.
- Should Tiptap editor get a light-mode stylesheet? → Out of scope; file a follow-up.
