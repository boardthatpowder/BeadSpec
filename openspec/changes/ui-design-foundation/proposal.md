## Why

BeadSpec's frontend has grown to 20+ components with no shared primitive layer: five button styles, eight hand-rolled modal overlays, ~80 inline SVGs, and no design tokens — the result of a rapid dashboard-shipping pace that outpaced the UI foundation. The gap is now user-visible as visual inconsistency and developer-visible as duplicated boilerplate in every new component.

## What Changes

- Add a Tailwind v4 `@theme` token block to `src/index.css` establishing color, border, text, brand, and semantic palette tokens.
- Install `lucide-react` for a unified icon set; add an `Icon` wrapper standardizing size and stroke width.
- Install `@fontsource-variable/inter` and load it in `src/main.tsx`; remove the dead `src/App.css` scaffold file.
- Create nine new shared primitives in `src/components/ui/`: `Button`, `Dialog`, `Card`, `Badge`, `EmptyState`, `ErrorState`, `Tabs`, `Popover`, `Icon`.
- Create `src/lib/palettes.ts` as the single source of truth for status/priority/risk/outcome color mappings, replacing four divergent inline maps.
- Create `src/lib/format/date.ts` with `formatRelative` and `formatAbsolute` helpers, replacing seven different ad-hoc timestamp formats.
- Install `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-popover` to back the new Dialog, Tabs, Popover primitives (Radix tooltip is already present).
- No existing component is modified in this phase — this is purely additive scaffolding.

## Capabilities

### New Capabilities

- `ui-primitives`: Shared `Button`, `Dialog` (focus-trapped, Esc-dismissable), `Card`, `Badge`, `EmptyState`, `ErrorState`, `Tabs`, `Popover`, and `Icon` components available for use across all features.
- `design-tokens`: Tailwind v4 `@theme` color/text/border/semantic tokens in `src/index.css` and a centralized palette + date-format library in `src/lib/`.

### Modified Capabilities

<!-- No existing spec-level requirements change — this phase is purely additive infrastructure. -->

## Impact

**New dependencies**: `lucide-react`, `@fontsource-variable/inter`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-popover`.

**Files created**: `src/index.css` (extended), `src/components/ui/{Button,Dialog,Card,Badge,EmptyState,ErrorState,Tabs,Popover,Icon}.tsx`, `src/lib/palettes.ts`, `src/lib/format/date.ts`.

**Files removed**: `src/App.css` (dead scaffold — not imported by any active file).

**Files unchanged**: All existing components, Rust IPC layer, Tauri config, all existing tests.

**Downstream phases**: `ui-primitive-migration` (Phase 2) and `ui-dashboard-cohesion` (Phase 3) depend on this change landing first.
