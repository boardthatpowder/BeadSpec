## 1. KpiBar Mode Switcher

- [x] 1.1 Add `mode: 'counts' | 'burndown' | 'velocity'` prop and internal state to `KpiBar`, defaulting to `'counts'`
- [x] 1.2 Append a compact `<select>` dropdown to the KPI bar right side for mode selection (labels: "Counts", "Burndown", "Velocity")
- [x] 1.3 On mode change, persist `kpiMode` to `layout.json` via `@tauri-apps/plugin-store` (`store.set` + `store.save`)
- [x] 1.4 On mount, read `kpiMode` from `layout.json` and apply as initial mode (default `'counts'` if key absent)
- [x] 1.5 In `counts` mode, render the existing status-count pills unchanged; in other modes, hide the pills and render the relevant chart

## 2. useBurndown Hook

- [x] 2.1 Create `src/hooks/useBurndown.ts` — accepts `changeLabel: string` (the OpenSpec change name without the `openspec:` prefix)
- [x] 2.2 Filter `allTasks` from `useTasks()` to those whose `labels` array includes `openspec:<changeLabel>`
- [x] 2.3 Issue one `useQuery(['task_history', project, taskId])` per matched task using `commands.getTaskHistory`; merge all `HistoryEntry[]` arrays into a single sorted list
- [x] 2.4 Walk the sorted entries: track running open and closed counts, group into daily ISO-date buckets, emit `{ date: string, open: number, closed: number }[]`
- [x] 2.5 Return `{ data, isLoading, isEmpty }` — `isEmpty` is true when matched tasks count is zero or all fetches return empty arrays

## 3. BurndownChart Component

- [x] 3.1 Create `src/components/filters/BurndownChart.tsx` — accepts `changeLabel: string`; renders a recharts `<ResponsiveContainer>` + `<LineChart>` with Open and Closed `<Line>` series
- [x] 3.2 Add change-selector dropdown above the chart: derive active change names from `openspec:*` labels on open tasks; pre-select the first; update `changeLabel` on selection
- [x] 3.3 Wire `<XAxis>` tick formatter to show sparse ISO date labels; `<YAxis>` starts at zero; `<Tooltip>` shows date, open, closed
- [x] 3.4 Render empty state "No change history yet" when `isEmpty` is true

## 4. useVelocity Hook

- [x] 4.1 Create `src/hooks/useVelocity.ts` — fetches `task_history` for all tasks in `allTasks` using the same cached per-task queries
- [x] 4.2 Filter entries to `field === 'status'` and `new_value === 'closed'`; group by ISO week (`getISOWeek` + `getISOWeekYear` from `date-fns`)
- [x] 4.3 Compute the 8 most recent ISO weeks relative to today; emit `{ weekLabel: string, count: number }[]` with zeros for missing weeks
- [x] 4.4 Return `{ data, isLoading }` — data always has exactly 8 elements

## 5. VelocityChart Component

- [x] 5.1 Create `src/components/filters/VelocityChart.tsx` — renders a recharts `<ResponsiveContainer>` + `<BarChart>` with a single green `<Bar>` series
- [x] 5.2 `<XAxis>` uses `weekLabel` values; `<YAxis>` starts at zero; `<Tooltip>` shows week label and count
- [x] 5.3 When all counts are zero, render a sub-label "No closures in the past 8 weeks" below the chart

## 6. KpiBar Chart Integration

- [x] 6.1 In `KpiBar`, conditionally render `<BurndownChart>` in `burndown` mode and `<VelocityChart>` in `velocity` mode
- [x] 6.2 Wrap chart render in a `<Suspense>` boundary with a skeleton fallback to handle async query loading
- [x] 6.3 Ensure the mode switcher dropdown remains visible in all three modes

## 7. Recharts Dependency

- [x] 7.1 Add `recharts` via bun (`bun add recharts`) and verify it appears in `package.json` and `bun.lockb`
- [x] 7.2 Confirm the Vite build completes without errors after adding recharts (run `bun run build` or `bun run typecheck`)

## 8. Manual Testing

- [x] 8.1 Switch from Counts → Burndown: verify chart renders with real data or shows empty state when no history
- [x] 8.2 Switch from Counts → Velocity: verify 8-week bar chart renders; zero bars appear for weeks with no closures
- [x] 8.3 Quit and relaunch the app; verify the KPI bar restores to the last selected mode
- [x] 8.4 When multiple active changes exist in Burndown mode, verify the change-selector dropdown appears and switching updates the chart

## 9. Validate & Close

- [x] 9.1 Run `openspec validate velocity-burndown` and confirm all checks pass
- [x] 9.2 Run `bun run typecheck` and resolve any TypeScript errors
- [x] 9.3 Close this change and push: `git push`
