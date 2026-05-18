## 1. PanelHeader Component

- [x] 1.1 Create `src/components/shared/PanelHeader.tsx` with `title`, `description?`, `filters?`, `actions?` slots; `px-5 py-4 border-b border-[--color-border] flex items-center justify-between` layout; extend from `ViewHelpHeader.tsx` pattern
- [x] 1.2 Mount `<PanelHeader title="Activity Feed" filters={<ActivityFilters />}>` in `ActivityFeed.tsx`
- [x] 1.3 Mount `<PanelHeader title="Memory" actions={…}>` in `MemoryBrowser.tsx`
- [x] 1.4 Mount `<PanelHeader title="Processes" actions={<re-analyze button>}>` in `ProcessBrowser.tsx`
- [x] 1.5 Mount `<PanelHeader title="Sessions">` in `SessionsTab.tsx`
- [x] 1.6 Mount `<PanelHeader title="Epic Progress">` in `EpicDashboard.tsx`
- [x] 1.7 Mount `<PanelHeader title="Worker Findings">` in `WorkerFindingsPanel.tsx`

## 2. Loading / Empty / Error State Pass

- [x] 2.1 `ActivityFeed.tsx` — replace `"Loading…"` with `<TaskRowSkeleton>` ×3; replace `"No activity yet"` with `<EmptyState>`; replace `String(error)` with `<ErrorState retry={refetch}>`
- [x] 2.2 `MemoryBrowser.tsx` — replace `"Loading…"` with skeleton rows; replace `"No memory entries."` (no namespace) and empty-namespace case with two distinct `<EmptyState>`s; replace `String(error)` with `<ErrorState retry={refetch}>`
- [x] 2.3 `ProcessBrowser.tsx` — replace both `"Loading…"` strings with spinner/skeleton; replace `"No processes"` / `"Select a process."` / `"No matching issues."` with `<EmptyState>` each; replace `String(error)` with `<ErrorState>`
- [x] 2.4 `SessionsTab.tsx` — replace `"Loading…"` with skeleton; replace empty case with `<EmptyState title="No sessions yet">`; replace `String(error)` with `<ErrorState>`
- [x] 2.5 `EpicDashboard.tsx` — replace `"Connect a project."` one-liner with `<EmptyState title="No project connected">`; add `<ErrorState>` for any fetch failure path
- [x] 2.6 `WorkerFindingsPanel.tsx` — replace the hardcoded slash-command string empty state with `<EmptyState>` using the same copy but structured

## 3. Tooltip / IconButton Pass

- [x] 3.1 `ActivityRow.tsx` — replace `title=` attributes with `<Tooltip>` wrappers
- [x] 3.2 `MemoryBrowser.tsx` — wrap Delete/Store/Refresh bare buttons with `<IconButton>` providing `aria-label`
- [x] 3.3 `ProcessBrowser.tsx` — wrap Re-analyze, Open in editor, Find issues buttons with `<IconButton>`
- [x] 3.4 `EpicDashboard.tsx:124` — add `<Tooltip>` to the validate pill explaining the validation state meaning
- [x] 3.5 `SessionsTab.tsx` — rename "Restore conversation context" button to "Copy session ID" (accurate), wrap with `<IconButton>` + Tooltip explaining clipboard action
- [x] 3.6 `WorkerFindingsPanel.tsx` — replace `title=` attribute on copy button with `<Tooltip>`
- [x] 3.7 `TaskList.tsx:400` — replace `title="Expand all"` raw attribute with `<IconButton>`

## 4. Toast Feedback Pass

- [x] 4.1 `MemoryBrowser.tsx` delete mutation — add `onSuccess` toast "Entry deleted" + `onError` toast
- [x] 4.2 `MemoryBrowser.tsx` store mutation — add `onSuccess` toast "Entry stored" + `onError` toast
- [x] 4.3 `EpicDashboard.tsx` claimTask mutation — add `onSuccess` toast "Task claimed" + `onError` toast
- [x] 4.4 `ProcessBrowser.tsx` re-analyze trigger — add toast "Re-analysis started" on dispatch
- [x] 4.5 `SessionsTab.tsx` clipboard copy — replace silent `.catch(() => {})` with `onSuccess` toast "Copied!" + `onError` toast "Copy failed"
- [x] 4.6 All remaining `.catch(() => {})` sites in `ChangeCard.tsx` (3×), `ChangesBrowser.tsx`, `layout/index.tsx`, `ShortcutModal.tsx`, `ProcessBrowser.tsx` — audit each; either add toast or add `// intentionally silent: <reason>` comment

## 5. Timestamp Consolidation

- [x] 5.1 `ActivityRow.tsx` — replace `toLocaleTimeString()` with `formatRelative(ts)`
- [x] 5.2 `MemoryBrowser.tsx` — replace `toLocaleString()` with `formatAbsolute(ts)`
- [x] 5.3 `SessionsTab.tsx` — inspect `snapshot.created_at` type; replace raw string render with `formatAbsolute(ts)`
- [x] 5.4 `CommentsSection.tsx` — replace `toLocaleDateString(…)` with `formatAbsolute(ts)`
- [x] 5.5 `ChangeCard.tsx` — replace custom relative helper with `formatRelative(ts)`
- [x] 5.6 `MemoryTrajectoryTab.tsx` — replace custom relative helper (`m/h/d`) with `formatRelative(ts)`
- [x] 5.7 `TaskDetailPanel.tsx` — replace inline date format with `formatAbsolute(ts)`
- [x] 5.8 `ReviewRow.tsx` — replace `toLocaleString()` with `formatAbsolute(ts)`
- [x] 5.9 `src/lib/worker-findings.ts` — replace `formatWorkerFindingDate` with `formatAbsolute`

## 6. Palette Consolidation

- [x] 6.1 `TaskListItem.tsx` — replace local `STATUS_BADGE` map with `STATUS_PALETTE` from `src/lib/palettes.ts`
- [x] 6.2 `StatusDropdown.tsx` — replace local `STATUS_COLORS` map with `STATUS_PALETTE`
- [x] 6.3 `ChangeCard.tsx` — replace local `STATUS_CONFIG` map with `STATUS_PALETTE`
- [x] 6.4 `MemoryTrajectoryTab.tsx` — replace inline outcome color map with `OUTCOME_PALETTE`
- [x] 6.5 `ImpactPanel.tsx` — replace `RISK_CLASS` map with `RISK_PALETTE`

## 7. Quality Gates

- [x] 7.1 Run `bun run typecheck` — zero errors
- [x] 7.2 Run `bun test` — all tests pass
- [x] 7.3 Run `bun run lint` — zero errors
- [x] 7.4 Visual review: open each of the six dashboards at 1280×800; verify PanelHeader present, no bare "Loading…" or one-line empties visible
- [x] 7.5 Trigger each mutation (delete memory entry, claim epic task, re-analyze, copy session context) and verify toast appears
- [x] 7.6 Hover every icon-only button in all six dashboards — tooltip appears within 300ms
- [x] 7.7 Run `openspec validate ui-dashboard-cohesion` — passes
