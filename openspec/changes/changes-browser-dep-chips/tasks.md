## 1. Backend types & query

- [x] 1.1 Add `ChangeDepLink { slug: String, epic_id: String }` and `ChangeDependencies { upstream: Vec<ChangeDepLink>, downstream: Vec<ChangeDepLink> }` structs in `src-tauri/src/commands/openspec.rs`, both deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
- [x] 1.2 Add a helper `resolve_change_epic_id(pool, change_slug) -> Result<Option<String>, String>` that runs the same `openspec:<slug>` label query as `get_change_beads_progress` and returns the first epic/feature-typed issue ID, or `None`.
- [x] 1.3 Add `get_change_dependencies(project_path, change_slug, registry)` Tauri command that: (a) resolves the source epic ID via the helper, returning empty `ChangeDependencies` if none; (b) runs the upstream join query (`dependencies d → issues i → labels l` where `d.issue_id = ?`, `l.label LIKE 'openspec:%'`, `i.issue_type IN ('epic','feature')`, `i.status != 'deleted'`, `i.id != source_epic_id`); (c) runs the symmetric downstream query keyed on `d.depends_on_id`; (d) parses each label by `strip_prefix("openspec:")` into a slug; (e) deduplicates by `epic_id` per direction.
- [x] 1.4 Register the new command in `src-tauri/src/lib.rs` in both `tauri::generate_handler!` and the `tauri_specta::collect_commands!` macro alongside the other `openspec::*` commands.

## 2. Backend tests

- [x] 2.1 Add a unit test in `openspec.rs` covering `strip_prefix("openspec:")` parsing for normal slugs and edge cases (`openspec:foo:bar` → `foo:bar`, empty after prefix is rejected).
- [x] 2.2 Add an integration-style test that exercises `get_change_dependencies` against a temp Dolt registry: seed two epic issues with `openspec:a` / `openspec:b` labels and a single dep row, assert upstream + downstream lists.
- [x] 2.3 Add a test for the self-dep filter: when `dependencies` contains a row pointing the source epic to itself, the response excludes it.
- [x] 2.4 Add a test confirming non-OpenSpec dependencies (epic without an `openspec:*` label) are filtered out.

## 3. IPC + bindings

- [x] 3.1 Run `bun tauri build` (or the existing `specta` codegen script) to regenerate `src/bindings.ts` with the new types and command.
- [x] 3.2 Add `getChangeDependencies(projectPath, changeSlug): Promise<ChangeDependencies>` wrapper in `src/ipc.ts`, matching the style of `getChangeBeadsProgress`.

## 4. Frontend integration

- [x] 4.1 In `ChangeCard.tsx`, add `useState<ChangeDependencies | null>(null)` for deps state.
- [x] 4.2 Add a `useEffect` that calls `getChangeDependencies(project, change.slug)` only when `beadsProgress?.epic_id` is non-null. Key on `[project, change.slug, beadsProgress?.epic_id, allTasks]` so changes to the global task cache refresh the chips. Use the `let cancelled = false` cancellation idiom already present in the file.
- [x] 4.3 Pass the loaded `ChangeInfo[]` down from `ChangesBrowser.tsx` to each `ChangeCard` so the card can resolve a chip's `name` / `is_archived` from its `slug` (fall back to the slug if no matching directory exists).
- [x] 4.4 Render a `<DependencyChips>` sub-section after the artifact row in `ChangeCard.tsx`. Show a "Blocked by" row when `upstream.length > 0` and a "Blocking" row when `downstream.length > 0`. Hide the whole section when both arrays are empty.
- [x] 4.5 Style each chip with the same nav contract as the existing `imported → EPIC-ID` pill: `onClick={() => setState({ view: 'all', taskId: link.epic_id })}`. Use a neutral palette consistent with surrounding chips; dim archived targets via `opacity-60`.
- [x] 4.6 Add `aria-label`s on chips (`"Blocked by ${slug} — open epic"` / `"Blocking ${slug} — open epic"`).

## 5. Verification

- [x] 5.1 `cargo test -p beadspec_lib openspec::tests` passes (or whichever crate hosts `commands::openspec`).
- [x] 5.2 `bun tsc --noEmit` passes after bindings regeneration.
- [ ] 5.3 Manual: `bun tauri dev`, open a project with at least two imported OpenSpec changes, run `bd dep add EPIC-A EPIC-B`, verify both cards re-render within one task-cache cycle showing the matching "Blocked by" and "Blocking" chip respectively. Click each chip and confirm `TaskDetailPanel` opens on the related epic.
- [ ] 5.4 Manual: confirm a change with no imported epic shows no dependency section and the Network/IPC log shows no `get_change_dependencies` call for that card.
- [x] 5.5 `openspec validate changes-browser-dep-chips` passes.
