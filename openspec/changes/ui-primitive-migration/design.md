## Context

`ui-design-foundation` created nine primitives but no existing component was updated. This change is a bulk mechanical migration: find every inline dialog, button, SVG, tab, and popover implementation and swap it to the shared primitive. The migration is intentionally zero-behavior-change for users except for the a11y improvements that come for free from Radix (focus trapping, Esc, aria-modal).

Current state: 8 modals with hand-rolled `fixed inset-0` overlays, ~50 ad-hoc button styles across 20+ files, ~80 inline `<svg>` blocks, 3 independent tab implementations, 4 hand-rolled popovers.

## Goals / Non-Goals

**Goals:**
- Every modal overlay becomes `<Dialog>` — consistent Esc, backdrop click, focus trap, aria semantics.
- Every button becomes `<Button variant size>` — consistent hover/focus/disabled/loading states.
- Every icon becomes `<Icon name>` — consistent size (sm/md/lg), strokeWidth 1.5, tree-shaken.
- Every tab bar becomes `<Tabs>` — consistent keyboard nav, active indicator, aria roles.
- Every popover becomes `<Popover>` — consistent portal, Esc, outside-click, positioning.

**Non-Goals:**
- Changing any UX flow, layout, or visual design beyond what the primitives already establish.
- Migrating the `<BdAutocomplete>` input (it has unique behavior; leave for a later pass).
- Migrating `<Skeleton>` usage (it already works; separate concern).
- Any Rust/Tauri changes.
- New features or new views.

## Decisions

### D1 — Migration order: Dialogs first, then buttons, then icons, then tabs/popovers

**Rationale:** Dialog migration is the highest-risk because it changes focus management. Doing it first lets us verify Esc/focus behavior before the lower-risk button and icon swaps. Tabs and popovers last because they interact with keyboard focus in ways that need manual verification.

### D2 — `<Dialog onOpenChange>` replaces both `open` state and the `fixed inset-0` overlay

Each migrated modal converts its `const [open, setOpen] = useState(false)` pair to pass `open` and `onOpenChange` to `<Dialog.Root>`. The trigger element becomes `<Dialog.Trigger asChild>` (wrapping existing button/icon). All internal content moves into `<Dialog.Body>` / `<Dialog.Header>` / `<Dialog.Footer>`.

**Special case — CommandPalette**: it uses its own Zustand `commandPaletteStore` for open state. Keep that store; just wire `open={isOpen}` and `onOpenChange={(v) => !v && close()}` to `<Dialog.Root>`.

### D3 — Button variant mapping

The existing ad-hoc styles map to Button variants as follows:
- `bg-blue-600 text-white …` → `variant="primary"`
- `border border-neutral-700 text-neutral-300 …` → `variant="secondary"`
- `hover:bg-neutral-800 text-neutral-400 …` → `variant="ghost"`
- `bg-red-600 text-white …` / `text-red-400 hover:text-red-300 …` → `variant="danger"`
- `text-blue-400 hover:text-blue-300 underline …` → `variant="link"`

Size mapping: `px-2 py-1 text-xs` → `size="xs"`, `px-3 py-1.5 text-sm` → `size="sm"`, `px-4 py-2 text-sm` → `size="md"`.

When a button currently wraps an SVG icon: swap the SVG for `<Icon>` and pass it as `leadingIcon` or keep it inline inside the button label — both work.

### D4 — Icon name mapping (inline SVG → lucide-react)

Key mappings based on the audit:
- Checkmark SVG → `Check`
- X / close → `X`
- ChevronDown/Up → `ChevronDown` / `ChevronUp`
- ChevronLeft/Right → `ChevronLeft` / `ChevronRight`
- Plus / add → `Plus`
- Trash / delete → `Trash2`
- Edit / pencil → `Pencil`
- Search / magnify → `Search`
- Refresh → `RefreshCw`
- Settings / gear → `Settings`
- External link → `ExternalLink`
- Link → `Link2`
- Warning / triangle → `AlertTriangle`
- Info circle → `Info`
- Arrow up/down → `ArrowUp` / `ArrowDown`
- Sort → `ArrowUpDown`
- Eye / view → `Eye`
- Copy → `Copy`
- Expand / maximize → `Maximize2`
- Collapse / minimize → `Minimize2`
- Filter → `Filter`
- Tag / label → `Tag`
- Clock → `Clock`
- User → `User`
- Git branch → `GitBranch`
- Folder → `Folder`
- File → `File`
- Zap / lightning → `Zap`
- Circle / dot → `Circle`
- Loader spinner → `Loader2`

Unicode glyphs:
- `↗` → `<Icon name="ExternalLink" size="sm">`
- `✓` → `<Icon name="Check" size="sm">`
- `✗` → `<Icon name="X" size="sm">`
- `⚠` → `<Icon name="AlertTriangle" size="sm">`
- `↑ / ↓ / ↕` → `<Icon name="ArrowUp/ArrowDown/ArrowUpDown" size="sm">`
- `🔗` → `<Icon name="Link2" size="sm">`
- `✕` in Toast/buttons → `<Icon name="X" size="sm">`

### D5 — Tabs: keep active-tab state management as-is, just swap the JSX

Each existing tab implementation manages active tab via `useState` or URL hash. Keep that logic; only swap the JSX from `<button className="border-b-2 …">` to `<Tabs.Trigger value="…">`. Pass `value={activeTab}` and `onValueChange={setActiveTab}` to `<Tabs.Root>`.

### D6 — Popovers: replace hand-rolled portals with `<Popover.Content>`

Each popover currently uses `useEffect` for outside-click + manual `top/left` positioning. Swap to `<Popover.Root open={open} onOpenChange={setOpen}>` with `<Popover.Trigger asChild>` and `<Popover.Content side="bottom" align="start">`. Radix handles positioning, outside-click, and Esc automatically.

## Risks / Trade-offs

**[Risk] Dialog Esc behavior change** — modals that previously didn't close on Esc now will. This is intentional UX improvement but confirm `SettingsDialog` (which had its own Escape handler) doesn't double-fire. → Remove the manual `useEffect` Escape listener from `SettingsDialog` once `<Dialog>` wraps it.

**[Risk] Tab keyboard nav change** — Radix Tabs uses arrow-key navigation (not Tab key) between tab triggers. Current implementations use Tab. Users who tab between tabs will now use arrow keys. This is standard ARIA tabs behavior. → Document in PR; add a brief note to `ShortcutModal` cheat sheet.

**[Risk] Popover positioning regressions** — Radix `@radix-ui/react-popover` auto-flips and repositions. The `FilterBar` popover and `StatusFilterPill` may visually shift. → Spot-check each popover after migration with `bun run dev`.

**[Risk] Large diff size** — ~80 icon replacements + ~50 button swaps + 10 dialog migrations across ~25 files. The PR will be large but each hunk is mechanical. → Review per-component, not as a single blob.

## Migration Plan

Work file-by-file in this order to minimize conflict risk:

1. Dialogs (10 files) — highest a11y impact, isolated per file
2. Buttons (15 files) — mechanical swaps, no structural change
3. Icons (25 files, ~80 occurrences) — purely visual, no logic change
4. Tabs (3 files)
5. Popovers (4 files)

Each file: run `bun run typecheck` after its section completes to catch type errors early.

Final gate: `bun run typecheck && bun test && bun run lint`.

## Open Questions

None — migration targets are fully enumerated in the proposal.
