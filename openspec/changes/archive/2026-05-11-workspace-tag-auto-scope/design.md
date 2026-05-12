## Context

Beads UI targets mono-repo workflows where multiple worktrees coexist. Each worktree's tasks carry labels like `branch:main`, `worktree:beads-ui`, and `repo:beads-ui`. Without auto-scoping, the task list shows all projects' issues until the user manually adds label filters each session.

The `get_workspace_context()` Tauri command already exists in `src-tauri/src/commands/external.rs` and is registered. TypeScript bindings are already generated in `src/bindings.ts`. The `configurable-list-groupings` change has landed, so `FilterBar` already has a group-by dropdown and is the right place to add the scope chip.

## Goals / Non-Goals

**Goals:**
- Call `get_workspace_context()` exactly once at project connect time; store result synchronously in app state.
- Apply a compound AND-filter on all three workspace labels when `workspaceScope` is `'on'`.
- Render a single visually-distinct "Workspace scope" chip in `FilterBar` with one-click toggle.
- Serialise `workspaceScope` state in the URL hash via `HashStateContext` for URL-shareability.
- Guarantee no unscoped flash: scoped filter is applied before first TaskList render.
- Gracefully skip chip and filter if `get_workspace_context()` returns null/empty (non-git project).

**Non-Goals:**
- Persisting the `workspaceScope` preference beyond the URL hash (no database storage).
- Changing how user-defined manual filters work.
- Adding new Tauri commands — `get_workspace_context()` is already complete.
- Modifying the Rust backend in any way.

## Decisions

### Decision 1: Call site — project connect hook, not component effect

`get_workspace_context()` is called once in the project-connect path (e.g., `useProject.ts` or the Zustand `projectStore` action that opens a project). The result is stored in a Zustand slice field (`workspaceContext`) before the project state transitions to "connected".

**Why**: A `useEffect` in `FilterBar` or `TaskList` would fire after the first render, causing a flash of unscoped data. Calling it synchronously in the connect action means by the time React renders the connected view, `workspaceContext` is already populated.

**Alternative considered**: Fetch in a Suspense boundary. Rejected — adds complexity and requires a structural refactor; the store-first approach is simpler.

### Decision 2: Workspace scope as a separate state field, not a GroupConfig entry

`workspaceFilter` is a dedicated field in the filter pipeline (`workspaceLabels: string[]`), applied in `filterParser.ts` as a pre-pass AND-filter before user filters run. It is NOT a `FilterGroup` or a user-managed filter entry.

**Why**: Mixing it into the user filter list would make it deletable, serialisable in the same format as user filters, and visually identical. The scope chip needs distinct semantics (toggle, not remove; different styling) and a distinct serialisation key (`workspaceScope`).

### Decision 3: URL hash serialisation via HashStateContext

`HashStateContext` gains one new field: `workspaceScope: 'on' | 'off'` (default `'on'`). The chip reads and writes this field.

**Why**: Consistent with how the existing filter state is URL-sharable. Allows deep-linking to a scoped or unscoped view.

### Decision 4: Chip styling — distinct background tint, not a separate row

The workspace scope chip is rendered at the leftmost position in `FilterBar`, before user filter chips. It uses a visually distinct background (e.g., `bg-blue-100 text-blue-800` vs the neutral `bg-gray-100` of user chips). When toggled off, the chip renders with reduced opacity (`opacity-50`) and a strikethrough or dimmed label to communicate inactive state.

**Why**: Keeps the workspace chip in the same bar as user filters (familiar mental model), while the colour tint makes its special status clear.

### Decision 5: No-flash guarantee — synchronous read from store at mount

`TaskList` reads `workspaceScope` and `workspaceLabels` from the Zustand store at mount. Because the store is populated before the connected view renders (Decision 1), the filter is active from the very first paint.

**Why**: Avoids a two-phase render (render unfiltered → async fetch → render filtered) that would cause a visible flash.

## Risks / Trade-offs

- **Risk**: `get_workspace_context()` is slow (e.g., slow git invocation). → Mitigation: The command shells out to `git` but is already implemented and returns fast (<50ms in practice). If it ever hangs, it should be wrapped with a timeout in the backend (future concern, not in scope here).
- **Risk**: Workspace labels change while the project is open (user switches branch). → Mitigation: Out of scope for this change. The workspace context is fetched once at connect time. A future change can add re-detection on branch change.
- **Risk**: URL hash with `workspaceScope=off` shared to another machine may behave unexpectedly if that machine has a different workspace context. → Mitigation: Acceptable trade-off; the URL encodes intent (scope off), not the actual labels.

## Migration Plan

No data migration required. The feature is purely additive:
1. Deploy new frontend code.
2. On next project open, `get_workspace_context()` is called and the chip appears.
3. No rollback steps needed — if the feature is reverted, users lose the chip and return to manual filtering.
