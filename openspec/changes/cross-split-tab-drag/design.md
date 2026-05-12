## Context

Today every `TabBar` creates its own `<DndContext>` (TabBar.tsx:64). `@dnd-kit` requires all droppables and draggables participating in the same drag session to live under a single context, so cross-pane drops are structurally impossible today. The workspace renders a recursive `PaneNode` tree: `SplitPane` nodes hold two child `PaneNode`s; `LeafPane` nodes hold tabs. The Zustand store (`workspace.ts`) manages the tree and already provides `replaceLeaf` and `splitLeaf` pane-tree helpers in `paneTree.ts`.

## Goals / Non-Goals

**Goals:**
- Drag a tab from one pane's tab bar to another pane's tab bar to move it there.
- Drag a tab to a pane's edge (left/right/top/bottom) to create a new split containing only that tab.
- Preserve existing within-pane reorder behavior.
- Visual feedback: edge drop zones visible during drag, floating ghost tab during drag.

**Non-Goals:**
- Keyboard-driven cross-pane tab movement (separate accessibility concern).
- Dragging non-tab content (e.g. pane resize handles) — stays with `react-resizable-panels`.
- Multi-tab drag (only single-tab drag is in scope).
- Drop onto an already-pinned tab position (pinned vs preview semantics are preserved but pin promotion only applies on intra-pane drops as today).

## Decisions

### 1. Single root DnD context at `WorkspaceRoot`

Lift the `<DndContext>` from `TabBar` to `WorkspacePane` when rendering the root node (i.e. when `node === root`). All panes, tab bars, and edge zones become children of this single context. Per-pane `<SortableContext>` components remain in each `TabBar` for intra-pane sort order, as `useSortable` works correctly with a single ancestor `DndContext`.

**Alternative considered**: a React context + portal to teleport droppables into a shared context. Rejected — unnecessary complexity given the root is a natural mounting point.

### 2. Drop target IDs

Three namespaces, parsed in `onDragEnd`:

| Zone | ID format | Semantics |
|---|---|---|
| Tab bar (whole) | `tabbar:${paneId}` | Drop appended to end of target pane |
| Tab slot (between tabs) | `tabslot:${paneId}:${index}` | Drop before `index` in target pane |
| Edge | `edge:${paneId}:left\|right\|top\|bottom` | Split target pane; new leaf gets the tab |

Intra-pane sort collisions: `@dnd-kit` uses the draggable `id` (taskId) and sortable items' ids (other taskIds). These don't collide with the namespace-prefixed droppable ids above.

### 3. Edge drop zones

`LeafPane` renders four `<useDroppable>` edge strips (20px, absolutely positioned over each edge) that are only visible (opacity transition) when a drag is active. Drag-active state is read from a context value set by `onDragStart`/`onDragEnd` in the root `DndContext`. Edge zones have a higher z-index than the tab bar so they capture edge drops without activating tab-bar droppables.

### 4. New store actions

```
moveTab(srcPaneId, taskId, destPaneId, destIndex?)
  - remove taskId from srcPane.tabs
  - if srcPane becomes empty → collapseEmptyParents
  - insert taskId into destPane.tabs at destIndex (or append)
  - set destPane.activeTabId = taskId
  - set activePaneId = destPaneId

splitWithTab(srcPaneId, taskId, destLeafId, edge)
  - edge → direction/position:
      left  → horizontal split, new leaf goes first (left of destLeaf)
      right → horizontal split, new leaf goes second (right)
      top   → vertical split, new leaf goes first (above)
      bottom → vertical split, new leaf goes second (below)
  - call existing splitLeaf(tree, destLeafId, direction, position) → new tree
  - place taskId in the new empty leaf; remove from srcPane
  - if srcPane becomes empty → collapseEmptyParents
  - set activePaneId = newLeaf.id
```

Both actions reuse `replaceLeaf`, `splitLeaf`, and `collapseEmptyParents` from `paneTree.ts` — no new tree logic required.

### 5. Drag overlay

`<DragOverlay>` (from `@dnd-kit/core`, already installed) renders at the root DnD context level, showing a ghost clone of the dragged tab. This avoids layout shifts in the source tab bar during drag.

## Risks / Trade-offs

- **SortableContext + cross-pane drops**: `@dnd-kit/sortable`'s `onDragEnd` fires `arrayMove` only for items within the same `SortableContext`. We intercept in the root `onDragEnd` before any sortable callback and route to `moveTab`/`splitWithTab` when the drop crosses panes or hits an edge — so sortable's internal reorder fires only for intra-pane drops. This is a supported usage pattern.
- **Edge zone hit area conflicts with resize handles**: `react-resizable-panels` resize handles sit between panes. Edge zones are inset 20px from the `LeafPane` boundary, not from the split boundary, so they don't overlap resize handles.
- **Empty pane collapse during drag**: If the user drags the last tab out of a pane, `collapseEmptyParents` removes that pane from the tree. This fires after `onDragEnd` resolves so there's no mid-drag tree mutation.
- **Preview tab promotion**: Moving a preview tab cross-pane should promote it to pinned (same behavior as intra-pane reorder). `moveTab` will call `promoteToPinned` if `pinned[taskId]` is falsy in the source pane.
