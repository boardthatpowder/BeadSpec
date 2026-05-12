## 1. Store Actions

- [x] 1.1 Add `moveTab(srcPaneId: string, taskId: string, destPaneId: string, destIndex?: number)` action to `src/stores/workspace.ts`: remove taskId from srcPane.tabs, call `promoteToPinned` if tab was preview, insert at destIndex (or append) in destPane.tabs, collapse srcPane if empty via `collapseEmptyParents`, set destPane.activeTabId = taskId, set activePaneId = destPaneId
- [x] 1.2 Add `splitWithTab(srcPaneId: string, taskId: string, destLeafId: string, edge: 'left'|'right'|'top'|'bottom')` action to `src/stores/workspace.ts`: derive direction (left/right → horizontal, top/bottom → vertical) and position (left/top → first, right/bottom → second), call `splitLeaf(tree, destLeafId, direction, position)` to get new tree + newLeafId, remove taskId from srcPane and collapse if empty, insert taskId into newLeaf, set activePaneId = newLeafId
- [x] 1.3 Verify persistence: confirm both new actions write through the existing `workspacePersist` subscribe hook in `src/stores/workspacePersist.ts` without additional changes (no new persisted fields)

## 2. DnD Architecture: lift context to workspace root

- [x] 2.1 Remove `<DndContext>` and its `onDragEnd` / sensors from `src/components/workspace/TabBar.tsx`; keep `<SortableContext>` and `useSortable` hooks unchanged (intra-pane sort still works under a parent DndContext)
- [x] 2.2 Add a `WorkspaceDndProvider` component (or inline in `WorkspacePane.tsx` root render path) that wraps the workspace tree with a single `<DndContext sensors={...} onDragStart={...} onDragEnd={...}>` and a `<DragOverlay>` sibling
- [x] 2.3 Implement root `onDragEnd`: parse `over.id` string prefix → route to (a) intra-pane reorder (existing `reorderTab`), (b) `moveTab` for `tabbar:` or `tabslot:` targets on a different pane, (c) `splitWithTab` for `edge:` targets
- [x] 2.4 Track drag-active state (`isDragging: boolean`) via React context or a Zustand slice set in `onDragStart`/`onDragEnd`; export a `useDragActive()` hook consumed by edge zones
- [x] 2.5 Implement `<DragOverlay>` at root: render a ghost clone of the dragged `<Tab>` component using `activeId` from `onDragStart`

## 3. Tab Bar: register as cross-pane droppable

- [x] 3.1 Add `useDroppable({ id: 'tabbar:${paneId}' })` to `src/components/workspace/TabBar.tsx` so the entire tab bar area is a valid drop target (appends to end when tab dropped here from another pane)
- [x] 3.2 Add per-slot droppable gaps between tabs using `useDroppable({ id: 'tabslot:${paneId}:${index}' })` for positional insertion (small hit-area strips rendered between `<Tab>` elements)
- [x] 3.3 Apply a highlight style to the tab bar when `isOver` is true for either the bar-level or any slot droppable during a cross-pane drag

## 4. Edge Drop Zones on LeafPane

- [x] 4.1 Add four `useDroppable` edge zone `<div>` elements to `src/components/workspace/LeafPane.tsx`, one per edge (`edge:${paneId}:left`, `edge:${paneId}:right`, `edge:${paneId}:top`, `edge:${paneId}:bottom`); absolutely positioned, 20px wide/tall strips inset from the pane boundary
- [x] 4.2 Show edge zones only when `useDragActive()` returns true (CSS opacity/pointer-events transition)
- [x] 4.3 Apply a distinct highlight style (e.g. accent-coloured fill with directional arrow icon) when `isOver` is true for a given edge zone

## 5. Verification

- [ ] 5.1 Open ≥2 panes with ≥2 tabs each; drag a tab from pane A's tab bar to pane B's tab bar — verify tab moves to end of B, becomes active, A still contains its remaining tabs, state persists after reload
- [ ] 5.2 Drag a tab between two existing tabs in pane B — verify tab inserted at correct position
- [ ] 5.3 Drag the only tab in pane A to pane B — verify pane A collapses and pane B expands
- [ ] 5.4 Drag a tab to the right edge of pane B — verify horizontal split created, tab in new right pane, 50/50 sizes
- [ ] 5.5 Drag a tab to the bottom edge of pane B — verify vertical split created, tab in new bottom pane
- [ ] 5.6 Drag a preview (unpinned) tab to pane B — verify it arrives as pinned in pane B
- [ ] 5.7 Drag a tab and release outside all panes and edge zones — verify tab stays in original pane at original position
- [ ] 5.8 Drag a tab within the same pane — verify existing intra-pane reorder is unaffected
