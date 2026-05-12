## Context

The current right-hand detail pane in `src/components/layout/index.tsx` renders a single `TaskDetailPanel` driven by `state.taskId` from `useHashState`. Selection lives in the URL hash; nothing else about the open task is preserved. To support an IDE-style workspace we need (a) a tree of panes with their own tab groups, (b) tab-level state distinct from selection state, (c) a persistence story that survives reloads, and (d) a hash-bridge that keeps deep-links working.

Constraints worth naming up front:

- The app is Tauri 2 + React 19 + Vite 7. Bun is the package manager (workspace rule).
- Zustand 5 is already in `package.json` but no `*.store.ts` files exist yet — this change introduces the first one.
- All UI is hand-rolled with Tailwind v4; no Radix/shadcn/Headless UI. New primitives (context menu, tab) must be built in the same style.
- Keyboard shortcuts go through `react-hotkeys-hook` with platform-aware Cmd/Ctrl mapping (per `layout-shell` spec).
- Persistence already runs through `@tauri-apps/plugin-store` in `layout.json` (the resizable list/detail width lives there).
- `useHashState` is single-source-of-truth for filters, view, and `taskId`. Deep-links must keep working.
- TipTap editors autosave; there is no explicit save button, so "dirty" detection has to look at editor focus + pending mutation state rather than a `dirty` flag.

## Goals / Non-Goals

**Goals:**

- A single workspace store that owns the pane tree, active pane, and recently-closed stack.
- Preview-tab semantics identical to Zed/VSCode: at most one preview per leaf; promotion triggers (dblclick row, `Enter`, dblclick tab, first edit, drag) flip the tab to pinned.
- Splits modeled as a binary tree so we can nest arbitrarily, with deterministic collapse when a leaf empties.
- Full workspace round-trips through `layout.json` so the user returns to the same working set.
- Hash deep-links continue to behave: pasting a URL with `#…&taskId=bd-12` opens that task as a preview tab in a fresh workspace.
- Zero new Tauri commands and zero new Rust code — purely frontend.

**Non-Goals:**

- Cross-pane tab drag-and-drop (within-pane reorder only for v1).
- Tab overflow menu when more tabs than fit the bar (horizontal scroll is acceptable v1 behavior).
- Per-tab dirty indicator dot (TipTap autosaves; revisit if/when we add explicit save).
- Split-group keyboard navigation across panes (`Cmd+Opt+Arrow`). Inside a pane only.
- Encoding the full workspace tree in the URL hash (too noisy; `layout.json` is the workspace store of record).
- Workspace synchronization across multiple Tauri windows (each window keeps its own workspace).

## Decisions

### 1. State manager: Zustand store, not `useHashState`

`useHashState` is great for a small flat blob mirrored to the URL. The workspace is a recursive tree mutated by a dozen actions (open/close/promote/split/reorder/reopen/setActive). Encoding that tree in the hash would explode URL length and force every action through JSON-encode/decode + history push. We introduce `src/stores/workspace.ts` (Zustand 5, already in deps) as the first store in the project.

**Alternative considered:** Extend `useHashState` with a `workspace` field. Rejected — hash deep-link size would balloon and back/forward history would record every tab open. The hash keeps a single value (`taskId`) and the workspace store keeps the tree.

**Alternative considered:** Plain React Context with a reducer. Rejected — selectors and shallow comparison from Zustand prevent the whole workspace from re-rendering on every minor mutation; the tab bar in particular benefits.

### 2. Pane tree shape: discriminated union with `kind: 'leaf' | 'split'`

```ts
type LeafPane = {
  kind: 'leaf';
  id: string;                              // crypto.randomUUID()
  tabs: string[];                          // taskIds in display order
  pinned: Record<string, boolean>;         // taskId -> true if pinned, default false
  activeTabId: string | null;
};
type SplitPane = {
  kind: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  children: PaneNode[];                    // length 2; deeper nesting by further splits
  sizes: number[];                         // percentages summing to 100
};
type PaneNode = LeafPane | SplitPane;
```

A `pinned` map lookup is O(1) and survives reordering. `activeTabId` is per-leaf so each split keeps its own focus. Pure helpers live in `src/utils/paneTree.ts`: `findLeaf`, `replaceLeaf`, `splitLeaf`, `collapseEmptyParents`, `nextTabAfterClose`. All helpers are pure → easy Vitest coverage.

**Alternative considered:** Dock-style adjacency list keyed by ID with parent pointers. Rejected — harder to reason about, harder to persist, easier to corrupt during partial updates. A pure tree with immutable rewrites is straightforward to test.

**Alternative considered:** Treat splits as a flat array of leaf groups + a separate layout descriptor. Rejected — `react-resizable-panels` natively models a binary tree of `PanelGroup` / `Panel` / `PanelGroup`, so we get free recursion in the renderer.

### 3. Promotion rules (preview → pinned)

