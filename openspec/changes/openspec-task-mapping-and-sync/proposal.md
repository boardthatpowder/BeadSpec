## Why

When a project's `openspec:<slug>`-labelled Beads issues don't carry `N.M`-prefixed titles (e.g. legacy section-granularity imports like `promotion-sync-pollers`, which has 1 epic + 8 `Task N: …` children for 24 numbered openspec tasks), every consumer of the link silently breaks: `reconcile_tasks_checkboxes` cannot flip tasks.md based on bd status, the Changes browser progress bars drift, and a user reading the bd issues alongside `tasks.md` has no way to see which issue belongs to which task. The linkage is conventional (title prefix only) rather than structural, so the failure mode is invisible.

This change makes the linkage structural for **new** imports, exposes the per-task → per-issue mapping in the Changes browser, and adds a forward-only "sync missing tasks" action so users can incrementally create Beads issues for openspec tasks added after import. Legacy section-granularity imports are detected and left untouched (sync disabled with a clear message).

## What Changes

- New child-issue label scheme: `task:N.M` applied to every Beads child created by `openspec-beads-import`, in addition to `openspec:<slug>` and the existing branch/worktree/repo context labels. Title format `N.M <description>` is now mandatory (was conventional).
- `reconcile_tasks_checkboxes` resolves a child issue's task number by checking the `task:N.M` label first, then falling back to title-prefix extraction. No behaviour change for existing well-formed imports.
- New Tauri command `get_change_task_mapping(project_path, change_slug) -> ChangeTaskMapping` that returns the ordered list of openspec tasks each paired with its bound Beads issue ID (or `None`), plus a `has_legacy_orphans` flag indicating whether any `openspec:<slug>` child issues cannot be bound to an `N.M` task.
- New Tauri command `sync_missing_beads_tasks(project_path, change_slug, epic_id) -> SyncMissingResult` that creates child issues for currently-unbound openspec tasks, tags them with `openspec:<slug>` + `task:N.M` + context labels, and links each to the epic via `bd dep add`. Refuses with an explicit error when `has_legacy_orphans` is true.
- New expandable "View tasks" disclosure on `ChangeCard.tsx` that lazy-loads a `TaskMappingPanel` showing the `N.M │ description │ bd-status │ issue-link` table. Footer either offers a `Sync N missing tasks` button or shows a "legacy import — sync disabled" message.
- `.claude/skills/openspec-beads-import/SKILL.md` updated to mandate the title format and emit the `task:N.M` label.
- Out of scope (separate change): retroactively repairing legacy section-granularity imports.

## Capabilities

### New Capabilities

- `openspec-task-sync`: Defines the contract for the per-task mapping query and the forward-only "sync missing tasks" action — the structural `task:N.M` label, the resolution precedence (label → title), the legacy-orphan detection rule, and the refusal behaviour when legacy orphans exist.

### Modified Capabilities

- `openspec-change-browser`: Adds requirements for the expandable Task Mapping panel on each ChangeCard (only shown after import), and for the sync-missing-tasks UI affordance (button vs. legacy-disabled message). Existing requirements (progress bars, artifact links, import action) are unchanged.

## Impact

- **Tauri commands**: two new commands registered in `src-tauri/src/lib.rs` (`get_change_task_mapping`, `sync_missing_beads_tasks`); existing `reconcile_tasks_checkboxes` gets a label-first resolution path.
- **IPC bindings**: regenerated `src/bindings.ts`; two new wrappers in `src/ipc.ts`.
- **React components**: `src/components/changes-browser/ChangeCard.tsx` adds a disclosure trigger; new `src/components/changes-browser/TaskMappingPanel.tsx`.
- **Skill**: `.claude/skills/openspec-beads-import/SKILL.md` — title and label rules tightened. No retroactive effect on already-imported changes.
- **Database**: no schema migration. Only adds new rows in `labels` for future imports.
- **Compatibility**: existing imports keep working (title-fallback path); the prior parse_progress fix on this branch already shipped and isn't re-touched.
