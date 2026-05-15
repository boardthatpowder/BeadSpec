## 1. Backend types and resolver

- [ ] 1.1 Add `TaskMappingEntry { num: String, description: String, checked: bool, beads_issue_id: Option<String>, beads_status: Option<String> }` and `ChangeTaskMapping { tasks: Vec<TaskMappingEntry>, has_legacy_orphans: bool }` and `SyncMissingResult { created: Vec<String>, errors: Vec<String> }` structs in `src-tauri/src/commands/openspec.rs`, all deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
- [ ] 1.2 Add a private helper `resolve_task_num_from_labels_then_title(labels: &[String], title: &str) -> Option<String>` in `src-tauri/src/commands/openspec.rs` that returns the first label of the form `task:<num>` (stripped) or, if none exists, falls back to `extract_task_num(title)`.
- [ ] 1.3 Add a private helper `parse_tasks_md_entries(tasks_md: &str) -> Vec<(String /* num */, String /* description */, bool /* checked */)>` that walks lines, applies `parse_task_line`, and captures the trimmed description text after the `N.M ` prefix. Preserves file order.

## 2. Backend command: `get_change_task_mapping`

- [ ] 2.1 Add `pub async fn get_change_task_mapping(project_path, change_slug, registry) -> Result<ChangeTaskMapping, String>` to `src-tauri/src/commands/openspec.rs`. Read `tasks.md` via `read_change_artifact`, parse it with `parse_tasks_md_entries`.
- [ ] 2.2 Query Dolt for non-feature/non-epic issues carrying `openspec:<slug>`, joined to their labels. Group the result rows in Rust into `(issue_id, status, title, labels: Vec<String>)`.
- [ ] 2.3 For each issue, compute its task number via `resolve_task_num_from_labels_then_title`. Build a `HashMap<String, (String, String)>` of `N.M -> (issue_id, status)`; track the count of issues that resolve to `None` for `has_legacy_orphans`.
- [ ] 2.4 Build the ordered `Vec<TaskMappingEntry>` from the parsed tasks.md entries, looking each `N.M` up in the map. Set `has_legacy_orphans = unresolved_count > 0`.
- [ ] 2.5 Register the command in `src-tauri/src/lib.rs` under both `tauri::generate_handler!` and `tauri_specta::collect_commands!` alongside the other `openspec::*` commands.

## 3. Reconcile robustness

- [ ] 3.1 In `reconcile_tasks_checkboxes` (`src-tauri/src/commands/openspec.rs` around line 630), modify the issue-row fetch to also fetch labels (one extra join, the same pattern as `get_change_dependencies`).
- [ ] 3.2 Replace the `extract_task_num(title)` call when building `status_map` with `resolve_task_num_from_labels_then_title(labels, title)`. Behavior is unchanged for issues without `task:*` labels.

## 4. Backend command: `sync_missing_beads_tasks`

- [ ] 4.1 Add `pub async fn sync_missing_beads_tasks(project_path, change_slug, epic_id, registry, settings, server_registry) -> Result<SyncMissingResult, String>`. Reuse the mapping computation from §2 (extract `build_mapping(...)` as a private helper called by both).
- [ ] 4.2 If `has_legacy_orphans` is true, return `Err("legacy import detected for change <slug> — sync disabled. Resolve manually or remove the orphan label.")`. Create nothing.
- [ ] 4.3 Resolve the `bd` binary via `find_bd` and the project's bd env via the existing path used by `reconcile_openspec_checkboxes`. Resolve the three context labels via the same scheme as the import skill (branch / worktree / repo).
- [ ] 4.4 For each `TaskMappingEntry` with `beads_issue_id == None`: invoke `bd create --title "<N.M> <description>" --description "<openspec/changes/<slug>/ context + verbatim task text>" --type=task --priority=2`; parse the new issue ID from stdout; then `bd tag <id> openspec:<slug>` + `bd tag <id> task:<N.M>` + three context tags; then `bd dep add <id> <epic_id>`.
- [ ] 4.5 If any of the four post-create steps fails for an issue, record `format!("{}: {}", new_id, step_error)` in `SyncMissingResult.errors` but continue processing remaining tasks. Return the populated `SyncMissingResult`.
- [ ] 4.6 Register the command in `src-tauri/src/lib.rs` under both `tauri::generate_handler!` and `tauri_specta::collect_commands!`.

## 5. Backend tests

- [ ] 5.1 In `src-tauri/src/commands/openspec.rs::tests`, add `resolve_task_num_label_first` — issue with a `task:2.1` label and a `Rewritten` title resolves to `"2.1"`.
- [ ] 5.2 Add `resolve_task_num_title_fallback` — issue with no `task:` label and title `1.1 something` resolves to `"1.1"`.
- [ ] 5.3 Add `resolve_task_num_unbound` — issue with no `task:` label and title `Task 1: Coupons` resolves to `None`.
- [ ] 5.4 Add `parse_tasks_md_entries_preserves_order` — input with 2.1 listed before 1.3 yields entries in that order.
- [ ] 5.5 Add an integration-style test for `get_change_task_mapping` against a temp Dolt registry: seed three child issues (two with `task:` labels, one with N.M title only), assert `tasks` is correctly populated and `has_legacy_orphans == false`.
- [ ] 5.6 Add a test for legacy detection: seed a child issue with `openspec:<slug>` label but title `Task 1: ...` and no `task:` label; assert `has_legacy_orphans == true`.
- [ ] 5.7 Add `sync_missing_refuses_on_legacy` — when `has_legacy_orphans == true`, the command returns `Err` and no `bd create` calls fire (mock `find_bd` to a panic-on-call binary path or verify no insert hits the DB via a post-sync count).
- [ ] 5.8 Add `sync_missing_creates_only_unmapped` — seed a mapping with two bound and two unbound, run sync, assert exactly two new issues are created and each carries `task:<N.M>` + `openspec:<slug>` labels and an edge to the epic.

