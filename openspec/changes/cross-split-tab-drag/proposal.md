## Why

The workspace supports multiple panes and splits but there is no way to move a tab between panes by dragging — the only cross-pane actions are keyboard shortcuts and context menus. Drag-to-move and drag-to-split makes pane management fluid and matches the muscle-memory users bring from VS Code and similar editors.

## What Changes

- Tabs can be dragged from one pane's tab bar and dropped onto another pane's tab bar to move them there.
- A tab dragged to a pane's left, right, top, or bottom edge creates a new split containing only that tab (VS Code-style edge drop).
- The existing "drop outside source pane = cancel" behaviour is replaced by cross-pane move/split logic; cancel only fires when the drop target is neither a tab bar nor an edge zone.
- DnD context is lifted from per-pane `TabBar` up to the workspace root so all panes participate in a single drag session.
- Reorder-within-pane logic is preserved unchanged.

## Capabilities

### New Capabilities
- `cross-split-tab-drag`: Cross-pane tab movement and edge-drop split-creation via drag and drop.

### Modified Capabilities
- `task-workspace`: The "Drag to Reorder Tabs Within a Pane" requirement's scenario for drops outside the source pane changes from "cancel" to "move or split based on drop target."

## Impact

- **Frontend components**: `src/components/workspace/TabBar.tsx` (DnD context removed, per-pane droppable added), `src/components/workspace/LeafPane.tsx` (edge drop zones added), `src/components/workspace/WorkspacePane.tsx` (root DnD context added).
- **State**: `src/stores/workspace.ts` (new `moveTab` and `splitWithTab` actions), `src/utils/paneTree.ts` (reuses existing `replaceLeaf`/`splitLeaf` helpers).
- **Persistence**: `src/stores/workspacePersist.ts` — no new persisted fields; existing layout.json already captures the tree.
- **Dependencies**: `@dnd-kit/core` and `@dnd-kit/sortable` already installed — no new packages.
- **No backend / IPC changes.**
