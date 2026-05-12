## Why

When working on a task in Beads UI, developers have no way to see which Git commits or branches are associated with that task. They must switch to a terminal and manually run `git log --grep=<id>` or scan branch names to trace code changes back to an issue. This context-switching breaks flow and makes it hard to correlate issue history with code history.

## What Changes

- **New Rust command** `get_git_refs_for_issue` in `src-tauri/src/commands/external.rs`: runs `git log --oneline --all --grep=<issue_id>` and `git branch --list "*<issue_id>*"` in the project root from `AppState`, returning a `GitRefs` struct containing `commits: Vec<CommitRef>` and `branches: Vec<String>`. Returns empty vecs gracefully if the project root has no `.git` directory.
- **New `GitHistoryPanel` React component** (`src/components/task-detail/GitHistoryPanel.tsx`): a collapsible section shown in the activity tab that lists commit refs (hash, subject, date) and a branch badge in the task header if any matching branch exists.
- **Branch badge** in `TaskDetailPanel.tsx` header: a small badge showing the matching branch name, rendered only when `GitRefs.branches` is non-empty.
- **Lazy fetch**: the `get_git_refs_for_issue` command is called only when the user opens the "Activity" tab, with results cached per task using TanStack Query.
- **Hidden for non-git projects**: if the project root has no `.git` directory, the entire Git history section is omitted without showing an error.

## Capabilities

### New Capabilities

- `git-commit-branch-refs`: Surface Git commit references and branch associations for a task directly in the task detail activity area, with a branch badge in the header for at-a-glance visibility.

### Modified Capabilities

- `task-detail/activity-tab`: New "Git history" collapsible section added after the existing activity feed sections (order: OpenSpec, Ruflo, Git).
- `task-detail/header`: Optional branch badge showing matching Git branch name.

## Impact

- **New Rust file**: `src-tauri/src/commands/external.rs` — `get_git_refs_for_issue` command, `GitRefs` and `CommitRef` types.
- **New React file**: `src/components/task-detail/GitHistoryPanel.tsx`.
- **Modified file**: `src-tauri/src/lib.rs` (or equivalent invoke handler registration) — register `get_git_refs_for_issue`.
- **Modified file**: `src-tauri/src/commands/mod.rs` — expose `external` module.
- **Modified file**: `src/commands/mod.rs` or `src/ipc.ts` — add specta-generated binding for `get_git_refs_for_issue`.
- **Modified file**: `src/components/task-detail/TaskDetailPanel.tsx` — add `GitHistoryPanel` in activity tab, add branch badge in header.
- **No new npm dependencies** required.
- **No database changes** required.
- **Non-goal**: Git blame, diff display, or file-level history.
- **Non-goal**: Linking commits back into Dolt history.
- **Non-goal**: Writing to Git from the UI.
