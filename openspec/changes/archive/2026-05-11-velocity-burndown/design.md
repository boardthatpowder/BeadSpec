## Context

`KpiBar` (`src/components/filters/KpiBar.tsx`) currently renders a fixed row of status-count buttons. It drives filtering but conveys no trend information. The app already has `@tanstack/react-query` caching task history via `commands.getTaskHistory`, and `@tauri-apps/plugin-store` for layout persistence (`layout.json`). Recharts is not yet a dependency but is the lowest-friction charting library for a React 19 / Vite / Tailwind v4 stack.

## Goals / Non-Goals

**Goals:**
- Add `counts | burndown | velocity` mode switching to `KpiBar` without breaking the existing counts view
- Derive burndown and velocity data entirely client-side from the existing `task_history` TanStack Query cache — no new Tauri commands
- Persist selected mode to `layout.json` so it survives app restarts
- Graceful empty states: no data → placeholder message, insufficient weeks → zero bars

**Non-Goals:**
- New Tauri backend commands or SQL queries
- Chart export / print
- More than 8 weeks of velocity history
- Per-assignee or per-priority breakdown charts

## Decisions

### Decision: Mode prop on KpiBar with compact dropdown switcher

`KpiBar` gains a `mode` prop (`'counts' | 'burndown' | 'velocity'`) and a compact dropdown appended to the right of the existing pill row. In `counts` mode the component renders identically to today. In `burndown` or `velocity` mode the status pills are hidden and the relevant chart fills the bar's horizontal space. The switcher is always visible.

**Alternatives considered:**
- Separate page/route for charts: too much navigation friction for a quick progress check.
- Tab bar above the task list: takes vertical space away from the task list.

The inline switcher keeps the KPI bar compact and the chart contextual.

### Decision: useBurndown — client-side aggregation from task_history cache

`useBurndown(changeLabel: string)` uses `useQuery` to fetch `task_history` for every task in `allTasks` that carries the label `openspec:<changeLabel>`. It aggregates the resulting `HistoryEntry[]` arrays by day to compute a running open/closed count series.

Algorithm:
1. Filter `allTasks` to those whose `labels` array includes `openspec:<changeLabel>`.
2. For each matched task, call `commands.getTaskHistory(project, taskId)` — already cached by TanStack Query with key `['task_history', project, taskId]`.
3. Sort all history entries by `timestamp`.
4. Walk entries in order: a `status_change` entry with `new_value === 'closed'` increments the closed counter; `new_value !== 'closed'` after a prior closed value decrements the closed counter (re-open). Track open = total − closed.
5. Group into daily buckets (ISO date string) and emit `{ date, open, closed }[]`.
6. If no tasks match the label, return `[]` (triggers empty state in the chart).

`changeLabel` is derived from the active-changes dropdown: enumerate all distinct `openspec:*` labels present on open tasks in `allTasks`.

### Decision: useVelocity — ISO-week bucketing of closure events

`useVelocity()` fetches `task_history` for all tasks in `allTasks` (using the same per-task cached queries), filters entries where `field === 'status'` and `new_value === 'closed'`, groups by ISO week (`date-fns/getISOWeek` + `getISOWeekYear`), and returns the past 8 ISO weeks (Sunday-to-Saturday) as `{ weekLabel: string, count: number }[]`. Weeks with no closures emit `count: 0`. The 8-week window is computed at call time relative to today.

### Decision: recharts LineChart for burndown, BarChart for velocity

Recharts is the most widely adopted React charting library with native support for responsive containers, custom tooltips, and tick formatters. It is tree-shakeable, so only the components imported are bundled.

- `BurndownChart`: `<ResponsiveContainer>` → `<LineChart>` with two `<Line>` series (open: neutral, closed: green), `<XAxis>` (date label, sparse ticks), `<YAxis>`, `<Tooltip>`, `<Legend>`.
- `VelocityChart`: `<ResponsiveContainer>` → `<BarChart>` with a single `<Bar>` (closed per week, green fill), `<XAxis>` (week label), `<YAxis>`, `<Tooltip>`.

Both charts use Tailwind CSS color variables (`--color-green-400`, `--color-neutral-400`) to stay consistent with the app theme.

### Decision: Change selector dropdown for burndown mode

When multiple distinct `openspec:*` labels exist on open tasks, `BurndownChart` renders a compact `<select>` above the chart to pick the active change. The selected change is local component state (not persisted). On first render the first active change label is pre-selected. If zero active changes exist, the chart shows "No active changes" placeholder.

### Decision: kpiMode persisted in layout.json via Tauri store

Mode is read on mount with `store.get('kpiMode')` (defaulting to `'counts'`) and written on change with `store.set('kpiMode', mode)` + `store.save()`. The store instance is obtained via `load('layout.json')` from `@tauri-apps/plugin-store`, consistent with how pane sizes are already persisted in this project.

## Risks / Trade-offs

- **N+1 history fetches**: fetching task history per-task could fire many queries on a large project. Mitigation: TanStack Query deduplicates and caches; `staleTime` of 60 s keeps re-renders cheap. If the project grows beyond ~500 tasks a batch history endpoint should be added, but that is out of scope here.
- **recharts bundle size**: recharts adds ~100 KB gzipped. Acceptable for a desktop Tauri app where bundle size is less critical than a web app.
- **Tailwind v4 CSS variables**: recharts uses inline `stroke`/`fill` props; must pass raw color strings (e.g., `#4ade80`) rather than Tailwind class names. Use a small color-constants map rather than `getComputedStyle` to avoid layout thrash.

## Open Questions

- Should velocity count re-openings as negative velocity? Current design does not; only net-new closures per week are counted. This is consistent with common burndown conventions and keeps the chart positive.
