## Why

Beads-ui today renders `openspec:<change-name>` labels as plain coloured chips. There is no affordance in the task detail pane to navigate to the underlying OpenSpec artifacts, check how many tasks are done, or confirm that the change is still valid. An engineer working an OpenSpec-backed issue must context-switch to the terminal or Finder to inspect the artifact tree, run `openspec validate`, and reconcile checkbox state with issue status. This friction discourages the spec-driven workflow and makes drift go unnoticed.

The label already carries the change name — the panel just needs to use it. All the data the section would show is either already readable from the filesystem or runs a shell command that `openspec validate` already provides.

## Non-Goals

- This change does NOT implement the OpenSpec change browser (top-level view listing all changes). That is the separate `openspec-change-browser` sub-change of the usability initiative.
- This change does NOT add live polling or filesystem watching of artifacts; the panel is lazy — it loads on open and re-loads on explicit user action.
- This change does NOT modify the Dolt data layer or any SQL query.
- This change does NOT support Windows paths in this iteration (macOS-first, parity tracked as a follow-up issue).

## What Changes

A new collapsible "OpenSpec" accordion section is added to the task detail pane. The section is rendered when (and only when) the open task has at least one label matching `openspec:<change-name>`. When the panel is visible it shows:

1. **Artifact links** — `proposal.md`, `design.md`, `tasks.md`, any `specs/**/*.md` files; each link opens the file in the system default editor via Tauri `shell::open`. Missing files are rendered in a muted / disabled style. Changes that have been moved to `openspec/changes/archive/` display greyed links with an "archived" badge.
2. **Progress bar** — parsed from `tasks.md` checkbox syntax (`- [x]` vs `- [ ]`); shows `done / total`. Hidden if `tasks.md` is absent.
3. **Validate status** — shows the last-known result of `openspec validate --change <name> --json` (valid / error list + timestamp). A "Re-validate" button triggers a fresh run; the result is cached in component state across navigation.
4. **Drift detection** — compares this task's beads status with the checkbox state for the matching entry in `tasks.md` (title substring match, case-insensitive). Surfaces a warning when the two are out of sync.

A `containerMode: 'section' | 'tab'` prop is added to the future `OpenSpecPanel` component so the multi-tab-workspace migration later is a one-prop change.

## Capabilities

### New Capabilities

- `openspec-panel`: collapsible accordion section in task detail surfacing artifact links, progress bar, validate status, and drift detection for tasks with an `openspec:<name>` label.

### Modified Capabilities

- `task-detail`: additive — `TaskDetailPanel.tsx` conditionally renders `OpenSpecPanel` when an `openspec:*` label is detected. Adds `containerMode` prop contract. Section ordering: OpenSpec first (above Ruflo memories and Git/Dolt history when those panels land in later sub-changes).

## Impact

**New Tauri commands** — `src-tauri/src/commands/openspec.rs` (new file):
- `list_changes()` → `Vec<ChangeInfo>` — reads `openspec/changes/` from the current project root
- `read_change_artifact(change: String, artifact: String)` → `String` — reads a named artifact file
- `get_change_progress(change: String)` → `{ done: u32, total: u32 }` — parses `tasks.md` checkboxes
- `run_openspec_validate(change: String)` → `{ valid: bool, errors: Vec<String> }` — shells out to `openspec validate --change <name> --json`

All commands resolve the project root from `AppState::current_project()` (same pattern as existing `read.rs` / `project.rs` commands). The module is registered in `src-tauri/src/commands/mod.rs` and the commands are wired into the Tauri builder in `src-tauri/src/lib.rs`. `tauri-specta` codegen is re-run after registration so TypeScript bindings are updated automatically.

**New frontend components**:
- `src/components/task-detail/OpenSpecPanel.tsx` — the accordion section component with props `changeName: string`, `containerMode: 'section' | 'tab'`

**Modified frontend components**:
- `src/components/task-detail/TaskDetailPanel.tsx` — detects `openspec:*` labels on the current task and renders `<OpenSpecPanel>` in the details tab, above other future additive sections.

**TypeScript bindings** (`src/bindings.ts` / auto-generated):
- `ChangeInfo`, `ChangeProgress`, `ValidationResult` types added after specta codegen.

**No breaking changes** to existing IPC contracts.
