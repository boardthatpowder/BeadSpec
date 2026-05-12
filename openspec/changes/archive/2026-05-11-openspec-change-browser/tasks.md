## 1. Extend openspec.rs — Tauri commands

- [x] 1.1 Create `src-tauri/src/commands/openspec.rs` (or extend if it exists from openspec-spec-panel) with the `ChangeInfo`, `ArtifactFlags`, `ChangeProgress`, and `CommandOutput` types, all derived with `serde::Serialize`, `serde::Deserialize` (where needed), and `specta::Type`
- [x] 1.2 Implement `list_changes()`: resolve project root from `AppState::current_project()`; scan `openspec/changes/` for active dirs and `openspec/changes/archive/` for archived dirs; populate `ArtifactFlags` by checking for each artifact file; return `Vec<ChangeInfo>` (empty vec when project not set or directory absent)
- [x] 1.3 Implement `get_change_progress(change: String)`: resolve path for active or archived change; read `tasks.md`; count `- [x]`/`- [X]` as done and `- [x]` as total; return `ChangeProgress { done: 0, total: 0 }` when `tasks.md` absent
- [x] 1.4 Implement `import_change_to_beads(change: String)`: resolve `openspec-beads-import` binary (from `AppState` cached path, or via `which` at call time with error if not found); spawn via `spawn_blocking` with 30s timeout; return `CommandOutput { stdout, stderr, exit_code }` (exit_code = -1 on timeout)
- [x] 1.5 Register all three commands in `lib.rs` via `tauri_specta` builder and regenerate TypeScript bindings with `cargo build`

## 2. Extend watchers.rs — OpenSpecWatcher

- [x] 2.1 Add `OpenSpecWatcher` struct to `src-tauri/src/db/watchers.rs` following the exact pattern of `JsonlWatcher` (OS thread for `notify::recommended_watcher`, tokio task for debounce + emit); watch `<project_root>/openspec/changes/` with `RecursiveMode::NonRecursive`; emit `changes_list_changed` event with `ChangesListChangedPayload { project: String }`
- [x] 2.2 Add `OpenSpecWatchHandle` (analogous to `WatchHandle`) with a `stop()` method
- [x] 2.3 Update `WatcherRegistry` to store `(PollHandle, WatchHandle, OpenSpecWatchHandle)` per project; update `register` and `stop_project` accordingly
- [x] 2.4 In `connect_project` (`commands/project.rs`), start `OpenSpecWatcher` alongside `JsonlWatcher`; pass the returned handle to `WatcherRegistry::register`
- [x] 2.5 Verify `OpenSpecWatcher` gracefully no-ops when `openspec/changes/` does not exist (watcher returns error, thread exits cleanly, handle is stored but silent)

## 3. ChangesBrowser component

- [x] 3.1 Create `src/components/changes/ChangesBrowser.tsx`; on mount call `listChanges()` (generated IPC binding); subscribe to `changes_list_changed` Tauri event via `listen` and re-call `listChanges()` on receipt (filter by project path); unsubscribe on unmount
- [x] 3.2 Create `src/components/changes/ChangeCard.tsx`; call `getChangeProgress(name)` on mount; render: change name, relative last-modified timestamp, progress bar (`done / total`), artifact links with greyed-out state for absent artifacts; shell `open` on artifact link click using `@tauri-apps/plugin-shell`
- [x] 3.3 In `ChangeCard`, detect "already imported" state: check `useTasks()` result for any task with `task_type === 'epic'` and a label containing `openspec:<change-name>`; show "Already imported — view epic" button if found; clicking it sets `state.view = 'list'` and `state.selectedTaskId = epicId` via `HashStateContext`
- [x] 3.4 Add empty state rendering in `ChangesBrowser`: "Connect a project to see its OpenSpec changes" when no project connected; "No OpenSpec changes found in this project" when `list_changes()` returns empty for a connected project

## 4. ImportModal component

- [x] 4.1 Create `src/components/changes/ImportModal.tsx`; mount renders spinner state ("Running openspec-beads-import…"); on mount, call `importChangeToBeads(change)` Tauri command; disable close while running (allow cancel via a "Cancel" button that resolves immediately if the future has already been dispatched — best-effort)
- [x] 4.2 On success (exit_code === 0): replace spinner with success state; show stdout (scrollable, monospace); show "Go to epic" button (sets `state.view = 'list'` and selects the epic); show "Close" button
- [x] 4.3 On failure (exit_code !== 0 or timeout): show error state; display stderr (scrollable, monospace); show "Retry" button (re-fires `importChangeToBeads` and resets to spinner state); show "Close" button
- [x] 4.4 Show disabled "Import to beads" button with tooltip "openspec-beads-import not found — run from terminal" when the Tauri command returns an error indicating binary not found (distinguish this error from a command execution failure)

## 5. Archived section

- [x] 5.1 In `ChangesBrowser`, render an `ArchivedSection` component below the active cards list; collapsed by default (`useState(true)`); header shows "N archived change(s)" count from the `is_archived` subset of `list_changes()` result
- [x] 5.2 When expanded, render `ChangeCard` components for each archived change with `isReadOnly={true}` prop; `ChangeCard` omits the import button and "Already imported" button when `isReadOnly` is true; artifact links and progress bar remain
- [x] 5.3 When `openspec/changes/archive/` is absent or returns 0 archived changes, either omit the section entirely or show "0 archived changes" — designer's choice during implementation

## 6. Layout integration

- [x] 6.1 In `src/contexts/HashStateContext.tsx`, extend the `view` union type with `'changes'` (add to the existing `'list' | 'focus' | 'ready'` union)
- [x] 6.2 In `src/components/layout/index.tsx`, add a `state.view === 'changes'` branch in `TaskListPanel` that renders `<ChangesBrowser />`; add the "Changes" button to `ViewSwitcher` with active state styling consistent with existing view buttons

## 7. Manual test in Tauri dev

- [x] 7.1 Run `bun run tauri dev`; navigate to the Changes view; verify active change cards appear with correct names, last-modified dates, and progress bars
- [x] 7.2 Create a new change via `openspec new change test-change` in a terminal; verify a new card appears in the Changes view within 2 seconds without reloading
- [x] 7.3 Click an artifact link (e.g. `proposal.md`); verify it opens in the system editor
- [x] 7.4 Click "Import to beads" on a change that has not been imported; verify the modal opens, shows spinner, and transitions to success or error state; verify "Go to epic" button works if successful
- [x] 7.5 Expand the Archived section; verify archived change cards appear with no import button
- [x] 7.6 With no project connected, navigate to Changes; verify the empty state message is shown and no error is thrown

## 8. Validate and close

- [x] 8.1 Run `openspec validate openspec-change-browser` and confirm all checks pass with no errors or warnings
- [x] 8.2 Close BUI-i73g via `bd close BUI-i73g`
