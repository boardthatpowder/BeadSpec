## 1. Sub-tab scaffolding in `RufloMemoryPanel`

- [x] 1.1 Add `subTab: 'search' | 'trajectory'` state (default `'search'`) to `RufloMemoryPanel`. Reset to `'search'` in the `useEffect` that watches `taskId`.
- [x] 1.2 Refactor existing search state into a `searchTab` object (`{ status, results, hasOpened }`); add a parallel `trajectoryTab` object with `TrajectoryLoadState`.
- [x] 1.3 Render a 2-segment control (`[ Search ] [ Trajectory ]`) between the collapsible header and the content area when `open` is true.

## 2. `MemoryTrajectoryTab` component

- [x] 2.1 Create `src/components/task-detail/MemoryTrajectoryTab.tsx` accepting `{ taskId: string; title: string }` props.
- [x] 2.2 Implement `parseTrajectoryKey(key: string)` inline — splits on `|`, extracts `type:`, `outcome:`, `ts:`, `issue:`, `openspec:` segments; returns `null` if `type:` segment is missing or is not `'trajectory'`.
- [x] 2.3 Implement `outcomeChipClass(outcome?: string): string` — returns Tailwind class strings per the palette in Decision 5; neutral default for unknown outcomes.
- [x] 2.4 Implement lazy IPC fetch: on first mount-while-active, call `commands.rufloMemorySearch(\`${title} type:trajectory issue:${taskId}\`)`, parse all results via `parseTrajectoryKey`, keep only `type:trajectory` entries.
- [x] 2.5 Apply optional issue-id filter (keep only `issueId === taskId`); if that produces zero entries, fall back to the broader `type:trajectory` set.
- [x] 2.6 Sort entries by `ts` descending; push entries with undefined `ts` to the bottom.
- [x] 2.7 Render each row: relative timestamp (e.g. "2h ago") with absolute ISO string in `title` attribute; outcome chip; short preview (first 120 chars); expand-on-click full content (same expand-in-place idiom as Search).
- [x] 2.8 Render loading state ("Loading…"), error state ("Could not load memories"), and empty state (instructive blurb referencing `openspec-beads-work` skill) per Decision 6.

## 3. Search tab parity

- [x] 3.1 Verify all existing scenarios in `openspec/specs/ruflo-memory-panel/spec.md` are satisfied on the Search sub-tab after the sub-tab refactor. No behavioral change permitted.
- [x] 3.2 Confirm the Search tab's namespace exclusion (`session`, `default`) is preserved; confirm Trajectory tab does NOT apply that exclusion.

## 4. Tests

- [x] 4.1 Unit test for `parseTrajectoryKey`: (a) canonical key with all six segments returns all fields, (b) key missing `outcome:` segment returns `outcome: undefined`, (c) key missing `ts:` segment returns `ts: undefined`, (d) key with `type:retrospective` returns `null`, (e) malformed key with no `|` separators returns `null`.
- [x] 4.2 Unit test for `outcomeChipClass`: assert known outcomes return the expected Tailwind class string; assert an unrecognized string returns the neutral default class.
- [x] 4.3 Unit test for `formatRelative`: assert "just now" for 0 s, "Xm ago" for 30 min, "Xh ago" for 5 h, "Xd ago" for 3 d, ISO date for 60 d.
- [x] 4.4 Component test for `MemoryTrajectoryTab` with a mocked `rufloMemorySearch` returning a mix of trajectory and non-trajectory entries: assert only trajectory entries render and order is `ts`-descending.
- [x] 4.5 Component test for the strict-then-fallback filter: mock returns two entries with `type:trajectory` but only one with the matching `issue:` segment; assert both appear when the strict filter would reduce to one and the fallback kicks in (i.e. the broader set renders when strict is empty, not when strict is non-empty).
- [x] 4.6 Component test for empty state: mock returns zero trajectory entries — assert the instructive blurb appears.
- [x] 4.7 Component test for tab-reset behavior: render `RufloMemoryPanel`, switch to Trajectory, change `taskId` prop, assert `subTab` returns to `'search'` and trajectory cache is cleared.

## 5. Verification

- [x] 5.1 `bun tsc --noEmit` passes (no new TypeScript errors).
- [x] 5.2 `bun test` passes (all new unit and component tests green).
- [x] 5.3 Manual: in `bun tauri dev`, open an issue with at least one trajectory entry written by `obws_mem_write_trajectory`. Expand Related memories, switch to Trajectory tab, confirm the entry appears with outcome chip, relative timestamp, and preview. Click to expand; confirm full content visible.
- [x] 5.4 Manual: open a fresh issue with no trajectory entries; Trajectory tab shows the instructive empty-state blurb referencing `openspec-beads-work`.
- [x] 5.5 Manual: confirm Search tab still behaves identically to today — lazy fetch on first expand, label-augmented query, expand-in-place, namespace filter active, no sub-tab control visible until panel is opened.
- [x] 5.6 Manual: verify that navigating from an issue with trajectory history to a fresh issue resets the sub-tab to Search and clears both caches.
- [x] 5.7 `openspec validate memory-trajectory-timeline` passes.
