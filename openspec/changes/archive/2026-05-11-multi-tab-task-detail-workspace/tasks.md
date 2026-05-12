## 1. Dependencies and Scaffolding

- [x] 1.1 Add `react-resizable-panels`, `@dnd-kit/core`, and `@dnd-kit/sortable` to `package.json` via `bun add`; confirm Zustand 5 is already present.
- [x] 1.2 Create empty module skeletons: `src/stores/workspace.ts`, `src/utils/paneTree.ts`, and the `src/components/workspace/` directory.
- [x] 1.3 Verify `bun run build` and `bun run tsc --noEmit` pass with the empty modules wired in but not yet referenced.

## 2. Pane Tree Helpers (pure, test-first)

- [x] 2.1 In `src/utils/paneTree.ts` define `LeafPane`, `SplitPane`, `PaneNode` types as a discriminated union with `kind`.
- [x] 2.2 Implement `findLeaf(root, paneId)` and `replaceLeaf(root, paneId, fn)` as pure tree rewrites returning new immutable trees.
- [x] 2.3 Implement `splitLeaf(root, paneId, direction)` that wraps the target leaf in a `SplitPane` with a fresh empty sibling leaf and initial 50/50 sizes.
- [x] 2.4 Implement `collapseEmptyParents(root)` that, given a tree, removes any non-root empty leaf whose collapse was just triggered (carrying a transient `collapseHint` flag set by the caller); root leaf is never removed.
- [x] 2.5 Implement `nextTabAfterClose(leaf, closedTabId)` returning the right neighbor's id, else left neighbor's id, else `null`.
- [x] 2.6 Write Vitest coverage in `src/utils/paneTree.test.ts` covering: split-then-find, replace-leaf-immutability, collapse via close-batch only, root-leaf never removed, next-tab-after-close ordering.
- [x] 2.7 Run `bun run test src/utils/paneTree.test.ts` and confirm all cases pass.

## 3. Workspace Store

- [x] 3.1 Create `src/stores/workspace.ts` with a typed Zustand store holding `{ root, activePaneId, recentlyClosed }`. Use `crypto.randomUUID()` for pane ids.
- [x] 3.2 Implement actions: `openPreview`, `openPinned`, `promoteToPinned`, `closeTab`, `closeOthers`, `closeToRight`, `closeAll`, `reorderTab`, `splitPane`, `setActivePane`, `setActiveTab`, `reopenLast`, `updateSplitSizes`, `setInnerSubTab` (keyed by `(paneId, taskId)`).
- [x] 3.3 Bound `recentlyClosed` to 20 entries (FIFO drop oldest).
- [x] 3.4 Implement a debounced (~250 ms trailing) persistence adapter wrapping `@tauri-apps/plugin-store` writes to `layout.json` under the `workspace` key. Reads on cold boot are synchronous-on-mount; absent/invalid persisted state falls back to a single empty leaf root and logs `console.warn`.
- [x] 3.5 Implement boot-seed: after loading persisted state, if root leaf has zero tabs and `useHashState` reports a `taskId`, call `openPreview(taskId)`.
- [x] 3.6 Write `src/stores/workspace.test.ts` covering: `openPreview` twice keeps tab count at 1; `openPreview` + `promoteToPinned` + `openPreview` yields 2 tabs; `closeOthers` triggers `collapseEmptyParents` only when appropriate; `reopenLast` restores at original index when pane exists.
- [x] 3.7 Run `bun run test src/stores/workspace.test.ts` and confirm all cases pass.

## 4. Hash Bridge

- [x] 4.1 Modify `src/hooks/useHashState.ts` (and/or `src/contexts/HashStateContext.tsx`) to expose a one-way effect: when the active pane's `activeTabId` changes, update the hash via `history.replaceState` (no `pushState`).
- [x] 4.2 On initial mount, read the hash once and pass its `taskId` to `workspace.openPreview` if the workspace is empty.
- [x] 4.3 Verify browser back/forward against a manually constructed hash URL still routes to the right task as a preview tab.

## 5. Visual Primitives (Tailwind, no Radix)

- [x] 5.1 Build `src/components/workspace/Tab.tsx`: renders title + close ×; preview style = italic + `bg-neutral-900/20`; pinned style = upright + `bg-neutral-900/60`; supports dblclick → promote, middle-click → close, right-click → open context menu.
- [x] 5.2 Build `src/components/workspace/TabContextMenu.tsx`: portal-rendered absolutely-positioned menu with items Close / Close Others / Close to the Right / Close All / Split Right / Split Down; dismiss on Escape and outside click via a shared `useDismissable` hook.
- [x] 5.3 Build `src/components/workspace/TabBar.tsx`: horizontal scrollable strip wrapping tabs in `@dnd-kit` `SortableContext`; on drag-end call `workspace.reorderTab`; on drag a preview tab call `promoteToPinned` first.
- [x] 5.4 Build `src/components/workspace/LeafPane.tsx`: composes `TabBar` + `TaskDetailPanel` (passing `taskId` from `activeTabId`); renders empty-state placeholder when no tabs; renders a 2px accent border when this leaf is the active pane; on any click anywhere in the body call `workspace.setActivePane`.
- [x] 5.5 Build `src/components/workspace/SplitContainer.tsx` using `react-resizable-panels` `PanelGroup` / `Panel` / `PanelResizeHandle`; `onLayout` callback writes sizes back via `workspace.updateSplitSizes`.
- [x] 5.6 Build `src/components/workspace/WorkspacePane.tsx`: recursive renderer dispatching on `node.kind` — leaf → `LeafPane`, split → `SplitContainer` wrapping recursive `WorkspacePane` children.

