## Why

The repo CLAUDE.md mandates the 3-label invariant (`branch:`, `worktree:`,
`repo:`) on every Beads issue so a worktree's work doesn't bleed into a
sibling's view. The frontend already detects workspace context
(`WorkspaceContext.label_branch`, `.label_worktree`, `.label_repo`) and
offers an opt-in scope filter chip. But when a user opens an issue
belonging to a *different* branch or worktree — easy to do via search,
direct link, or the dependency graph — nothing flags the mismatch. The
user can silently edit, claim, or close a task that should have been done
on another branch.

This change adds a subtle inline warning on the `TaskDetailPanel` header
that surfaces the divergence without blocking the user.

## What Changes

- `TaskDetailPanel` header SHALL render up to two inline mismatch chips
  (one for `branch:`, one for `worktree:`) between the title row and the
  status/priority row.
- Each chip text reads `branch: <issue-value> (current: <workspace-value>)`
  using the values parsed from the active issue's `branch:` label and the
  current `WorkspaceContext.label_branch`. Same format for the worktree
  chip.
- Each chip uses an amber/warning visual tone consistent with existing
  warning chip patterns; both chips are non-interactive (no click action)
  but show a tooltip on hover: "This issue belongs to a different
  <axis>; switching to that <axis> is recommended."
- A chip renders only when ALL THREE conditions hold:
  1. the active issue has a label matching `<axis>:` (axis ∈ {`branch`,
     `worktree`}),
  2. `WorkspaceContext.<axis>` value is non-null (i.e. the project is a
     git repo and context was detected),
  3. the two values differ after parsing.
- The two chips are independent — a branch mismatch and a worktree match
  shows only the branch chip, and vice versa.
- When both axes match, OR the workspace context is unavailable, OR the
  issue carries neither label, nothing is rendered and layout is
  unchanged.

Non-goals (explicit):
- No write / switch action. We do not attempt to `git checkout` or change
  worktrees from the UI.
- No `repo:` mismatch chip — the user opens a project at a time, so a
  repo-label mismatch implies a data error, not a navigation mistake. Out
  of scope.
- No persistence, no dismiss / "don't show again". The chip is purely
  derived from current state.
- No backend, IPC, or binding changes.
- No change to the existing `FilterBar` workspace-scope chip behaviour.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `task-detail`: adds a new requirement covering the mismatch chips on the
  detail header.
- `workspace-context`: clarifies that `label_branch` and `label_worktree`
  are consumed by the task detail header for mismatch detection (no
  behavioural change to context derivation itself).

## Impact

- **Frontend only.** New sub-component `MismatchChips.tsx` colocated in
  `src/components/task-detail/`, rendered from `TaskDetailPanel.tsx`
  immediately below the title row.
- **No new IPC commands, no `specta` bindings regen.**
- **No new shared lib.** Label parsing is a 2-line inline helper using
  the documented "split on first colon" rule.
- **Reuses** `useWorkspaceContext()` (already in `useProject.ts`) and the
  `task.labels` array already loaded by `TaskDetailPanel`'s
  `getTask` query.
- **Tests:** component unit tests in `MismatchChips.test.tsx` covering
  the gating matrix (4 cases per axis: matches, mismatches, missing
  label, missing context).
- **No schema changes, no Dolt impact, no CLI shellouts.**
