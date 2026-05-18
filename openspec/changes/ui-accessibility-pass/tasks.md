## 1. Global Focus Reset

- [x] 1.1 Add `*:focus-visible { outline: none; }` to `src/index.css`
- [x] 1.2 Add `focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:ring-offset-1 focus-visible:ring-offset-[--color-bg]` to `Button.tsx` base styles
- [x] 1.3 Add the same `focus-visible:ring-*` classes to `IconButton.tsx`
- [x] 1.4 Add `focus-visible:ring-*` to `Tabs.Trigger` in `Tabs.tsx`
- [x] 1.5 Visual check: Tab through the app — every focusable element shows the accent-colored ring; no browser default outline visible

## 2. Icon-Only Control Labels

- [x] 2.1 `TaskList.tsx` sort header chevrons — add `aria-label="Sort ascending"` / `aria-label="Sort descending"` / `aria-label="Sort"` to each
- [x] 2.2 `ChangesBrowser.tsx` archived-section expand/collapse chevron — add `aria-label` that reflects current state ("Show archived" / "Hide archived")
- [x] 2.3 `ProcessBrowser.tsx` cluster filter select element — add `aria-label="Filter by cluster"`
- [x] 2.4 Grep for any remaining `<button>` elements with only `<Icon>` children and no `aria-label` across all `src/components/` — add labels to any found

## 3. Form Labels

- [x] 3.1 `MemoryBrowser.tsx` "key" and "value" inputs in StoreDialog — add `<label className="sr-only">Key</label>` and `<label className="sr-only">Value</label>` associated via `htmlFor` / `id`
- [x] 3.2 `ProcessBrowser.tsx` search input — add `<label className="sr-only">Search processes</label>`
- [x] 3.3 `ProcessBrowser.tsx` cluster filter select — add `<label className="sr-only">Filter by cluster</label>`
- [x] 3.4 `ReviewsHealthTab.tsx` search input — add `<label className="sr-only">Search reviews</label>`

## 4. Redundant State Cues

- [x] 4.1 `StatusDropdown.tsx` — add a small `<Icon>` per status value (`Circle` open, `Loader2` in_progress, `CheckCircle2` done, `Ban` blocked, `PauseCircle` paused) alongside existing color/text
- [x] 4.2 `OpenSpecPanel.tsx` validate glyphs — wrap each `✓`/`✗` in `<span aria-label="passed">` / `<span aria-label="failed">`
- [x] 4.3 `ImpactPanel.tsx` risk chips — add `aria-label={`risk: ${level}`}` to each chip wrapper `<div>` or `<span>`
- [x] 4.4 `BdHumanQueue.tsx` pulsing dot container — add `aria-live="polite"` to the wrapper; set `aria-label={`${count} issues awaiting human review`}` (update dynamically)

## 5. eslint-plugin-jsx-a11y

- [x] 5.1 `bun add -d eslint-plugin-jsx-a11y`
- [x] 5.2 Add `jsx-a11y/recommended` rules at `warn` severity to `eslint.config.*`
- [x] 5.3 Run `bun run lint` — note the initial warning count in a PR comment (baseline); fix any `error`-level violations

## 6. Quality Gates

- [x] 6.1 Run `bun run typecheck` — zero errors
- [x] 6.2 Run `bun test` — all tests pass
- [x] 6.3 Run `bun run lint` — zero errors (warnings are acceptable for initial jsx-a11y baseline)
- [x] 6.4 Keyboard walkthrough: Tab through every view — every focusable element has accent ring, no browser outline visible
- [x] 6.5 Screen reader spot-check: focus the sort header, archived chevron, MemoryBrowser key input, and BdHumanQueue dot — each announces a descriptive label
- [x] 6.6 Run `openspec validate ui-accessibility-pass` — passes
