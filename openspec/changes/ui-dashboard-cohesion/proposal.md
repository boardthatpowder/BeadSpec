## Why

The six recently-added dashboards (ActivityFeed, MemoryBrowser, ProcessBrowser, SessionsTab, EpicDashboard, WorkerFindingsPanel) were built quickly and diverge noticeably from the polish standard of `ChangesBrowser` and `TaskDetailPanel`. They show bare `"Loading…"` strings instead of skeletons, one-line empties instead of guided empty states, raw `String(error)` instead of recoverable error surfaces, and silent mutations with no feedback. This change brings all six up to the same standard using the primitives from `ui-design-foundation`.

## What Changes

- Extract `src/components/shared/PanelHeader.tsx` from the `ChangesBrowser` header pattern and apply it to all six dashboards.
- Replace all bare `"Loading…"` strings with `<Skeleton>` (existing from `ui-design-foundation`).
- Replace all one-line empty states with `<EmptyState icon title description action>`.
- Replace all `String(error)` / `{String(error)}` renders with `<ErrorState title description retry={refetch}>`.
- Wrap all bare icon-only buttons in `<IconButton>` (or `<Tooltip>`) so they have accessible labels and hover tooltips.
- Wire `useToast()` into silent mutations: MemoryBrowser delete/store, EpicDashboard claimTask, ProcessBrowser re-analyze, SessionsTab clipboard copy. All swallowed `.catch(() => {})` sites either surface via toast or receive a code comment justifying silence.
- Route all timestamp calls through `formatRelative` / `formatAbsolute` from `src/lib/format/date.ts`.
- Route all status/priority/risk/outcome color maps through the palettes from `src/lib/palettes.ts`.

## Capabilities

### New Capabilities

- `panel-header-standard`: A shared `PanelHeader` component (`src/components/shared/PanelHeader.tsx`) used by all standalone dashboard views, providing consistent title, description, filter, and action slots with a bottom border.

### Modified Capabilities

- `bd-health-panel`: SessionsTab gains feedback toasts on clipboard copy; snapshot drawer behavior unchanged. WorkerFindingsPanel bare `title=` replaced with Tooltip.
- `ruflo-memory-panel`: MemoryBrowser gains toast on delete/store mutations, EmptyState for empty namespace, ErrorState for load failures.
- `notifications`: EpicDashboard gains toast on claimTask mutation.

## Impact

**Files created**: `src/components/shared/PanelHeader.tsx`.

**Files modified**: `src/components/activity-feed/{ActivityFeed,ActivityRow}.tsx`, `src/components/memory-browser/MemoryBrowser.tsx`, `src/components/process-browser/ProcessBrowser.tsx`, `src/components/health/{SessionsTab,WorkerFindingsPanel,ReviewsHealthTab,BdHealthPanel}.tsx`, `src/components/epic-dashboard/EpicDashboard.tsx`, `src/components/task-detail/{TaskDetailPanel,MemoryTrajectoryTab,ImpactPanel,CommentsSection,ActivityTimeline}.tsx`, `src/components/changes-browser/ChangeCard.tsx`, `src/components/task-list/TaskListItem.tsx`, `src/components/task-detail/StatusDropdown.tsx`.

**Prerequisite**: `ui-primitive-migration` (Phase 2) should be complete so `<IconButton>` and `<Icon>` are already in use before wrapping them in Tooltips.
