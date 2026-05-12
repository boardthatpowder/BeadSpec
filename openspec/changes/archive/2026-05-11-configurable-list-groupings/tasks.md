## 1. Types & Core Logic

- [x] 1.1 Add `GroupConfig` discriminated union type to `src/lib/filterParser.ts`
- [x] 1.2 Add `GroupedSection` interface to `src/lib/filterParser.ts`
- [x] 1.3 Implement `groupTasks(tasks: Task[], config: GroupConfig): GroupedSection[]` in `src/lib/filterParser.ts`; handle null (flat), field (status/priority/assignee/task_type), and label-prefix cases; include empty sections for field grouping; multi-section for tasks with multiple matching labels
- [x] 1.4 Add `serializeGroupConfig(config: GroupConfig): string | null` helper
- [x] 1.5 Add `deserializeGroupConfig(s: string | null | undefined): GroupConfig` helper with graceful fallback to null
- [x] 1.6 Write unit tests for `groupTasks()`: flat pass-through, status grouping with empty sections, priority ordering, label-prefix multi-section, `(none)` bucket, deserialization of unrecognized values

## 2. HashStateContext: groupBy Field

- [x] 2.1 Add `groupBy?: string | null` to `AppHashState` interface in `src/hooks/useHashState.ts`
- [x] 2.2 Verify the existing JSON encode/decode round-trip in `useHashState` handles the new nullable field correctly (no change expected, but confirm)
- [x] 2.3 Add a `useGroupBy()` convenience hook (or inline in `TaskList`) that reads `state.groupBy` and calls `deserializeGroupConfig()` to return the typed `GroupConfig`

## 3. Tauri Store Persistence (layout.json)

- [x] 3.1 Confirm whether `@tauri-apps/plugin-store` is already in `package.json` and `src-tauri/Cargo.toml`; if absent, add it (`bun add @tauri-apps/plugin-store`, update `Cargo.toml`, register plugin in `src-tauri/src/lib.rs`)
- [x] 3.2 Create or extend `src/store/layoutStore.ts` with `readGroupBy(): Promise<string | null>` and `writeGroupBy(value: string | null): Promise<void>` using the Tauri store API targeting `layout.json`
- [x] 3.3 In `TaskList.tsx` (or a dedicated `useLayoutPersistence` hook), on mount: read `layout.json#groupBy`; if hash has no `groupBy` value, apply the stored value via `setState({ groupBy: stored })`
- [x] 3.4 On every `groupBy` state change, fire-and-forget write to `layout.json#groupBy`

## 4. Virtual List: Mixed-Item-Type Support

- [x] 4.1 Define the `VirtualListItem` discriminated union type: `{ type: 'header'; sectionKey: string; label: string; count: number; collapsed: boolean } | { type: 'task'; task: Task; flatIndex: number }` in `TaskList.tsx` (or a co-located types file)
- [x] 4.2 Implement `buildVirtualItems(sections: GroupedSection[], collapsed: Set<string>): VirtualListItem[]` — push header, then push task rows if section not collapsed, tracking `flatIndex` counter
- [x] 4.3 Update `useVirtualizer` call: replace `count: sorted.length` with `count: virtualItems.length`; update `estimateSize` to return `36` for header items and `54` for task items
- [x] 4.4 Update the `rowVirtualizer.getVirtualItems().map(...)` render loop to branch on `item.type`: render `GroupHeaderRow` for headers, existing `TaskListItem` for tasks
- [x] 4.5 Update keyboard navigation handlers (j/k, up/down arrows) to skip `GroupHeader` items and operate only on `TaskRow` items; use `flatIndex` for navigation tracking
- [x] 4.6 Update shift-click handler to use `flatIndex` instead of the raw `virtualItem.index`

## 5. FilterBar: Group-by Dropdown

- [x] 5.1 Add a `GroupByDropdown` component inside `FilterBar.tsx` (or as a separate file imported there); use the same `Popover` + trigger button pattern as `FilterPill`
- [x] 5.2 Populate the dropdown with: "None", divider "By field", Status / Priority / Assignee / Type, divider "By label prefix", then one item per non-structural prefix from `parseFilterDimensions(allLabels).dimensions` filtered to `isStructured` and excluding `branch`, `repo`, `worktree`, `worker`
- [x] 5.3 Selecting an option calls `setState({ groupBy: serializeGroupConfig(config) })`
- [x] 5.4 The dropdown trigger displays the active group name ("Status", "openspec", or "Group" when null)
- [x] 5.5 Add the `GroupByDropdown` to the FilterBar row 1 layout, after the "Filters" button

## 6. Section UI: GroupHeaderRow Component

- [x] 6.1 Create `GroupHeaderRow` component in `src/components/task-list/GroupHeaderRow.tsx` (or inline in `TaskList.tsx`): renders section label, count badge, "(N hidden)" when collapsed, and a chevron toggle button
- [x] 6.2 Chevron click calls `toggleCollapse(sectionKey)` which updates the `collapsed: Set<string>` state in `TaskList`
- [x] 6.3 Apply a consistent visual style: slightly different background from task rows (e.g. `bg-neutral-900/60`), left border accent, `text-xs font-semibold text-neutral-400`

## 7. Bulk Selection: Verify Across Group Boundaries

- [x] 7.1 Manually test: group by status, click task in "Open", shift-click task in "In Progress" — confirm tasks in both sections are selected and the count badge is correct
- [x] 7.2 Manually test: collapse "Blocked" section, shift-click across it — confirm collapsed tasks are NOT selected
- [x] 7.3 Manually test: with label-prefix grouping, select task that appears in two sections — confirm it appears in `selectedIds` exactly once

## 8. Manual Test Checklist

- [x] 8.1 Group by status: all four sections appear with correct counts; tasks move between sections on real-time sync; counts update without page reload
- [x] 8.2 Group by label-prefix "openspec": sections named after label suffixes; tasks with no openspec label appear in "(none)"; tasks with two openspec labels appear in two sections
- [x] 8.3 Collapse/expand: click header to collapse, tasks hide; click again to expand; "(N hidden)" badge shows correct count; scroll position remains stable
- [x] 8.4 URL hash persistence: group by status, copy URL, open in new tab → list opens grouped by status
- [x] 8.5 Layout store persistence: group by priority, do a full page reload (Cmd+R) → list reopens grouped by priority (hash is absent after reload; stored value is used)
- [x] 8.6 Reset to flat: select "None" from dropdown → flat list, no headers, "Group" label on trigger

## 9. Validate & Close

- [x] 9.1 Run `openspec validate configurable-list-groupings` and confirm all checks pass
- [x] 9.2 Close the `configurable-list-groupings` beads epic once all implementation issues are closed
