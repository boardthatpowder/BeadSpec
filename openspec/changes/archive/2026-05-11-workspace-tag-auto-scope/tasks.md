## 1. Call get_workspace_context at project connect

- [x] 1.1 Locate the project-connect action in `useProject.ts` (or Zustand project store) and call `invoke('get_workspace_context')` using the already-generated binding from `src/bindings.ts`
- [x] 1.2 Add a `workspaceContext: WorkspaceContext | null` field to the Zustand project store slice and populate it with the result before transitioning project state to "connected"
- [x] 1.3 Verify: open a git project and log `workspaceContext` from the store — should show `label_branch`, `label_worktree`, `label_repo` strings
- [x] 1.4 Verify: open a non-git project (or mock null return) — `workspaceContext` should be `null`

## 2. HashStateContext — add workspaceScope field

- [x] 2.1 Add `workspaceScope: 'on' | 'off'` to the `HashStateContext` type definition in `src/contexts/HashStateContext.tsx`
- [x] 2.2 Implement serialisation: write `workspaceScope` to the URL hash key (default `'on'`, omit from hash when `'on'` to keep URLs clean, include when `'off'`)
- [x] 2.3 Implement deserialisation: read the hash key on mount and on `hashchange` events; fall back to `'on'` when key is absent
- [x] 2.4 Verify: toggle scope off → URL hash gains `workspaceScope=off`; toggle on → key is removed from hash; refresh → state restored correctly

## 3. filterParser.ts — workspace AND-filter

- [x] 3.1 Add a `workspaceFilter` parameter to `filterParser.ts` (or the filter-pipeline entry point) accepting `{ labels: string[]; enabled: boolean }`
- [x] 3.2 When `enabled` is `true`, apply an AND-filter that requires each label in `labels` to be present on the task before any user filters run
- [x] 3.3 When `enabled` is `false` or `labels` is empty, skip the workspace filter entirely
- [x] 3.4 Verify: write a unit test covering scope-on (task with all three labels passes), scope-on (task missing one label excluded), scope-off (all tasks pass)

## 4. FilterBar — workspace scope chip

- [x] 4.1 In `src/components/filters/FilterBar.tsx`, read `workspaceContext` from the project store and `workspaceScope` from `HashStateContext`
- [x] 4.2 Render a "Workspace scope" chip as the leftmost element in FilterBar when `workspaceContext` is non-null; hide it when `workspaceContext` is null
- [x] 4.3 Style the chip with a distinct background tint (e.g., `bg-blue-100 text-blue-800 border-blue-300`) to visually differentiate it from user filter chips
- [x] 4.4 When `workspaceScope` is `'off'`, render the chip with `opacity-50` and a visual indicator (e.g., strikethrough label or greyed icon) communicating inactive state
- [x] 4.5 Wire the chip's `onClick` handler to toggle `workspaceScope` between `'on'` and `'off'` via `HashStateContext`
- [x] 4.6 Verify: chip appears on git project open; click toggles opacity; click again restores; chip absent on non-git project

## 5. No-flash guarantee — connect workspaceFilter to TaskList

- [x] 5.1 Ensure `TaskList` (or its parent) reads `workspaceContext` and `workspaceScope` from the store synchronously at mount and passes them to `filterParser` before returning JSX
- [x] 5.2 Verify there is no intermediate render of the unfiltered task list: use React DevTools or add a render counter to confirm TaskList renders once with the filter already active
- [x] 5.3 Confirm that when `workspaceScope=off` is in the URL hash on initial load, the first render shows all tasks (correct, not a bug)

## 6. Manual end-to-end test

- [x] 6.1 Open a git worktree project; confirm "Workspace scope" chip appears with blue tint and task list is pre-filtered to workspace labels
- [x] 6.2 Click the chip to toggle off; confirm chip dims, task list shows all tasks across all projects
- [x] 6.3 Click the chip again to re-enable; confirm list returns to scoped view
- [x] 6.4 Refresh the app with scope off; confirm chip stays dimmed and list remains unscoped
- [x] 6.5 Open a non-git project; confirm chip is absent and all tasks are shown

## 7. Validate and close

- [x] 7.1 Run `openspec validate workspace-tag-auto-scope` and confirm all checks pass
- [x] 7.2 Close BUI-v6lp issue via `bd close BUI-v6lp`