## 6. TaskDetailPanel Controlled Refactor

- [x] 6.1 Change `TaskDetailPanel` signature in `src/components/task-detail/TaskDetailPanel.tsx` to accept `{ taskId: string; paneId: string }`. Replace `const state = useAppState()` reads with the prop.
- [x] 6.2 Move the internal `activeTab` (`details`/`dependencies`/`activity`) state out of `useState` and into the workspace store via `setInnerSubTab(paneId, taskId, tab)`; read via a selector.
- [x] 6.3 Wire promote-on-edit: for every field mutation handler (title save, status change, priority change, assignee change, label add/remove, comment submit) and on the first content-change event from TipTap (not focus, not cursor), call `workspace.promoteToPinned(taskId)` before dispatch.
- [x] 6.4 Add a TipTap `onUpdate` filter that only fires promote when `editor.getJSON()` differs from the loaded server value (cursor moves and focus alone do not promote). Cover with a Vitest test against a TipTap test instance.

## 7. TaskList Wiring

- [x] 7.1 In `src/components/task-list/TaskList.tsx`, change the plain-click handler to call `workspace.openPreview(taskId)` instead of `setState({ taskId })`.
- [x] 7.2 Add a double-click handler on rows that calls `workspace.openPinned(taskId)`.
- [x] 7.3 Change the Arrow Up/Down handler to call `workspace.openPreview(taskId)` for the newly focused row.
- [x] 7.4 Change the `Enter` handler to call `workspace.openPinned(taskId)` for the focused row.
- [x] 7.5 Leave `j`/`k` (focus-only) and shift-click (bulk select) handlers unchanged.

## 8. Layout Shell Integration

- [x] 8.1 In `src/components/layout/index.tsx`, replace the `DetailPanel` wrapper around `TaskDetailPanel` with `<WorkspacePane node={root} />` driven by a workspace-store selector.
- [x] 8.2 Confirm the existing left-list resizable divider continues to write `taskListWidth` to `layout.json` and is untouched by the new workspace store.
- [x] 8.3 Verify empty workspace renders the placeholder instead of a crash.

## 9. Keyboard Shortcuts

- [x] 9.1 Create `src/hooks/useWorkspaceShortcuts.ts` registering via `react-hotkeys-hook`: `mod+w` close active tab, `mod+shift+t` reopen, `mod+\` split right, `mod+shift+\` split down, `ctrl+tab` / `ctrl+shift+tab` next/prev tab, `mod+1`..`mod+9` jump to tab N.
- [x] 9.2 Mount the hook once near the workspace root.
- [x] 9.3 Extend the existing shortcut reference modal (from `layout-shell`) with the new workspace shortcuts under a "Workspace" section with platform-correct labels.

## 10. Unsaved-Changes Prompt

- [x] 10.1 Add a "dirty tabs" registry on the workspace store: each `LeafPane` tab can report `isDirty` (driven by `TaskDetailPanel`'s TipTap onUpdate diff against server state).
- [x] 10.2 Block `closeTab` / `closeOthers` / `closeToRight` / `closeAll` when affected tabs are dirty, showing a "Save / Discard / Cancel" dialog. On Save: persist edits before closing. On Discard: close anyway. On Cancel: no-op.
- [x] 10.3 Hook into the Tauri window close event so the same prompt fires once before app exit, listing all affected tabs.

## 11. Empty / Close-Pane Affordance

- [x] 11.1 In `LeafPane`, when `tabs.length === 0` render "Select a task to open" centered placeholder.
- [x] 11.2 If the empty leaf is not the root, render a "Close pane" secondary button under the placeholder that calls `workspace.closePane(paneId)`.
- [x] 11.3 In `workspace.closePane`, remove the empty leaf and unwrap the parent `SplitPane` (the surviving sibling replaces the parent).

## 12. End-to-End Verification

- [x] 12.1 Run `bun run tauri dev`; arrow-key through the task list and confirm the tab bar shows a single italic preview tab that swaps as you move.
- [x] 12.2 Single-click then double-click the same row; confirm the tab flips from italic to upright (preview → pinned) and the tab does not duplicate.
- [x] 12.3 Pin three tabs, drag-reorder them, reload the app; confirm order is restored from `layout.json`.
- [x] 12.4 Right-click a tab in the middle of a row of five and pick "Close to the Right"; confirm only the first three remain.
- [x] 12.5 Press `Cmd+\` (or `Ctrl+\`) to split right; click a list row and confirm it opens in the focused (new) pane only. Drag the resize handle and reload; sizes persist.
- [x] 12.6 `Cmd+W` then `Cmd+Shift+T`; confirm the tab returns to the same pane at its original index, with its preview/pinned state preserved.
- [x] 12.7 Copy the URL, paste into a fresh window; confirm filters + taskId restore and the task opens as a preview tab.
- [x] 12.8 Make an unpersisted edit to a description, close the tab; confirm the Save/Discard/Cancel prompt appears and each branch behaves correctly.
- [x] 12.9 Run `bun run tsc --noEmit && bun run build` and confirm both succeed.
- [x] 12.10 Run `bun run test` and confirm the `paneTree` and `workspace` store suites pass.
