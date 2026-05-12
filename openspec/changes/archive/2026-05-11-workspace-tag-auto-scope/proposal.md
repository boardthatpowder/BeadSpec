## Why

In a mono-repo with multiple worktrees, the task list shows issues from all projects unless the user manually adds label filters every session. Auto-detecting the current worktree's branch/repo/worktree labels and applying them as a compound scope filter eliminates this friction entirely — the right project scope is active from first render.

## What Changes

- On project connect, call the existing `get_workspace_context()` Tauri command (already implemented in `src-tauri/src/commands/external.rs`) to retrieve the three workspace label strings (`label_branch`, `label_worktree`, `label_repo`).
- Store workspace context in app-level state (Zustand or project context) so it is available synchronously at mount — no async fetch during render.
- Add a `workspaceScope` field (`'on' | 'off'`) to `HashStateContext`, serialised in the URL hash so scope state is URL-sharable.
- Render a single "Workspace scope" chip in `FilterBar` that is visually distinct from user-added filters (different background tint). One click toggles scope on/off; chip dims when off.
- Apply a compound AND-filter on the three workspace labels in `filterParser.ts` when scope is `'on'`.
- Graceful fallback: if `get_workspace_context()` returns no data (non-git project), no chip is shown and the filter is not applied.

## Capabilities

### New Capabilities

- `workspace-context`: Auto-detect current branch/worktree/repo labels via `get_workspace_context()` and expose them to the frontend; store synchronously in app state before first render.

### Modified Capabilities

- `task-list`: No-flash guarantee — scoped filter must be active before the first TaskList render so users never see an unscoped flash of all issues.

## Impact

- **Tauri command**: `get_workspace_context()` — already implemented; just needs a call site at project connect.
- **TypeScript bindings**: Already generated at `src/bindings.ts` — no regeneration needed.
- **Components**: `FilterBar.tsx` (add workspace scope chip + toggle), `HashStateContext.tsx` (new `workspaceScope` field), `filterParser.ts` (apply workspace AND-filter), `useProject.ts` or equivalent project-connect hook.
- **Non-goals**: This does not change how user-defined filters work; the workspace scope chip is independent of the manual filter list. No persistence beyond URL hash (no database storage of preference).
