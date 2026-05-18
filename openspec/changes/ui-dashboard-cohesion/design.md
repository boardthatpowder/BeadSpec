## Context

After `ui-primitive-migration` lands, all components use the correct primitives but the six newer dashboards still feel "bolted on" compared to `ChangesBrowser` and `TaskDetailPanel`. The gap is visible in three dimensions: (1) structural — no consistent header with title/filters/actions, (2) state handling — bare text for loading/empty/error instead of designed components, (3) user feedback — mutations fire silently. This change closes all three gaps.

## Goals / Non-Goals

**Goals:**
- One `PanelHeader` component used by all six dashboards.
- Zero bare `"Loading…"` strings; all loading states use `<Skeleton>` or a spinner.
- Zero one-line empties; all empty states use `<EmptyState>`.
- Zero raw `String(error)` renders; all error states use `<ErrorState>`.
- All icon-only buttons have tooltips via `<IconButton>` or `<Tooltip>`.
- All mutations that currently fire silently get a success/error toast, or have a `// intentionally silent: <reason>` comment.
- All timestamp calls go through `formatRelative`/`formatAbsolute`.
- All color maps go through `STATUS_PALETTE`/`PRIORITY_PALETTE`/`RISK_PALETTE`/`OUTCOME_PALETTE`.

**Non-Goals:**
- New feature functionality.
- Changing the data model or IPC calls.
- Redesigning the layout of any dashboard (only header + state components added).
- Light mode.

## Decisions

### D1 — `PanelHeader` extends `ViewHelpHeader`, not replaces it

`src/components/shared/ViewHelpHeader.tsx` is a thin `<div>` with title + help text. The new `PanelHeader` extends that pattern with `filters` and `actions` slots and a `border-b border-[--color-border]` bottom separator. `ViewHelpHeader` stays for simpler contexts; `PanelHeader` is used when a view needs header actions or filters.

**PanelHeader API:**
```tsx
<PanelHeader
  title="Activity Feed"
  description="Recent workflow events"   // optional
  filters={<ActivityFilters />}           // optional
  actions={<Button>…</Button>}            // optional
/>
```

### D2 — Loading states: `<Skeleton>` for list views, spinner `<Icon name="Loader2">` for panels

- List views (MemoryBrowser entry list, ProcessBrowser step list): use `<TaskRowSkeleton>` repeated 3×.
- Panel/detail views (SessionsTab snapshot detail, EpicDashboard): use an animated `<Icon name="Loader2" className="animate-spin">` centered.
- ActivityFeed: uses `<TaskRowSkeleton>` rows.

### D3 — Empty states copy

Each dashboard gets a specific `<EmptyState>` with an appropriate lucide icon:

| View | Icon | Title | Description |
|---|---|---|---|
| ActivityFeed (no events) | `Activity` | "No activity yet" | "Events appear here as your team works." |
| ActivityFeed (filtered, no match) | `Filter` | "No matching events" | "Try adjusting your filters." |
| MemoryBrowser (no namespace selected) | `Database` | "Select a namespace" | "Choose a namespace from the sidebar to browse entries." |
| MemoryBrowser (namespace empty) | `Inbox` | "No entries" | "This namespace has no memory entries yet." |
| ProcessBrowser (no processes) | `GitBranch` | "No processes indexed" | "Run /gitnexus-cli to index the codebase." |
| ProcessBrowser (no issues match) | `Search` | "No matching issues" | "No issues reference this process step." |
| SessionsTab (no sessions) | `Clock` | "No sessions yet" | "Sessions appear after your first agent run." |
| EpicDashboard (no project) | `FolderOpen` | "No project connected" | "Connect a project to track epic progress." |
| WorkerFindingsPanel (no findings) | `CheckCircle` | "No findings" | "Run /audit, /ruflo-loop testgaps, or /ruflo-cost to generate findings." |

### D4 — Toast wiring: use the existing `useToast()` hook from `src/components/ui/Toast.tsx`

Each mutation that previously had `.catch(() => {})` or no feedback gets wrapped:
```tsx
const { toast } = useToast()
mutation.mutate(args, {
  onSuccess: () => toast({ title: 'Done', variant: 'success' }),
  onError: (e) => toast({ title: 'Failed', description: String(e), variant: 'error' }),
})
```

Sites that are intentionally silent (e.g., background polling that shouldn't interrupt) get `// intentionally silent: background poll`.

### D5 — Timestamp consolidation

Replace every inline `toLocaleString()`/`toLocaleDateString()`/`toLocaleTimeString()`/custom relative helper with:
- `formatRelative(ts)` — for "2 hours ago" style
- `formatAbsolute(ts)` — for "Jan 15, 2025" style
- `formatAbsolute(ts, { includeTime: true })` — for full datetime

Specific replacements:
- `ActivityRow.tsx` → `formatRelative`
- `MemoryBrowser.tsx` → `formatAbsolute`
- `SessionsTab.tsx` (raw `snapshot.created_at`) → `formatAbsolute`
- `CommentsSection.tsx` → `formatAbsolute`
- `ChangeCard.tsx` custom relative → `formatRelative`
- `MemoryTrajectoryTab.tsx` custom relative → `formatRelative`
- `worker-findings.ts` `formatWorkerFindingDate` → `formatAbsolute`

### D6 — Palette consolidation

Replace every inline color map with imports from `src/lib/palettes.ts`:
- `TaskListItem.tsx` `STATUS_BADGE` → `STATUS_PALETTE`
- `StatusDropdown.tsx` `STATUS_COLORS` → `STATUS_PALETTE`
- `ChangeCard.tsx` `STATUS_CONFIG` → `STATUS_PALETTE`
- `MemoryTrajectoryTab.tsx` outcome palette → `OUTCOME_PALETTE`
- `ImpactPanel.tsx` `RISK_CLASS` → `RISK_PALETTE`

## Risks / Trade-offs

**[Risk] `PanelHeader` visual rhythm shifts** — adding a header to views that previously had none changes their vertical layout. Confirm each dashboard still fits comfortably in the available height. → Check in `bun run dev` at 1280×800.

**[Risk] Toast noise on background operations** — if a background polling operation fires toasts frequently it becomes annoying. → Only add toasts to user-triggered mutations; keep background polls intentionally silent with a comment.

**[Risk] `SessionsTab` `created_at` format unknown** — `snapshot.created_at` is passed raw. Its actual format (ISO string, unix ms, or formatted string) needs verification before applying `formatAbsolute`. → Read the Tauri command return type before implementing.

## Migration Plan

1. Create `PanelHeader.tsx`, mount it on all six dashboards.
2. Loading/empty/error pass: hit each dashboard in order (ActivityFeed → MemoryBrowser → ProcessBrowser → SessionsTab → EpicDashboard → WorkerFindingsPanel).
3. Tooltip pass: grep for `title=` attributes on icon elements, replace with `<IconButton>` / `<Tooltip>`.
4. Toast pass: grep for `.catch(() => {})`, decide silent vs. toast per site.
5. Timestamp consolidation: grep for `toLocale` and `formatWorkerFindingDate`.
6. Palette consolidation: grep for `STATUS_BADGE`, `STATUS_COLORS`, `STATUS_CONFIG`, `RISK_CLASS`, inline outcome color maps.
7. Quality gates.

## Open Questions

None.
