## Why

The KPI bar shows static task counts (open / in-progress / blocked / closed) but gives no sense of trend or forward progress. There is no way to see whether a change is closing faster or slower than it opened, and no project-level view of weekly throughput. Developers working across multiple active OpenSpec changes must query the CLI to know how much work remains on each.

## What Changes

- Extend `KpiBar` with a compact mode switcher: `counts` (current behaviour, unchanged), `burndown` (per-change line chart), `velocity` (project bar chart)
- Add `useBurndown(changeLabel)` hook: derives open/closed-per-day series from the existing `task_history` cache for all issues tagged with a given OpenSpec label
- Add `BurndownChart` component: recharts `LineChart` with a change-selector dropdown when multiple active changes are present; shows empty state when no history exists
- Add `useVelocity()` hook: counts status-→-closed events per ISO week for the past 8 weeks from the existing `task_history` cache
- Add `VelocityChart` component: recharts `BarChart` with 8-week x-axis; zero bars for weeks with no data
- Persist selected mode to `layout.json` under the key `kpiMode` via `@tauri-apps/plugin-store`
- Add `recharts` dependency (if absent)
- No new Tauri commands: all data is derived client-side from the existing TanStack Query task-history cache

## Capabilities

### New Capabilities

- `velocity-burndown`: KPI bar mode switcher with burndown and velocity chart views

### Modified Capabilities

- `layout-shell`: KPI bar mode switching and `kpiMode` persistence across sessions

## Impact

- `src/components/filters/KpiBar.tsx` — extended with `mode` prop and mode switcher control
- `src/components/filters/BurndownChart.tsx` — new recharts LineChart component
- `src/components/filters/VelocityChart.tsx` — new recharts BarChart component
- `src/hooks/useBurndown.ts` — new hook
- `src/hooks/useVelocity.ts` — new hook
- `package.json` / `bun.lockb` — `recharts` dependency (added if absent)
- Out of scope: new Tauri commands, backend schema changes, export or print of charts