A preview tab is promoted to pinned when ANY of:

- The list row for it is double-clicked.
- `Enter` is pressed in the list while it is the focused row.
- The tab's title is double-clicked.
- The tab is dragged within the tab bar.
- The user makes ANY edit through `TaskDetailPanel` (title, status, priority, assignee, label add/remove, description focus + content change, comment submit).

Opening a different preview task while the current preview tab is unedited replaces the current preview tab. Opening a different preview task while the current one has been promoted leaves the pinned tab and creates a new preview slot.

**Alternative considered:** Treat "first focus of TipTap" as promotion. Rejected — users frequently click into the description just to read; focus alone is a false positive. Content change is the right signal.

### 4. Persistence: extend `layout.json` via existing `plugin-store` adapter

Schema migration is non-destructive. On boot:

1. Read `layout.json`. If `workspace` key absent → seed `{ root: { kind: 'leaf', id, tabs: [], pinned: {}, activeTabId: null }, activePaneId: id, recentlyClosed: [] }`.
2. If `useHashState` reports `taskId` and the seeded workspace is empty, call `openPreview(taskId)` so deep-links still land somewhere.
3. Persist writes are debounced ~250ms via a thin wrapper so rapid actions (e.g., drag-reorder) don't hammer the file.

**Alternative considered:** Put workspace in localStorage. Rejected — Tauri windows already use `plugin-store` for `taskListWidth`; one store is one mental model. Also handles multi-instance better.

### 5. Hash bridge: one-way mirror

`useHashState` keeps a `taskId` field, but it is now a **derived view** of `workspace.activePane.activeTabId`. An effect in the workspace store updates the hash whenever the active tab changes (no history entry per tab — use `replaceState`). On initial load only, hash → workspace seeding happens. No two-way sync after boot, which avoids feedback loops.

**Alternative considered:** Drop `taskId` from the hash entirely. Rejected — deep-links from notifications, shared URLs, and `useNavigationHistory` (dep-graph drill-down) all rely on `taskId` being in the hash.

### 6. Splits powered by `react-resizable-panels`

`react-resizable-panels` (~6KB, MIT) is the standard React library for IDE-style panel groups. It natively handles keyboard-accessible resize handles, persisted sizes, and nested groups. Recursive renderer:

```tsx
function WorkspacePane({ node }: { node: PaneNode }) {
  if (node.kind === 'leaf') return <LeafPane node={node} />;
  return (
    <PanelGroup direction={node.direction} onLayout={sizes => updateSplitSizes(node.id, sizes)}>
      {node.children.map((child, i) => (
        <>
          {i > 0 && <PanelResizeHandle />}
          <Panel defaultSize={node.sizes[i]} minSize={15}>
            <WorkspacePane node={child} />
          </Panel>
        </>
      ))}
    </PanelGroup>
  );
}
```

**Alternative considered:** Hand-roll CSS grid + custom drag handles. Rejected — re-implementing keyboard accessibility, ARIA, edge-cases (constraints, min/max, touch) is busywork.

### 7. Drag-to-reorder powered by `@dnd-kit/core` + `@dnd-kit/sortable`

`@dnd-kit` (~12KB total, MIT) gives accessible drag-and-drop with keyboard support, sensor abstraction, and is the de-facto modern choice (react-beautiful-dnd is unmaintained). Cross-pane drag stays out of v1 — the `SortableContext` is per-leaf, so we naturally restrict to within-pane.

**Alternative considered:** Plain HTML5 drag-and-drop. Rejected — accessibility, keyboard support, and consistent behavior across Tauri/macOS WebView is painful.

### 8. Context menu: hand-rolled portal

We have no Radix/Headless UI primitive. The `TabContextMenu` is a small absolutely-positioned `<div>` rendered into a portal, with outside-click + Escape dismissal via a shared `useDismissable` hook. Six items: Close / Close Others / Close to the Right / Close All / Split Right / Split Down.

**Alternative considered:** Add Radix UI just for this menu. Rejected — adds a dependency tree for one component; the project intentionally stays primitive-free.

### 9. `TaskDetailPanel` becomes controlled

Today it reads `const state = useAppState()`. Change: `function TaskDetailPanel({ taskId }: { taskId: string })`. The inner sub-tab state (`details` / `dependencies` / `activity`) was `useState`; we move it into the workspace store keyed by `(paneId, taskId)` so each tab remembers its own sub-tab independently. First edit inside the panel calls `workspace.promoteToPinned(taskId)`.

**Alternative considered:** Keep the panel reading the hash. Rejected — multiple instances would all show the same task. Controlled props are mandatory for multi-instance.

### 10. Empty-state and collapse semantics

