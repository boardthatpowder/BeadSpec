## Context

The frontend has accumulated five distinct button styles, eight parallel modal overlay implementations, ~80 inline `<svg>` elements with no shared size/stroke contract, and zero Tailwind v4 `@theme` tokens. The existing `src/index.css` is 7 lines (just `@import "tailwindcss"` plus one class); `src/App.css` is a dead Vite/Tauri scaffold file that no active import path references.

Tailwind v4 ships a CSS-first configuration model (`@theme { … }`) that replaces `tailwind.config.js`. The project hasn't adopted it, so all colors, borders, and semantic values are ad-hoc class strings.

## Goals / Non-Goals

**Goals:**
- Establish a `@theme` token block in `src/index.css` as the single source for color, border, text, and semantic values.
- Ship nine composable primitives (`Button`, `Dialog`, `Card`, `Badge`, `EmptyState`, `ErrorState`, `Tabs`, `Popover`, `Icon`) that existing components can adopt incrementally.
- Centralise status/priority/risk/outcome color maps into one exportable `src/lib/palettes.ts`.
- Centralise all timestamp formatting into `src/lib/format/date.ts`.
- Zero visual regressions — this phase adds new files and one token block; no existing component is modified.

**Non-Goals:**
- Migrating existing components to the new primitives (Phase 2).
- Accessibility improvements on existing surfaces (Phase 4).
- Light-mode support (Phase 6).
- Rust / Tauri IPC changes.
- Animation / motion system (Phase 5).

## Decisions

### D1 — Tailwind v4 `@theme` over a JS token file
**Decision:** tokens live in `src/index.css` inside a `@theme { … }` block, referencing existing Tailwind neutral/blue/amber/green/rose palette shades.

**Rationale:** Tailwind v4 resolves `@theme` tokens as CSS custom properties AND as Tailwind utility classes automatically. A JS token file would require a build-time mapping step and wouldn't integrate with Tailwind class autocomplete. Alternative (separate CSS vars in `:root`) loses Tailwind utility integration.

**Token shape:**
```css
@theme {
  --color-bg:              var(--color-neutral-950);
  --color-surface:         var(--color-neutral-900);
  --color-surface-hi:      var(--color-neutral-800);
  --color-surface-overlay: color-mix(in srgb, var(--color-neutral-900) 80%, transparent);
  --color-border:          var(--color-neutral-800);
  --color-border-strong:   var(--color-neutral-700);
  --color-fg:              var(--color-neutral-100);
  --color-fg-muted:        var(--color-neutral-400);
  --color-fg-subtle:       var(--color-neutral-500);
  --color-accent:          var(--color-blue-500);
  --color-accent-fg:       var(--color-white);
  --color-success:         var(--color-green-500);
  --color-warning:         var(--color-amber-500);
  --color-danger:          var(--color-red-500);
  --color-info:            var(--color-blue-400);
}
```

### D2 — Radix UI for Dialog, Tabs, Popover
**Decision:** `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-popover`.

**Rationale:** Radix tooltip (`@radix-ui/react-tooltip`) is already installed and working well. Extending to three more Radix primitives keeps the dependency set cohesive and buys focus-trapping, ARIA roles, keyboard nav, and portal management for free. Alternative (Headless UI) requires a separate React adapter; shadcn/ui would pull in many additional dependencies beyond what's needed.

### D3 — lucide-react for icons
**Decision:** Install `lucide-react`. Expose via an `Icon` wrapper (`src/components/ui/Icon.tsx`) that accepts a `name` prop, size variant (`sm`/`md`/`lg` → 14/16/20px), and fixes `strokeWidth` at 1.5 across all icons.

**Rationale:** lucide-react is the de-facto choice for the Radix/Tailwind ecosystem (same defaults used by shadcn/ui). It ships as individual named exports — tree-shaking works without a build plugin. Alternatives: Heroicons (thicker strokes, different visual language), Phosphor (larger package). The `Icon` wrapper ensures no component reaches directly into lucide and then uses a different size/stroke convention.

### D4 — `Button` variants via a class-variance-authority (cva) pattern without the CVA package
**Decision:** Implement the variant/size matrix with a plain `cn()` helper (clsx + tailwind-merge equivalent) rather than adding the `cva` package.

