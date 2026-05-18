## Why

After Phases 1–3 the app has consistent primitives and polished dashboards, but keyboard and screen-reader users still face significant barriers: no `focus-visible` rings on buttons, icon-only controls without labels, unlabeled form inputs, and color-only state indicators. This change makes a targeted, measurable a11y lift without attempting a complete WCAG sweep.

## What Changes

- Add `focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:ring-offset-1` to `Button`, `IconButton`, and `Tabs.Trigger` in `src/components/ui/`.
- Add a global `*:focus-visible { outline: none; }` reset in `src/index.css` so no component ever shows the ugly browser-default blue outline alongside our custom ring.
- Add `eslint-plugin-jsx-a11y` to the project; configure it in `eslint.config.*` at the warn level so future icon-only buttons without `aria-label` are caught in CI.
- Add `aria-label` to all remaining icon-only controls not already wrapped in `<IconButton>`: sort-header chevrons in `TaskList`, archived-section chevron in `ChangesBrowser`, cluster filter select in `ProcessBrowser`.
- Add redundant non-color cues to color-only state indicators: status icons via `<Icon>` in `StatusDropdown`; `aria-label="passed"` / `aria-label="failed"` on `OpenSpecPanel` validate glyphs; `aria-label="risk: high"` etc. on `ImpactPanel` risk chips; `aria-live="polite"` + numeric `aria-label` on `BdHumanQueue` pulsing dot.
- Replace placeholder-only form inputs in `MemoryBrowser`, `ProcessBrowser`, `ReviewsHealthTab` with properly associated `<label>` elements (visually hidden at compact density, visible at default/comfortable density).

## Capabilities

### New Capabilities

<!-- None — this is an improvement to existing surfaces, no new capabilities. -->

### Modified Capabilities

- `task-list`: Sort header chevrons and filter controls gain `aria-label`.
- `task-detail`: StatusDropdown status chips gain redundant icon cues; OpenSpecPanel validate glyphs gain `aria-label`.
- `bd-health-panel`: ReviewsHealthTab search input gains a `<label>`.
- `notifications`: BdHumanQueue pulsing dot gains `aria-live` and numeric label.
- `ruflo-memory-panel`: MemoryBrowser key/value inputs gain `<label>`.

## Impact

**Files modified**: `src/components/ui/{Button,IconButton,Tabs}.tsx`, `src/index.css`, `src/components/task-list/{TaskList,FilterBar}.tsx`, `src/components/changes-browser/ChangesBrowser.tsx`, `src/components/process-browser/ProcessBrowser.tsx`, `src/components/task-detail/{StatusDropdown,OpenSpecPanel,ImpactPanel}.tsx`, `src/components/notifications/BdHumanQueue.tsx`, `src/components/memory-browser/MemoryBrowser.tsx`, `src/components/health/ReviewsHealthTab.tsx`, `eslint.config.*`.

**New dev dependency**: `eslint-plugin-jsx-a11y`.
