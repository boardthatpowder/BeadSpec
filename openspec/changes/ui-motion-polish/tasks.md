## 1. Install Animation Library

- [x] 1.1 `bun add tw-animate-css` — verify it supports Tailwind v4 `@plugin` syntax (check README; fallback: add `@keyframes` manually to `index.css`)
- [x] 1.2 Add `@plugin "tw-animate-css"` (or `@import "tw-animate-css"`) to `src/index.css`
- [x] 1.3 Run `bun run dev` — confirm app loads with no CSS errors

## 2. Animate Radix Primitives

- [x] 2.1 `Dialog.tsx` — add `forceMount` to `<DialogPrimitive.Content>` and apply `data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-150 motion-reduce:animate-none` to the content panel
- [x] 2.2 `Popover.tsx` — same pattern with `slide-in-from-top-2` / `slide-out-to-top-2` added; `forceMount` on `<PopoverPrimitive.Content>`
- [x] 2.3 `Tooltip.tsx` — add `forceMount` + `data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-100 motion-reduce:animate-none`
- [x] 2.4 `CommandPalette.tsx` dialog content — add scale+fade animation classes same as Dialog

## 3. Toast Slide Animation

- [x] 3.1 `Toast.tsx` — add enter animation class `animate-in slide-in-from-bottom-2 fade-in-0 duration-200` to each toast item
- [x] 3.2 Add exit animation: introduce a `dismissing` state flag per toast item; when set, apply `animate-out slide-out-to-bottom-2 fade-out-0 duration-150`; wait 150ms before removing from the Zustand store
- [x] 3.3 Verify: trigger a toast, watch it slide in; dismiss it, watch it slide out before disappearing

## 4. Optimistic Mutations

- [x] 4.1 `TaskDetailPanel.tsx` claim mutation — implement TanStack Query optimistic update: `onMutate` sets status optimistically, `onError` rolls back, `onSettled` invalidates
- [x] 4.2 `TaskDetailPanel.tsx` close mutation — same optimistic pattern
- [x] 4.3 `MemoryBrowser.tsx` delete mutation — optimistic removal from entries list; rollback on error with error toast
- [x] 4.4 `StatusDropdown.tsx` — verify existing optimistic flow still works after Phase 2 `<Button>` migration; fix if broken

## 5. Quality Gates

- [x] 5.1 Run `bun run typecheck` — zero errors
- [x] 5.2 Run `bun test` — all tests pass
- [x] 5.3 Run `bun run lint` — zero errors
- [x] 5.4 Manual verification: open/close a Dialog — observe smooth scale+fade; open/close a Popover — observe slide; hover a Tooltip — observe fade; trigger a Toast — observe slide-in then slide-out on dismiss
- [x] 5.5 Verify `prefers-reduced-motion`: enable reduced-motion in macOS Accessibility settings; open/close a Dialog — animation should be instant
- [x] 5.6 Verify optimistic claim: click Claim on a task; status should update instantly; simulate network error (offline mode) — status should roll back
- [x] 5.7 Run `openspec validate ui-motion-polish` — passes
