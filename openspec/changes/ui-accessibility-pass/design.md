## Context

Phases 1–3 established the primitive layer and polished dashboards. The remaining a11y gaps fall into four categories: (1) no visible focus indicator for keyboard users, (2) icon-only controls without accessible names, (3) form inputs without labels, (4) color-only state communication. This change addresses each category with targeted, minimal changes.

## Goals / Non-Goals

**Goals:**
- Every interactive element has a visible `focus-visible` ring (not the browser default outline).
- Every icon-only control has an accessible name via `aria-label` or `<IconButton>` tooltip prop.
- Every form input has an associated `<label>` (visually hidden at compact density).
- All state indicators that use color have a redundant non-color cue (icon or text).
- `eslint-plugin-jsx-a11y` is installed and warns on violations in CI.

**Non-Goals:**
- Full WCAG 2.1 AA compliance audit.
- Screen reader testing on all views.
- Keyboard navigation redesign.
- Color contrast pass (that's a separate PR once design-tokens are fully adopted).

## Decisions

### D1 — Focus ring via Tailwind `focus-visible:ring-*` on primitives

Add to `Button.tsx`, `IconButton.tsx`, and `Tabs.Trigger` in `Tabs.tsx`:
```
focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:ring-offset-1 focus-visible:ring-offset-[--color-bg]
```
The `ring-offset` color is the page background so the ring appears to "float" outside the element rather than blending into it.

In `src/index.css`, add:
```css
*:focus-visible { outline: none; }
```
This removes the browser default blue outline everywhere so only our custom ring shows. This rule only fires for keyboard focus (not mouse), so it's safe.

### D2 — `eslint-plugin-jsx-a11y` at warn level

Add `eslint-plugin-jsx-a11y` as a dev dependency. Configure `jsx-a11y/recommended` rules at `warn` severity in `eslint.config.*`. Start at warn (not error) to avoid blocking CI on the first pass; escalate to error once coverage is complete.

Key rules that will fire on existing violations:
- `jsx-a11y/click-events-have-key-events`
- `jsx-a11y/interactive-supports-focus`
- `jsx-a11y/aria-props`
- `jsx-a11y/label-has-associated-control`

### D3 — Label approach for compact density

Form inputs in `MemoryBrowser` and `ProcessBrowser` need labels. At compact density (12px rows), visible labels add too much vertical space. Use:
```html
<label class="sr-only">Key</label>
<input placeholder="key" … />
```
`sr-only` (Tailwind `sr-only` utility: `position: absolute; width: 1px; height: 1px; …`) hides the label visually but keeps it in the a11y tree. At default/comfortable density, show the label visually above the input.

### D4 — Redundant cues via `<Icon>` + `aria-label`

`StatusDropdown` already shows colored text labels. After Phase 2 the status chips use `STATUS_PALETTE`. In Phase 4 we add a small `<Icon>` per status:
- `open` → `Circle` (sm, text-blue-400)
- `in_progress` → `Loader2` (sm, text-amber-400)
- `done` → `CheckCircle2` (sm, text-green-400)
- `blocked` → `Ban` (sm, text-red-400)
- `paused` → `PauseCircle` (sm, text-neutral-400)

`OpenSpecPanel` validate: wrap `✓`/`✗` in `<span aria-label="passed">` / `<span aria-label="failed">`.

`ImpactPanel` risk chips: add `aria-label={`risk: ${level}`}` to each chip wrapper.

`BdHumanQueue` pulsing dot: add `aria-live="polite"` to the container and set `aria-label={`${count} issues awaiting human review`}`.

## Risks / Trade-offs

**[Risk] `jsx-a11y` warns on existing code** — the first run will show many warnings across the codebase. → Set to warn, not error. Document expected count in PR description. Fix new violations going forward; batch-fix legacy ones in a follow-up.

**[Risk] `*:focus-visible { outline: none }` is aggressive** — if a component doesn't have a focus-visible ring style, it will have no focus indicator at all for keyboard users. → Only merge this after confirming `Button`, `IconButton`, and `Tabs.Trigger` all have `focus-visible:ring-*` styles.

## Migration Plan

1. Add `*:focus-visible { outline: none }` to `index.css`.
2. Add `focus-visible:ring-*` to `Button`, `IconButton`, `Tabs.Trigger`.
3. Add `aria-label` to uncovered icon controls (5 targets).
4. Add `<label>` to unlabeled inputs (3 views).
5. Add redundant cues to color-only indicators (4 components).
6. Install and configure `eslint-plugin-jsx-a11y`.
7. Quality gates.

## Open Questions

None.
