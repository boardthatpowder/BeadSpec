# Proposal: Multi-Tab Task Detail Workspace

## Why

Today the right-hand detail pane shows exactly one task at a time, driven by a single `taskId` in the URL hash (see `TaskDetailPanel` and `useHashState`). Users have no way to keep multiple tasks open while skimming, comparing dependencies, or referencing a parent issue — every click destroys the previous context. This is the most-requested workflow gap relative to IDEs (Zed, VSCode) that the team already lives in.

The goal is to turn the detail pane into an IDE-style workspace: light-touch *preview* tabs while skimming, *pinned* tabs when the user commits, full tab-bar management, and split panes so two (or more) tasks can sit side-by-side. Workspace layout persists across reloads so users return to the same working set.

## What Changes

- **NEW**: A workspace pane that hosts multiple `TaskDetailPanel` instances in a tab/split tree, replacing the single-detail-panel slot in the layout shell.
- **NEW**: Preview-tab semantics — single-click on a list row or arrow-key navigation opens the task in a transient preview tab (italic, replaces existing preview). Double-click, `Enter`, double-click on the tab, or first edit promotes it to a pinned tab.
- **NEW**: Tab management — close, close others, close to the right, close all (via right-click context menu + middle-click + `Cmd+W`), drag-to-reorder within a pane, reopen recently closed (`Cmd+Shift+T`, bounded stack).
- **NEW**: Split panes — split right and split down create a sibling pane with its own tab group; each split is independently resizable; empty panes auto-collapse.
- **NEW**: Per-tab inner-tab memory — the existing details/dependencies/activity sub-tabs inside `TaskDetailPanel` remember their state per workspace tab.
- **NEW**: Workspace persistence — full pane tree (tabs, pinned flags, active tab per pane, split direction/sizes, recently-closed stack) round-trips through the existing Tauri `plugin-store` (`layout.json`).
- **MODIFIED**: `TaskList` click/arrow/Enter handlers route through workspace store actions instead of writing `taskId` directly to the hash.
- **MODIFIED**: `TaskDetailPanel` becomes a controlled component (accepts `taskId` as a prop) instead of reading the hash state.
- **MODIFIED**: `useHashState` continues to expose `taskId` for deep-link compatibility, but it now mirrors the active tab in the focused pane and seeds the workspace on cold boot if no persisted workspace exists.
- **MODIFIED**: Unsaved-changes prompt becomes per-tab, triggered when closing a tab (or the app) with dirty editor content.

## Capabilities

### New Capabilities

- `task-workspace`: Tabbed and splittable workspace that hosts one or more `TaskDetailPanel` instances. Defines preview vs. pinned tab semantics, tab-management actions, split-pane tree structure, drag-to-reorder behavior, recently-closed stack, keyboard shortcuts, and Tauri-store persistence shape.

### Modified Capabilities

- `layout-shell`: The right-side detail region is no longer a single `TaskDetailPanel` — it is a `WorkspacePane` that renders the workspace tree. Layout persistence (`layout.json`) gains a `workspace` key alongside the existing `taskListWidth`. Deep-link hash behavior is preserved (the hash continues to encode the active tab's `taskId`), and on cold boot a hash-supplied `taskId` seeds a single preview tab.
- `task-detail`: `TaskDetailPanel` becomes a controlled component (`taskId` prop), each panel instance lives inside a workspace tab, and the unsaved-changes confirmation fires on tab close (not just navigation). First edit on a preview tab promotes it to pinned.
- `task-list`: Row interactions route through workspace actions — single click and arrow navigation open a preview tab; double-click and `Enter` open or promote to a pinned tab. Shift-click bulk-select behavior is unchanged.

## Impact

- **Affected components**: `src/components/layout/index.tsx`, `src/components/task-detail/TaskDetailPanel.tsx`, `src/components/task-list/TaskList.tsx`, `src/hooks/useHashState.ts`, `src/contexts/HashStateContext.tsx`.
- **New modules**: `src/stores/workspace.ts` (Zustand store), `src/utils/paneTree.ts` (pure tree helpers + Vitest tests), `src/components/workspace/{WorkspacePane,SplitContainer,LeafPane,TabBar,Tab,TabContextMenu}.tsx`, `src/hooks/useWorkspaceShortcuts.ts`.
- **New dependencies**: `react-resizable-panels` (split sizing + keyboard-accessible resize handles), `@dnd-kit/core` + `@dnd-kit/sortable` (drag-to-reorder tabs). Zustand 5 is already present.
- **Tauri commands**: None — workspace state is frontend-only and persists via the existing `@tauri-apps/plugin-store` adapter. No new Rust code, no new `bd` invocations.
- **Persistence shape**: `layout.json` gains a `workspace: { root: PaneNode, activePaneId: string, recentlyClosed: [...] }` key. Migration is non-destructive: if absent, seed a single empty leaf and (if the URL hash supplies a `taskId`) open it as a preview tab.
- **Keyboard shortcuts added** (via `react-hotkeys-hook`, platform-aware): `Cmd/Ctrl+W`, `Cmd/Ctrl+Shift+T`, `Cmd/Ctrl+\` (split right), `Cmd/Ctrl+Shift+\` (split down), `Ctrl+Tab` / `Ctrl+Shift+Tab` (next/prev tab in pane), `Cmd/Ctrl+1..9` (jump to tab N). Documented in the existing shortcut reference modal.
- **Out of scope (follow-ups)**: cross-pane tab drag-and-drop, tab overflow menu when tabs exceed bar width, dirty-state indicator per tab, split-group keyboard navigation (`Cmd+Opt+Arrow`).
