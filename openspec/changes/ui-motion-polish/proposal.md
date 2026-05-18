## Why

After Phases 1–3 the app is visually consistent but still feels static — dialogs snap open/closed, toasts appear instantly, the command palette appears without transition. Adding purposeful enter/exit animations via `tw-animate-css` and Radix's `data-state` attributes closes this gap without adding a heavy animation library.

## What Changes

- Install `tw-animate-css` (Tailwind v4 compatible CSS animation plugin) and import it in `src/index.css`.
- Apply enter/exit animations to `Dialog`, `Popover`, and `Tooltip` content via `data-[state=open]` / `data-[state=closed]` Tailwind variants. Radix emits these attributes automatically.
- `Toast.tsx` — slide-in from bottom-right on appear; fade+slide-out on dismiss.
- `CommandPalette.tsx` — scale 95%→100% + opacity 0→1 on open.
- Add `motion-reduce:` variants to every animation so users with `prefers-reduced-motion: reduce` get instant transitions.
- Optimistic UI for `TaskDetailPanel` claim/close — TanStack Query `optimisticUpdate` so status changes reflect immediately without waiting for the IPC round-trip.
- Optimistic UI for `MemoryBrowser` delete — remove the entry from the cache immediately; roll back on error.
- Verify `StatusDropdown` optimistic update (already exists) still works after Phase 2 migration.

## Capabilities

### New Capabilities

<!-- None — animation and optimistic UI are improvements to existing surfaces. -->

### Modified Capabilities

- `task-detail`: Claim/close actions are now optimistic — status updates instantly in the UI.
- `ruflo-memory-panel`: Delete is now optimistic — entry disappears immediately, rolls back on error.
- `notifications`: CommandPalette open/close has a scale+fade animation.

## Impact

**New dependency**: `tw-animate-css` (CSS-only, zero runtime JS).

**Files modified**: `src/index.css`, `src/components/ui/{Dialog,Popover,Tooltip,Toast}.tsx`, `src/components/CommandPalette.tsx`, `src/components/task-detail/TaskDetailPanel.tsx`, `src/components/memory-browser/MemoryBrowser.tsx`.
