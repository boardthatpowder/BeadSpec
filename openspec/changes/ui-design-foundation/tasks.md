## 1. Dependencies & Font Setup

- [x] 1.1 Install `lucide-react`, `tailwind-merge`, `@fontsource-variable/inter`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-popover` with bun
- [x] 1.2 Import Inter variable font in `src/main.tsx` (`import '@fontsource-variable/inter'`)
- [x] 1.3 Verify no active import of `src/App.css` exists (`grep -r 'App.css' src/`), then delete `src/App.css`

## 2. Design Token Layer

- [x] 2.1 Add `@theme { … }` block to `src/index.css` with all surface, border, text, brand, and semantic color tokens (see design.md D1)
- [x] 2.2 Add `--font-sans: 'InterVariable', sans-serif` to the `@theme` block
- [x] 2.3 Run `bun run dev` and confirm the app renders with Inter and no visual regressions

## 3. Palette & Date Libraries

- [x] 3.1 Create `src/lib/palettes.ts` with `STATUS_PALETTE`, `PRIORITY_PALETTE`, `RISK_PALETTE`, `OUTCOME_PALETTE` (Record<string, { bg, text, border }> — all Tailwind class strings)
- [x] 3.2 Create `src/lib/format/date.ts` with `formatRelative` (date-fns `formatDistanceToNow`) and `formatAbsolute` (date-fns `format`) helpers; both accept `Date | string | number`
- [x] 3.3 Write unit tests in `src/lib/format/__tests__/date.test.ts` covering: relative output, absolute with/without time, ISO string input, numeric timestamp input

## 4. Icon Primitive

- [x] 4.1 Create `src/components/ui/Icon.tsx` wrapping lucide-react with `name`, `size` (`sm`/`md`/`lg` → 14/16/20px), `strokeWidth` (default 1.5), forwarded `className`

## 5. Button Primitive

- [x] 5.1 Create `src/components/ui/Button.tsx` with variants `primary | secondary | ghost | danger | link` and sizes `xs | sm | md`; use `clsx` + `tailwind-merge` (`cn()` helper) for class composition
- [x] 5.2 Add `leadingIcon`, `trailingIcon`, and `loading` props; `loading` shows spinner (lucide `Loader2`) and disables the button
- [x] 5.3 Add `focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:ring-offset-1` to all Button states
- [x] 5.4 Write smoke test in `src/components/ui/__tests__/Button.test.tsx`: renders each variant, renders loading state, renders disabled state

## 6. Dialog Primitive

- [x] 6.1 Create `src/components/ui/Dialog.tsx` built on `@radix-ui/react-dialog` with `Dialog.Root`, `Dialog.Trigger`, `Dialog.Header`, `Dialog.Body`, `Dialog.Footer`, `Dialog.Close`
- [x] 6.2 Style the backdrop as `bg-black/60 backdrop-blur-sm` and the content panel with `bg-[--color-surface] border border-[--color-border] rounded-xl shadow-2xl`
- [x] 6.3 Write smoke test: Dialog opens, Esc closes it, backdrop click closes it

## 7. Card Primitive

- [x] 7.1 Create `src/components/ui/Card.tsx` with base token styles and an optional `interactive` prop that adds hover + focus-visible styles

## 8. Badge Primitive

- [x] 8.1 Create `src/components/ui/Badge.tsx` with `variant` prop (`default | success | warning | danger | info | muted`); map variants to tokens from `src/lib/palettes.ts` or direct `--color-*` tokens

## 9. EmptyState & ErrorState Primitives

- [x] 9.1 Create `src/components/ui/EmptyState.tsx` with `icon`, `title`, `description?`, `action?` slots; centered layout matching the `ChangesBrowser` empty-state visual style
- [x] 9.2 Create `src/components/ui/ErrorState.tsx` with `title`, `description?`, `retry?: () => void`; shows a "Try again" Button when `retry` is provided; never renders raw error strings

## 10. Tabs Primitive

- [x] 10.1 Create `src/components/ui/Tabs.tsx` built on `@radix-ui/react-tabs` exposing `Tabs.Root`, `Tabs.List`, `Tabs.Trigger` (blue bottom-border active indicator), `Tabs.Content`
- [x] 10.2 Add `focus-visible:ring-2` to `Tabs.Trigger`

## 11. Popover Primitive

- [x] 11.1 Create `src/components/ui/Popover.tsx` built on `@radix-ui/react-popover` exposing `Popover.Root`, `Popover.Trigger`, `Popover.Content`; content styled with `bg-[--color-surface] border border-[--color-border] rounded-lg shadow-xl`

## 12. Quality Gates

- [x] 12.1 Run `bun run typecheck` — zero errors
- [x] 12.2 Run `bun test` — all existing tests pass, new smoke tests pass
- [x] 12.3 Run `bun run lint` — zero errors
- [x] 12.4 Run `bun run dev`, open BeadSpec, walk every view — confirm zero visual regressions
- [x] 12.5 Run `openspec validate ui-design-foundation` — passes