- An empty `LeafPane` (no tabs) renders a "Select a task to open" placeholder; it is not auto-removed (the user might have closed all tabs to keep the pane and re-fill it).
- When the root leaf is the only pane, it stays even when empty (you always need somewhere to put a tab).
- When a non-root leaf inside a `SplitPane` empties from `closeAll` (vs the user actively closing one-by-one), we still keep the pane — closing all is an explicit choice, not an unwind. **Auto-collapse fires only when**: the leaf empties AND was created by a recent split AND has never been promoted (heuristic: track `splitGenerationCounter` on creation). Otherwise the user keeps an empty pane until they explicitly merge it.
- **Simpler v1 rule (chosen):** Auto-collapse a non-root empty leaf only when triggered by `Close to the Right` / `Close Others` (where the user implicitly meant "leave one tab"). All other empties stay. Documented as a known trade-off below.

### 11. Keyboard shortcuts

Bound via `react-hotkeys-hook` inside `useWorkspaceShortcuts`:

| Action | macOS | Windows/Linux |
|---|---|---|
| Close active tab | `Cmd+W` | `Ctrl+W` |
| Reopen recently closed | `Cmd+Shift+T` | `Ctrl+Shift+T` |
| Split right | `Cmd+\` | `Ctrl+\` |
| Split down | `Cmd+Shift+\` | `Ctrl+Shift+\` |
| Next tab in pane | `Ctrl+Tab` | `Ctrl+Tab` |
| Previous tab in pane | `Ctrl+Shift+Tab` | `Ctrl+Shift+Tab` |
| Jump to tab N | `Cmd+1`..`Cmd+9` | `Ctrl+1`..`Ctrl+9` |

These are added to the shortcut reference modal driven by `layout-shell`'s "Shortcuts are discoverable" requirement.

## Risks / Trade-offs

- **Persistence churn**: Drag-reorder fires many tiny state updates. → Mitigated by 250ms debounced writes to `layout.json`. Verified by counting writes in dev mode.
- **Re-render storm on tab switch**: Switching the active tab in a leaf rerenders the entire `WorkspacePane` subtree if naive. → Mitigated by Zustand selectors keyed to each leaf (`useWorkspaceStore(s => s.findLeaf(paneId))`) plus `React.memo` on `LeafPane`. Verified with React DevTools profiler before merge.
- **Stale TanStack Query cache for closed tabs**: If a user closes a tab, the underlying `useQuery(['task', taskId])` may stay in cache unnecessarily. → Acceptable v1; the 30s staleTime + Tauri-event invalidation already controls this. Document as known.
- **Inner sub-tab memory bloat**: Storing `(paneId, taskId) -> innerTab` for every opened-ever task could grow. → Bounded by clearing on tab close. Capacity is in the dozens, not thousands.
- **Promotion-on-edit false positives**: TipTap fires `onUpdate` for cursor changes? → We only listen to content-changed events that increment doc version; cursor moves don't count. Verified via a Vitest test against the TipTap mock.
- **`layout.json` corruption / forward-incompatibility**: A future schema change could land on a broken `workspace` object. → Wrap the parse in a `try/catch`; if shape validation fails, fall back to default workspace and log to console. Migration version field reserved for future use.
- **Auto-collapse heuristic feels surprising**: Closing all tabs leaving an empty pane could feel like a bug. → Display a clear placeholder + "Close pane" button when the leaf is empty. The keyboard `Cmd+W` on an already-empty pane closes the pane (collapsing it from the tree) — escape hatch.
- **Cross-pane DnD missing in v1**: Users may try to drag a tab into another pane and be disappointed. → Render a "not allowed" cursor when the drop target is outside the source pane; documented in follow-up.
- **Hash bridge feedback loop**: One-way bridge avoids loops, but a `popstate` (browser back) with a different `taskId` won't reorder/change tabs — it will just shift `activeTabId` in the active pane (or open as preview if not already open). → Documented behavior; matches Zed's "navigation history" semantics.

## Migration Plan

1. Land the change behind no flag — the workspace is the new default. On first run after upgrade:
   - `layout.json` has no `workspace` key → seed default workspace, run hash-seed, persist back.
   - Existing `taskListWidth` is preserved untouched.
2. No backend migration. No `bd` schema changes. No `Tauri` command additions.
3. Rollback: revert the PR — old `layout.json` files written by the new code remain parseable by the old code (the old reader ignores the unknown `workspace` key).

## Open Questions

- Should `Cmd+W` on the last tab in the *root* leaf clear the hash entirely, or refuse (keep the empty workspace placeholder)? **Tentative answer:** refuse; placeholder shows. Revisit if user feedback differs.
- Do we want a visible "promote" affordance (small pin icon) on preview tabs for discoverability? **Tentative answer:** v1 = italic title + tooltip on the tab; add an explicit pin icon as a follow-up if testing shows users miss the convention.
- Where do we render the active-pane outline color so it doesn't fight the existing Tailwind `border-neutral-800` palette? **Tentative answer:** use the existing focus-ring accent (already used by status dropdown). Confirm during implementation review.
