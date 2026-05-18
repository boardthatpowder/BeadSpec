## 1. Component scaffold

- [x] 1.1 Create `src/components/task-detail/MismatchChips.tsx` exporting
      a `MismatchChips({ labels }: { labels: string[] })` React component.
- [x] 1.2 Inside the component, call `useWorkspaceContext()` and compute
      two booleans (`branchMismatch`, `worktreeMismatch`) using the
      first-colon-split parser described in design.md §3. Skip computation
      and return `null` early when `workspaceContext === null`.
- [x] 1.3 Render a single flex row containing one chip per active
      mismatch. Return `null` when neither axis mismatches (no DOM, no
      layout shift).
- [x] 1.4 Style each chip with the warning/amber tokens consistent with
      `LABEL_CHIP_COLORS` in `src/components/task-list/TaskListItem.tsx`.
      Do not introduce new palette tokens.
- [x] 1.5 Add a `title=` attribute and an `aria-label` per chip with the
      tooltip copy from design.md §5.

## 2. Integration

- [x] 2.1 In `src/components/task-detail/TaskDetailPanel.tsx`, import
      `MismatchChips` and render `<MismatchChips labels={task.labels ?? []} />`
      between the title row and the status/priority row.
- [x] 2.2 Confirm no other panel sections require changes (OpenSpec,
      Ruflo memory, Git history panels are below the tabs and unaffected).

## 3. Tests

- [x] 3.1 Add `src/components/task-detail/MismatchChips.test.tsx`
      covering, for each axis independently:
      (a) match → no chip rendered;
      (b) mismatch → chip rendered with expected text and aria-label;
      (c) issue lacks the axis label → no chip;
      (d) workspace context is null → no chip;
      (e) both axes mismatch → two chips rendered.
- [x] 3.2 Verify chip text format matches `${axis}: <issue-value>
      (current: <workspace-value>)` exactly.
- [x] 3.3 Verify the component returns `null` (i.e. no DOM) when nothing
      should render — assert via `container.firstChild === null`.

## 4. Verification

- [x] 4.1 `bun run typecheck` passes.
- [x] 4.2 `bun run test:unit` includes the new test file and passes.
- [x] 4.3 `bun run lint` passes.
- [x] 4.4 Manual: with a project on `feat/y`, open an issue carrying
      `branch:feat/x` and `worktree:feat-y` labels; confirm only the
      branch chip appears with the documented copy. Repeat reversed.
- [x] 4.5 Manual: open an issue with matching labels; confirm zero chips
      and no extra row in the DOM.
- [x] 4.6 Manual: open a non-git project; confirm zero chips regardless
      of label content.
- [x] 4.7 `openspec validate worktree-branch-mismatch-warning` passes.