**Rationale:** The matrix is small (5 variants × 3 sizes). Adding `cva` for this is premature abstraction. If the matrix grows significantly in Phase 2 a follow-up can introduce `cva`. The `cn` utility (clsx already installed) is sufficient and zero-dependency.

### D5 — `palettes.ts` keyed by semantic string, value is a class tuple
**Decision:**
```ts
export const STATUS_PALETTE: Record<string, { bg: string; text: string; border: string }> = {
  open:        { bg: 'bg-blue-900/40',   text: 'text-blue-300',   border: 'border-blue-700/50' },
  in_progress: { bg: 'bg-amber-900/40',  text: 'text-amber-300',  border: 'border-amber-700/50' },
  done:        { bg: 'bg-green-900/40',  text: 'text-green-300',  border: 'border-green-700/50' },
  blocked:     { bg: 'bg-red-900/40',    text: 'text-red-300',    border: 'border-red-700/50' },
  paused:      { bg: 'bg-neutral-800/60',text: 'text-neutral-400',border: 'border-neutral-700/50' },
};
```
Callers spread the tuple: `className={clsx(STATUS_PALETTE[status].bg, STATUS_PALETTE[status].text)}`.

**Rationale:** Class tuples work directly with Tailwind's JIT; no CSS-in-JS runtime needed. Keeping `bg`/`text`/`border` separate lets callers use only what the context requires (e.g., text-only in a narrow chip, all three in a full badge).

### D6 — `formatRelative` uses date-fns `formatDistanceToNow`
**Decision:** `formatRelative(ts)` → `"2 hours ago"` using `date-fns/formatDistanceToNow`. `formatAbsolute(ts)` → locale-formatted string using `date-fns/format`. Both accept `Date | string | number`.

**Rationale:** `date-fns` is already installed. This adds no new dependency and produces consistent locale-aware output across all call sites.

## Risks / Trade-offs

**[Risk] Tailwind v4 `@theme` token names conflict with future Tailwind built-ins** → Use a namespaced prefix (`--color-bg` etc.) that doesn't shadow existing Tailwind palette names. Monitor Tailwind v4 release notes.

**[Risk] `Icon` wrapper adds an indirection layer** → Kept thin (re-exports lucide icons, passes through `className`). Performance: lucide icons are inline SVG — no extra DOM node vs current inline SVGs.

**[Risk] `Dialog` Radix package version mismatch with existing `@radix-ui/react-tooltip`** → Pin to same major version (`^1.x`). Check `peerDependencies` before install.

**[Risk] `App.css` deletion breaks something not visible via `grep`** → Verified: no `import './App.css'` or `import '../App.css'` exists in `src/` other than dead paths. Confirm with `grep -r 'App.css' src/` before delete.

## Migration Plan

This phase is purely additive — no migration required for end users or existing components.

1. Install new npm packages (`bun add lucide-react @fontsource-variable/inter @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-popover`).
2. Extend `src/index.css` with `@theme { … }` block and `@font-face` / `@import` for Inter.
3. Import Inter in `src/main.tsx`.
4. Delete `src/App.css` (confirm no active imports first).
5. Create the nine primitive files in `src/components/ui/`.
6. Create `src/lib/palettes.ts` and `src/lib/format/date.ts`.
7. Run `bun run typecheck` and `bun test` — expect zero failures.
8. Run `bun run dev`, open the app, visually confirm zero regressions.

Rollback: the token block can be removed from `src/index.css` without touching any component (tokens are unused until Phase 2 migrations). The new files are additive and can be deleted independently.

## Open Questions

- **Inter weight range**: Use variable font (`@fontsource-variable/inter` with `wght` 100–900) or the static subset? Variable font is ~40KB gzipped — acceptable for a desktop app. Decision: variable.
- **`clsx` vs `tailwind-merge`**: The project currently uses `clsx` only. `tailwind-merge` would de-dup conflicting Tailwind classes in the `Button` variant logic. Add `tailwind-merge` and a `cn()` helper, or keep `clsx` only? Decision: add `tailwind-merge` — `Button` with slot class overrides requires class deduplication to work correctly.