## 6. IPC and bindings

- [ ] 6.1 Run `bun tauri build` (or the existing `specta` codegen script) to regenerate `src/bindings.ts` with the new types and commands. Verify the generated names: `getChangeTaskMapping`, `syncMissingBeadsTasks`, `ChangeTaskMapping`, `TaskMappingEntry`, `SyncMissingResult`.
- [ ] 6.2 Add `getChangeTaskMapping(projectPath, changeSlug): Promise<ChangeTaskMapping>` and `syncMissingBeadsTasks(projectPath, changeSlug, epicId): Promise<SyncMissingResult>` wrappers in `src/ipc.ts`, matching the style of `getChangeBeadsProgress` and `getChangeDependencies`.

## 7. Frontend: ChangeCard disclosure

- [ ] 7.1 In `src/components/changes-browser/ChangeCard.tsx`, add `const [tasksOpen, setTasksOpen] = useState(false)` near the other `useState` calls. Only render the disclosure when `importedEpicId` (already computed) is non-null.
- [ ] 7.2 Add a small button below the progress bars: `▸ View tasks` / `▾ Hide tasks`. Style consistent with the existing artifact chip row. Clicking toggles `tasksOpen`.
- [ ] 7.3 When `tasksOpen` is true, render `<TaskMappingPanel changeSlug={change.slug} epicId={importedEpicId!} />` inside the card.

## 8. Frontend: TaskMappingPanel

- [ ] 8.1 Create `src/components/changes-browser/TaskMappingPanel.tsx` exporting `TaskMappingPanel`. Props: `changeSlug: string`, `epicId: string`. Lifts `useActiveProject` and `useAppState` like `ChangeCard`.
- [ ] 8.2 Use a `useEffect` with the `let cancelled = false` idiom to call `getChangeTaskMapping(project, changeSlug)`, key on `[project, changeSlug, allTasks]` (pull `allTasks` from the existing `useTasks()` hook so the cache-invalidation signal re-fetches the mapping the same way the beads progress effect does).
- [ ] 8.3 Render a compact table: columns `N.M`, description (truncate to ~60 chars with title attribute for full text), status badge (use `STATUS_CONFIG` palette borrowed/adapted from `ChangeCard`), and an issue chip. Unbound rows render an em-dash in the issue column.
- [ ] 8.4 Make each bound issue chip a button that calls `setState({ view: 'all', taskId: entry.beads_issue_id })` — same pattern as the existing `imported → <epic>` pill in `ChangeCard.tsx`.
- [ ] 8.5 Add aria-labels: each row's chip uses `aria-label={"Open issue " + entry.beads_issue_id + " for task " + entry.num}`.

## 9. Frontend: Sync footer affordance

- [ ] 9.1 Below the table, compute `unboundCount = tasks.filter(t => t.beads_issue_id == null).length`. Render conditional footer:
  - If `has_legacy_orphans`: muted text "Older-style import detected — sync disabled."
  - Else if `unboundCount > 0`: a `<button>` labelled `Sync ${unboundCount} missing tasks`.
  - Else: nothing.
- [ ] 9.2 The sync button click handler should disable the button, call `syncMissingBeadsTasks(project, changeSlug, epicId)`, on success refetch the mapping and toast/log any non-empty `errors` array; on rejection log to the console and re-enable.

## 10. Skill update

- [ ] 10.1 Edit `.claude/skills/openspec-beads-import/SKILL.md` step 5 — change the example `bd create` titles to use the `N.M <description>` form explicitly (e.g. `bd create --title="1.1 New class CouponsPoller..." ...`) and add a one-line bold note: "Title MUST begin with `N.M ` (the dotted-decimal task number). Required for label-fallback resolution."
- [ ] 10.2 In the per-child tagging block in step 5, add `bd tag $id "task:N.M"` (with the N.M from the corresponding tasks.md line). State that the four tags `openspec:<change-id>`, `task:N.M`, plus the three context labels are MANDATORY for each child issue.
- [ ] 10.3 If `.agents/skills/openspec-beads-import/SKILL.md` mirrors `.claude/skills/...`, apply the identical edits to it for parity (check first; only patch if it exists).

## 11. Verification

- [ ] 11.1 `cargo test -p beadspec_lib openspec::tests` passes (or whichever crate hosts `commands::openspec`).
- [ ] 11.2 `bun tsc --noEmit` passes after bindings regeneration.
- [ ] 11.3 Manual: `bun tauri dev` pointed at `/Users/dean/workspaces/campaign-ninja-app`. Open the Changes browser, expand `promotion-sync-pollers`. All 24 tasks render with `—` in the issue column. Footer reads "Older-style import detected — sync disabled."
- [ ] 11.4 Manual: in a new throwaway openspec change, follow the (updated) import skill, then add a task to `tasks.md`, expand the panel, click `Sync 1 missing tasks`, verify the new beads issue appears bound to that row within one sync cycle.
- [ ] 11.5 Manual: confirm `bd show <new-issue-id>` lists labels `openspec:<slug>`, `task:<N.M>`, and the three context labels.
- [ ] 11.6 `openspec validate openspec-task-mapping-and-sync` passes.
