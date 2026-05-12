## Why

beads-ui today surfaces a list/detail view of `bd` issues but exposes almost none of the workflow tooling the user already runs — OpenSpec artifacts live only as colored label chips, `bd` CLI features (health checks, formulas, human queue) are inaccessible from the UI, and there is no awareness of git history, Dolt time-travel, or ruflo memory. This initiative bridges the gap between the daily-use desktop app and the full OpenSpec/bd/ruflo stack it tracks, making beads-ui the central workspace rather than a passive mirror of Dolt.

## What Changes

- **Configurable list grouping**: the task list gains a group-by control (any field or label-prefix). Collapsible sections with count and aggregate badges. Persists in URL state. Absorbs the openspec-epic-rollup UX as one configuration.
- **Workspace tag auto-scope**: on project open, the current worktree's `branch:` / `worktree:` / `repo:` labels auto-apply as a filter chip with a one-click toggle to widen.
- **OpenSpec spec panel**: when a task has an `openspec:<name>` label, the detail pane grows a Spec section — artifact links, progress bar from `tasks.md`, `openspec validate` status, and drift detection (issue/checkbox desync).
- **OpenSpec change browser**: new top-level view listing `openspec/changes/*` as cards with progress, artifact links, and an "Import to beads" action. Includes archived changes.
- **`bd` health dashboard**: preflight/doctor/lint/stale/orphans surfaced in a dedicated panel with actionable suggestions.
- **Formulas browser**: browse `bd formula list` and pour workflows from the UI.
- **Ready-view dependency reasons**: `ReadyToStartView` shows inline why an issue is unblocked and what it unblocks, with dependency lineage.
- **`bd human` queue**: notification chip in the top bar surfaces issues flagged for human decision; quick-decision dropdown acts without leaving the current view.
- **Global quick-capture**: `Cmd+Shift+N` system-wide shortcut opens a minimal capture window that creates an issue with auto-applied branch/worktree/repo labels.
- **Ruflo memory panel**: side section in task detail queries ruflo memory by title + labels and lists related memories with expand-in-place.
- **Git/Dolt history panel**: task detail shows commits whose messages reference the issue id, active branch indicator, and Dolt row-history diffs alongside the activity feed.
- **Velocity/burndown**: KPI bar extended with per-change burndown (open vs closed tasks over time) and a project-wide velocity view.

## Capabilities

### New Capabilities

- `list-grouping`: group-by control on the task list; supports grouping by any scalar field or label-prefix; collapsible sections with count/aggregate; multi-level grouping as a stretch goal
- `workspace-context`: automatic worktree-scoped filtering via branch/worktree/repo label detection; scope toggle; applied at project open
- `openspec-panel`: filesystem-read OpenSpec artifact integration in task detail; progress bar from `tasks.md`; `openspec validate` status; drift detection
- `openspec-change-browser`: top-level Changes view reading `openspec/changes/**`; filesystem-watched; cards with artifact links, progress, import action; archived-changes section
- `bd-health-panel`: `bd preflight` / `doctor` / `lint` / `stale` / `orphans` wrapped as a project health page with actionable suggestions
- `bd-formulas`: `bd formula list` browse + `bd mol pour <name>` action
- `quick-capture`: system-wide `Cmd+Shift+N` issue creation window with auto-applied worktree labels
- `ruflo-memory-panel`: ruflo memory query by task title + labels surfaced in task detail as an expandable section
- `git-history-panel`: commit/branch reference detection and Dolt row-history diffs in task detail activity area
- `velocity-burndown`: per-change burndown chart and project velocity metrics in the KPI area

### Modified Capabilities

- `task-list`: groupable sections change the list rendering contract; workspace-context introduces auto-applied filter state at mount
- `task-detail`: three additive sections (openspec-panel, ruflo-memory-panel, git-history-panel) extend the detail pane layout; soft dependency on `multi-tab-task-detail-workspace` (spec panel can land as a section first, migrate to a tab later)
- `smart-views`: `ReadyToStartView` gains inline dependency lineage (why unblocked, what it unblocks)
- `notifications`: `bd human` queue adds a persistent top-bar notification entry point and quick-decision interaction
- `layout-shell`: change browser is a new top-level view in the nav switcher; velocity burndown extends the KPI bar component

## Impact

**Tauri commands (new `openspec.rs` module)**: `list_changes`, `read_change_artifact`, `get_change_progress`, `run_bd_command` (health/formulas/human actions), `get_git_refs_for_issue`, `get_dolt_history_for_issue`.

**Frontend components**:
- `src/components/task-list/TaskList.tsx` + `TaskListItem.tsx` — group rendering
- `src/components/filters/FilterBar.tsx` — group-by dropdown
- `src/lib/filterParser.ts` — grouping config + label-prefix taxonomy
- `src/contexts/HashStateContext.tsx` — grouping + scope state
- `src/hooks/useTasks.ts` — group aggregation
- `src/components/task-detail/TaskDetailPanel.tsx` — three new sections
- `src/components/layout/index.tsx` — change browser nav entry + KPI extension
- `src/components/smart-views/ReadyToStartView.tsx` — dep lineage
- New components: `ChangesBrowser`, `OpenSpecPanel`, `BdHealthPanel`, `FormulasBrowser`, `QuickCaptureWindow`, `RufloMemoryPanel`, `GitHistoryPanel`, `VelocityBurndown`, `BdHumanQueue`

**External dependencies added**: `openspec` CLI (already present in toolchain); `ruflo memory` CLI (already present); no new npm packages anticipated — charting for burndown may require a lightweight lib (e.g. `recharts` already in workspace or `victory-native`).

**No breaking changes to existing IPC** — all new Tauri commands are additive.
