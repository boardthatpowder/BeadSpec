## Context

After Phases 1–3 the app is visually consistent. The remaining "feel" gap is motion: dialogs snap open/closed with no transition, popovers appear instantly, toasts just appear, the command palette has no opening animation. `tw-animate-css` is a Tailwind v4 compatible CSS-only animation library that works with Radix's `data-[state=open/closed]` attributes — no runtime JS overhead. Optimistic UI for claim/close and memory delete removes the latency perception gap on those mutations.

## Goals / Non-Goals

**Goals:**
- Dialog, Popover, Tooltip have smooth enter/exit via Radix `data-state` attributes.
- Toast slides in from bottom-right and fades out.
- CommandPalette scales up and fades in on open.
- All animations respect `prefers-reduced-motion`.
- Claim/close in `TaskDetailPanel` and delete in `MemoryBrowser` are optimistic.
- `StatusDropdown` optimistic behavior verified to survive Phase 2 migration.

**Non-Goals:**
- Page transition animations (no routing).
- Skeleton shimmer changes (already `animate-pulse`).
- macOS custom titlebar / traffic-light inset.
- Complex gesture-based animations.

## Decisions

### D1 — `tw-animate-css` over `framer-motion`

`framer-motion` (~45KB gzip) is overkill for what we need. `tw-animate-css` provides standard CSS keyframe animations as Tailwind utilities (fade, zoom, slide-in) that Radix `data-state` attributes can drive directly. Zero runtime JS. Works with Tailwind v4 `@plugin` import.

### D2 — Radix animation pattern

Radix emits `data-[state=open]` on content when visible and `data-[state=closed]` when hidden (before unmount). The `forceMount` prop keeps the element in the DOM during exit animations. Pattern for `Dialog.Content`:

```tsx
<DialogContent
  forceMount
  className="
    data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
    data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
    duration-150
  "
>
```

For `Popover.Content`: same pattern with `slide-in-from-top-2` / `slide-out-to-top-2`.

For `Tooltip.Content`: `fade-in-0` / `fade-out-0` only (duration-100, no zoom).

### D3 — Toast: slide-in from bottom-right

`Toast.tsx` currently appends/removes DOM nodes. For slide-in:
- On appear: `animate-in slide-in-from-bottom-2 fade-in-0 duration-200`
- On dismiss: `animate-out slide-out-to-bottom-2 fade-out-0 duration-150`

Add a brief `duration` to the Zustand dismiss timing (150ms delay before removing from DOM).

### D4 — CommandPalette: scale + fade

```tsx
// Dialog content inside CommandPalette
data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
duration-150
```

### D5 — Optimistic UI via TanStack Query `onMutate`

For `TaskDetailPanel` claim/close:
```ts
onMutate: async (newStatus) => {
  await queryClient.cancelQueries({ queryKey: taskKey })
  const previous = queryClient.getQueryData(taskKey)
  queryClient.setQueryData(taskKey, (old) => ({ ...old, status: newStatus }))
  return { previous }
},
onError: (_, __, context) => {
  queryClient.setQueryData(taskKey, context.previous)
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: taskKey })
},
```

For `MemoryBrowser` delete: same pattern on the entries list query.

### D6 — `motion-reduce` variants

Every animation class pair gets a `motion-reduce:` override:
```
motion-reduce:animate-none motion-reduce:transition-none
```
Tailwind v4 supports `@media (prefers-reduced-motion: reduce)` via the `motion-reduce:` variant natively.

## Risks / Trade-offs

**[Risk] Exit animations require `forceMount`** — without `forceMount`, Radix unmounts the content before the exit animation can complete. → Add `forceMount` to `Dialog.Content`, `Popover.Content` in the primitive components.

**[Risk] Optimistic rollback race condition** — if two mutations fire in quick succession on the same task, the rollback might overwrite a valid intermediate state. → TanStack Query's `cancelQueries` + `onSettled` invalidation handles this; this is the standard documented pattern.

**[Risk] `tw-animate-css` version compatibility with Tailwind v4** — verify the package supports v4 `@plugin` syntax before installing. → Check npm page / README; fall back to manual `@keyframes` in `index.css` if needed.

## Migration Plan

1. Install `tw-animate-css`, add `@plugin "tw-animate-css"` to `index.css`.
2. Add `forceMount` + `data-[state]` animation classes to `Dialog.Content`, `Popover.Content`, `Tooltip.Content`.
3. Add `data-[state]` animation to `CommandPalette` dialog content.
4. Update `Toast.tsx` with slide-in/fade-out classes + dismiss delay.
5. Implement optimistic mutations in `TaskDetailPanel` and `MemoryBrowser`.
6. Verify `StatusDropdown` optimistic flow still works.
7. Quality gates.

## Open Questions

- Is `tw-animate-css` confirmed Tailwind v4 compatible? → Verify at implementation time; fallback to manual `@keyframes` in `index.css`.
