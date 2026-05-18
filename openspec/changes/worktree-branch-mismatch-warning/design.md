## Context

`TaskDetailPanel` (`src/components/task-detail/TaskDetailPanel.tsx`)
renders an inline-editable header (title, status, priority, assignee,
labels) above a tabbed content area. The workspace's git-derived context
is already in the Zustand store via `useWorkspaceContext()` and exposes
three label strings: `label_branch` (e.g. `branch:feat/x`), `label_worktree`,
`label_repo`. The `FilterBar` (`src/components/filters/FilterBar.tsx:346`)
already consumes this context for an opt-in workspace-scope chip.

When a task is opened that belongs to a different branch or worktree than
the user's current shell HEAD, today there is no signal. The user might
edit, claim, or close it on the wrong branch — exactly the scenario the
3-label invariant exists to prevent at the data layer, but which the UI
doesn't reinforce.

## Goals / Non-Goals

**Goals:**
- Show a subtle amber chip per mismatched axis on the detail header.
- Strictly derive from existing state — no new IPC, no new persistence.
- Render only when the data is actually informative (issue carries the
  label AND workspace context is set AND values differ).
- Use the existing chip-styling vocabulary; don't introduce novel
  chrome.

**Non-Goals:**
- No interactive "switch branch / worktree" action.
- No `repo:` axis chip.
- No global banner — strictly a localised header chip.
- No counts, no list view surfacing — detail panel only.
- No accessibility regression: chips must be reachable via screen reader.

## Decisions

### 1. Render location: between the title row and the status/priority row

The header has a vertical stack: `BreadcrumbBar` → title (`InlineTitle`) →
status / priority / assignee row → labels row. Place the mismatch chips
in their own row between the title and the status row. Reasons:

- Above the title would compete visually with the breadcrumb.
- Below the labels row would bury it among many chips.
- Adjacent to the title row keeps it scannable but visually subordinate.

Rendering a single flex row that mounts only when at least one chip is
visible avoids layout shift on the common (matching) path: when the row
is empty it returns `null` and produces no DOM.

### 2. Two independent chips, one per axis

Branch and worktree mismatches are computed and rendered independently.
A user on `branch:feat/y` opening an issue tagged `branch:feat/x` and
`worktree:feat-y` sees only the branch chip. This avoids merging
unrelated signals into a single confusing chip.

### 3. Label parsing rule: split on first colon only

The CLAUDE.md invariant is unambiguous: split on the first colon. For TS:

```ts
function parseAxisLabel(labels: string[], axis: 'branch' | 'worktree'): string | null {
  const prefix = axis + ':'
  for (const l of labels) {
    if (l.startsWith(prefix)) return l.slice(prefix.length) || null
  }
  return null
}
```

Edge cases:
- A label like `branch:feat/foo:bar` parses to `feat/foo:bar`. Correct.
- Multiple `branch:*` labels on one issue: take the first (matches the
  existing pattern in `TaskDetailPanel.tsx:246` where `find(...)` returns
  the first match).
- Empty value after the prefix (`branch:`) returns `null` — treated as no
  label.

The `WorkspaceContext.label_branch` field is the *full* label string
(e.g. `branch:feat/y`); we apply the same parser to it.

### 4. Mismatch chip visual: reuse warning/amber tokens, no novel chrome

Use the existing chip primitive (the same one that renders status,
priority, and label chips on the header). Apply an amber/warning palette
consistent with `LABEL_CHIP_COLORS` warning entries in
`src/components/task-list/TaskListItem.tsx`. No drop-shadow, no glow, no
animation. The chip text is plain:
`branch: feat/x (current: feat/y)`.

The chip is non-interactive (`type="button"` only for the tooltip
hover-target; no `onClick` handler) but has a `title` attribute and an
`aria-label` for screen readers.

### 5. Tooltip copy

Hover/focus reveals:

- Branch axis: "This issue belongs to a different branch; switching to
  that branch is recommended."
- Worktree axis: "This issue belongs to a different worktree; switching
  to that worktree is recommended."

Implementation: native `title=` attribute is sufficient for v1; if the
project later standardises on a custom tooltip primitive, swap then.

### 6. Reactivity: derived state, no extra IPC

The mismatch is a pure function of `(task.labels, workspaceContext)`,
both of which the panel already reads. No extra effect, no extra query.
TanStack Query already invalidates `task.labels` on label edits; Zustand
updates re-render on workspace context change. Free reactivity.

### 7. No new shared lib

Single 5-line parser lives inside `MismatchChips.tsx`. If a second
consumer ever needs it, extract to `src/lib/labels.ts` then. YAGNI for
now.

### 8. Scope chip independence

The `FilterBar` workspace-scope chip (specced in `workspace-context`)
hides tasks outside the workspace scope. When the scope chip is *off*,
the user can open out-of-scope tasks — exactly the case this change
catches. The mismatch chip therefore must render regardless of the scope
chip's enabled state. Treat the two as orthogonal UI affordances.

## UI design direction

- **Register:** product (app UI). Implementers should use `impeccable
  craft` (product register), not the brand register.
- **Aesthetic:** minimalist-utility. Small chip, neutral amber tone
  consistent with existing warning chips; no novelty chrome. Sits inline
  with status/priority chips.
- **Anti-references:** no animated splashes, no card-shadow inflation,
  no AI-stock gradients, no exclamation-mark icon clutter (a tiny
  triangle/dot is enough, or no icon at all).
- **Skills at implementation time:** `impeccable craft` to draft the
  `MismatchChips` component; `impeccable audit` to compare the diff
  against `TaskDetailPanel`'s existing chip stack; `minimalist-ui` when
  condensing the chip layout.

### ASCII mockup

```
┌─────────────────────────────────────────────────────────────┐
│  Backlog › BD-123  →  BD-456                                │  ← breadcrumb
│  Refactor the dependency resolver                           │  ← inline title
│  ⚠ branch: feat/x (current: feat/y)                         │  ← mismatch row
│  [Open] [P1] [@alice] +label                                │  ← status row
│  branch:feat/x  worktree:feat-x  repo:beadspec  openspec:y  │  ← labels row
├─────────────────────────────────────────────────────────────┤
│  Details │ Dependencies │ Activity                          │
└─────────────────────────────────────────────────────────────┘
```

(Worktree variant looks identical with prefix `⚠ worktree: …`; when both
mismatch, two chips appear on the same row.)

## Risks / Trade-offs

- **False positive when the project is non-git** → `useWorkspaceContext`
  returns `null`, so the chips render nothing. Verified by the gating
  rule.
- **Multi-axis mismatch crowding** → max two chips, single row, wraps to
  next line on narrow panes via standard flex-wrap. Acceptable density.
- **Mismatch is noise when intentional** → e.g. user is cherry-picking
  cross-branch work. We do not offer a dismiss; the cost is a small
  visual line. Cheaper than persistence + reset logic.
- **Branch detection drift** → `WorkspaceContext` is fetched once at
  project connect (`connectProjectWithContext` in `useProject.ts`). If
  the user runs `git checkout` in another terminal mid-session, the chip
  becomes stale. This change does NOT add live branch polling; that is a
  separate concern of the `workspace-context` capability. Document as a
  known limitation.
- **Tooltip a11y** → relying on `title=` is the minimum-viable approach;
  if global a11y review requires a richer tooltip later, swap to the
  shared primitive without changing the gating logic.
