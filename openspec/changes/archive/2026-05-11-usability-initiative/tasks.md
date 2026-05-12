## 1. Initiative Setup

- [x] 1.1 Import this coordinating change to beads (`openspec-beads-import usability-initiative`) to create the parent epic and tag all sub-change tasks with branch/worktree/repo labels
- [x] 1.2 Verify `recharts` is present in `package.json`; add with `bun add recharts` if absent
- [x] 1.3 Confirm `bd` and `ruflo` binary paths are resolvable from a Tauri process on the target platform (macOS first); document resolved paths in `design.md` Open Questions if not

## 2. Phase 1 — Foundations

- [x] 2.1 Run `opsx:ff configurable-list-groupings` to generate all artifacts for sub-change A
- [x] 2.2 Run `openspec-beads-import configurable-list-groupings` and tag all created issues
- [x] 2.3 Implement `configurable-list-groupings` via `openspec-beads-work` loop until `openspec-beads-complete`
- [x] 2.4 Run `opsx:ff workspace-tag-auto-scope` to generate all artifacts for sub-change B (depends on 2.3)
- [x] 2.5 Run `openspec-beads-import workspace-tag-auto-scope` and tag all created issues
- [x] 2.6 Implement `workspace-tag-auto-scope` via `openspec-beads-work` loop until `openspec-beads-complete`

## 3. Phase 2 — OpenSpec Deep Integration

- [x] 3.1 Run `opsx:ff openspec-spec-panel` to generate all artifacts for sub-change C
- [x] 3.2 Run `openspec-beads-import openspec-spec-panel` and tag all created issues
- [x] 3.3 Implement `openspec-spec-panel` via `openspec-beads-work` loop until `openspec-beads-complete`
- [x] 3.4 Run `opsx:ff openspec-change-browser` to generate all artifacts for sub-change D
- [x] 3.5 Run `openspec-beads-import openspec-change-browser` and tag all created issues
- [x] 3.6 Implement `openspec-change-browser` via `openspec-beads-work` loop until `openspec-beads-complete`

## 4. Phase 3 — bd CLI Surface

- [x] 4.1 Run `opsx:ff bd-health-panel` to generate all artifacts for sub-change E
- [x] 4.2 Run `openspec-beads-import bd-health-panel` and tag all created issues
- [x] 4.3 Implement `bd-health-panel` via `openspec-beads-work` loop until `openspec-beads-complete`
- [x] 4.4 Run `opsx:ff bd-formulas` to generate all artifacts for sub-change F (parallelisable with E)
- [x] 4.5 Run `openspec-beads-import bd-formulas` and tag all created issues
- [x] 4.6 Implement `bd-formulas` via `openspec-beads-work` loop until `openspec-beads-complete`
- [x] 4.7 Run `opsx:ff ready-view-with-reasons` to generate all artifacts for sub-change G
- [x] 4.8 Run `openspec-beads-import ready-view-with-reasons` and tag all created issues
- [x] 4.9 Implement `ready-view-with-reasons` via `openspec-beads-work` loop until `openspec-beads-complete`
- [x] 4.10 Run `opsx:ff bd-human-queue` to generate all artifacts for sub-change H
- [x] 4.11 Run `openspec-beads-import bd-human-queue` and tag all created issues
- [x] 4.12 Implement `bd-human-queue` via `openspec-beads-work` loop until `openspec-beads-complete`

## 5. Phase 4 — Capture & Memory Affordances

- [x] 5.1 Run `opsx:ff global-quick-capture` to generate all artifacts for sub-change I
- [x] 5.2 Run `openspec-beads-import global-quick-capture` and tag all created issues
- [x] 5.3 Implement `global-quick-capture` via `openspec-beads-work` loop until `openspec-beads-complete`
- [x] 5.4 Run `opsx:ff ruflo-memory-panel` to generate all artifacts for sub-change J
- [x] 5.5 Run `openspec-beads-import ruflo-memory-panel` and tag all created issues
- [x] 5.6 Implement `ruflo-memory-panel` via `openspec-beads-work` loop until `openspec-beads-complete`

## 6. Phase 5 — Git / Dolt Awareness

- [x] 6.1 Resolve open question: verify `dolt_diff_tasks` availability in the current schema; update `design.md` with the confirmed query approach
- [x] 6.2 Run `opsx:ff git-commit-branch-refs` to generate all artifacts for sub-change L
- [x] 6.3 Run `openspec-beads-import git-commit-branch-refs` and tag all created issues
- [x] 6.4 Implement `git-commit-branch-refs` via `openspec-beads-work` loop until `openspec-beads-complete`
- [x] 6.5 Run `opsx:ff dolt-time-travel-activity` to generate all artifacts for sub-change M
- [x] 6.6 Run `openspec-beads-import dolt-time-travel-activity` and tag all created issues
- [x] 6.7 Implement `dolt-time-travel-activity` via `openspec-beads-work` loop until `openspec-beads-complete`

## 7. Phase 6 — Reporting

- [x] 7.1 Run `opsx:ff velocity-burndown` to generate all artifacts for sub-change N
- [x] 7.2 Run `openspec-beads-import velocity-burndown` and tag all created issues
- [x] 7.3 Implement `velocity-burndown` via `openspec-beads-work` loop until `openspec-beads-complete`

## 8. Wrap-Up

- [x] 8.1 Run `openspec validate --change usability-initiative` and confirm all specs pass
- [x] 8.2 Verify all 13 sub-change epics are closed in beads
- [x] 8.3 Close the `usability-initiative` epic in beads
- [x] 8.4 Archive this coordinating change (`openspec-archive-change usability-initiative`)
