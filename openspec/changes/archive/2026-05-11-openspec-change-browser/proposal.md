## Why

beads-ui has no way to see all OpenSpec changes at a glance, track their progress, or trigger the import workflow without leaving the app and running CLI commands. When a developer asks "what's in flight right now?" they must open a terminal, `ls openspec/changes/`, open each `tasks.md` to count checkboxes, and manually correlate with beads epics. The `openspec-beads-import` action — which creates the epic and all implementation issues for a change — is entirely invisible from the UI.

This change adds a **Changes** top-level view that makes the full OpenSpec change lifecycle visible and actionable from within beads-ui: browse all active and archived changes, see per-change progress at a glance, open any artifact in the system editor, and trigger `openspec-beads-import` with output streaming directly in the app.

## What Changes

- **New "Changes" top-level view** — added to the navigation bar alongside the existing view switcher. Reads `openspec/changes/` from the current project root (via `AppState::current_project()`). Shows an empty state when no project is open.
- **Change cards** — each active change renders as a card with: name, last-modified timestamp, progress bar derived from `tasks.md` checkbox counts (`- [x]` / `- [ ]`), and artifact links (proposal, design, specs, tasks) that open in the system editor via `shell::open`; artifact links are greyed out when the file is absent.
- **Import to beads action** — each card has an "Import to beads" button. Clicking it shells `openspec-beads-import <change-name>` and streams stdout/stderr into a modal. On success the modal shows an issue count and a "Go to epic" button. When the change is already imported (detected by an `openspec:<change-name>` label on an existing epic), the button becomes "Already imported — view epic".
- **Archived changes section** — collapsible section at the bottom reads `openspec/changes/archive/`. Archived cards show artifact links only; the import button is hidden.
- **Filesystem-watched card list** — extends the existing `watchers.rs` pattern to watch `openspec/changes/` for directory create/remove events; new change cards appear within 2 seconds without a manual refresh.

## Capabilities

### New Capabilities

- `openspec-change-browser`: top-level Changes view listing `openspec/changes/**` as cards; filesystem-watched; cards with artifact links, progress bar, import action; collapsible archived section at bottom; empty state when no project open

### Modified Capabilities

- `layout-shell`: Changes is a new top-level nav entry in the view switcher; requires ≤ 2 clicks to reach from any other view

## Impact

**Tauri commands (extends `openspec.rs` — new module per usability-initiative design D4)**:
- `list_changes()` — scans `openspec/changes/` for active dirs and `openspec/changes/archive/` for archived; returns `Vec<ChangeInfo>` with `name`, `is_archived`, `last_modified`, `artifacts_present`
- `get_change_progress(change: String)` — reads `tasks.md`, counts `- [x]` and `- [ ]` lines; returns `ChangeProgress { done: u32, total: u32 }`
- `import_change_to_beads(change: String)` — shells `openspec-beads-import <change>`, captures stdout+stderr, returns `CommandOutput { stdout, stderr, exit_code }`

**Filesystem watcher extension (`watchers.rs`)**:
- `OpenSpecWatcher` — new watcher struct following the same pattern as `JsonlWatcher`; watches `openspec/changes/` with `RecursiveMode::NonRecursive`; debounces events and emits `changes_list_changed` Tauri event with the project path payload

**Frontend components (new)**:
- `src/components/changes/ChangesBrowser.tsx` — top-level view component; subscribes to `changes_list_changed` event; renders change cards + archived section
- `src/components/changes/ChangeCard.tsx` — individual change card; progress bar, artifact links, import button
- `src/components/changes/ImportModal.tsx` — streaming output modal for `import_change_to_beads`; success/error/retry states; "Go to epic" button

**Frontend components (modified)**:
- `src/components/layout/index.tsx` — `TaskListPanel` gains a `changes` view branch mounting `ChangesBrowser`; `ViewSwitcher` gains the "Changes" nav entry
- `src/contexts/HashStateContext.tsx` — `view` union type extended with `'changes'`

**No breaking changes to existing IPC** — all new Tauri commands are additive and independent of existing commands.

**Non-goals**:
- Editing OpenSpec artifacts from within beads-ui (read + open in system editor only)
- Running `openspec validate` from the change card (covered by openspec-spec-panel)
- Showing per-task breakdown within a card (tasks.md checkbox count only)
- Streaming import output in real time via Tauri event channel (single `CommandOutput` return is sufficient; stdout capture before return is acceptable)
