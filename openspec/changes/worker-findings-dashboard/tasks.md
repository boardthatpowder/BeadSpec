## 1. Backend types & query

- [x] 1.1 Create `src-tauri/src/commands/workers.rs` with `WorkerFinding { issue_id: String, title: String, worker: String, priority: i32, status: String, notes_first_line: String, created_at: String }`, deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
- [ ] 1.2 Add a private helper `parse_worker_from_notes(notes: &str) -> Option<String>` using regex `^Auto-filed by ruflo-(?P<worker>[a-z0-9-]+) on `. Reuse the existing `regex` crate (already a transitive dep via `sqlx`/`tauri`; add it explicitly to `src-tauri/Cargo.toml` if not present).
- [ ] 1.3 Add `list_worker_findings(project_path, registry) -> Result<Vec<WorkerFinding>, String>` Tauri command that: (a) acquires the Dolt SQL pool for `project_path` via the existing `ProjectRegistry`; (b) runs `SELECT id, title, priority, status, notes, created_at FROM issues WHERE notes LIKE 'Auto-filed by ruflo-%' AND status IN ('open','in_progress') AND issue_type != 'deleted' ORDER BY created_at DESC`; (c) parses worker via the helper; (d) skips rows where the regex fails to match.
- [x] 1.4 Add `pub mod workers;` to `src-tauri/src/commands/mod.rs`.
- [ ] 1.5 Register `commands::workers::list_worker_findings` in `src-tauri/src/lib.rs` inside both `tauri_specta::collect_commands!` and `tauri::generate_handler!`.

## 2. Backend tests

- [ ] 2.1 Unit test `parse_worker_from_notes` for the canonical prefix (`Auto-filed by ruflo-security-audit on 2026-05-17T10:00Z. Branch: main`), for hyphenated worker names (`ruflo-test-gap-detector`), for a mid-string occurrence (must NOT match — anchored to start), and for a missing space before `on` (must NOT match).
- [ ] 2.2 Integration-style test against a temp Dolt registry: seed three issues — one with the canonical notes prefix, one with a `ruflo:<worker>` label but no matching notes, one with a different `Auto-filed by` author prefix. Assert only the first appears in the returned vec and the `worker` token is correctly parsed.
- [ ] 2.3 Test that closed issues are excluded (status filter) and that `issue_type = 'deleted'` rows are excluded.
- [ ] 2.4 Test that `created_at DESC` ordering is preserved when multiple findings share the same worker.

## 3. IPC + bindings

- [ ] 3.1 Run `bun tauri build` (or the existing specta codegen script) to regenerate `src/bindings.ts` with `WorkerFinding` and the `listWorkerFindings` command stub.
- [ ] 3.2 Add `listWorkerFindings(projectPath: string): Promise<WorkerFinding[]>` wrapper in `src/ipc.ts` using the existing `unwrap(commands.listWorkerFindings(projectPath))` idiom.

## 4. Frontend helper

- [ ] 4.1 Add `src/lib/worker-findings.ts` exporting `parseWorkerProvenance(notes: string | null | undefined): { worker: string; firstLine: string } | null` using the same anchored regex as the Rust helper. Document the coupling to `on-finding.sh` and to `parse_worker_from_notes`.
- [ ] 4.2 Add a unit test under `src/lib/__tests__/worker-findings.test.ts` mirroring the Rust cases from task 2.1 plus a `null` / `undefined` / empty-string trio.

## 5. TaskListItem chip

- [ ] 5.1 Confirm whether `Task` row payload already carries `notes` (likely yes via `bindings.ts`). If yes: in `TaskListItem.tsx`, compute `const provenance = parseWorkerProvenance(task.notes)` and render a chip *before* the existing `visibleLabels.map(...)` chip row. If no: hoist a `Map<issue_id, worker>` from a `useWorkerFindingsLookup(projectPath)` hook in the parent `TaskList` and pass `workerForRow` as an optional prop; chip renders when the prop is defined.
- [ ] 5.2 Update the `TaskListItemProps` `task` `Pick<>` set to include `notes` if the inline path is chosen.
- [ ] 5.3 Style the chip identically to other label chips: `text-[10px] px-1.5 py-0 rounded font-mono leading-4 max-w-24 truncate ${labelChipClass('worker:' + worker)}`. Use the `worker:` prefix so it picks up `LABEL_CHIP_COLORS.worker`. Apply `formatLabel('worker:' + worker)` so the chip text shows just the worker name (e.g. `security-audit`).
- [ ] 5.4 Add `title={provenance.firstLine}` so the full prefix is visible on hover, and `aria-label={"Filed by ruflo-" + provenance.worker}`.
- [ ] 5.5 Ensure the chip does NOT count toward the `task.labels.length > 2` `+N` overflow indicator.

## 6. WorkerFindingsPanel

- [ ] 6.1 Create `src/components/health/WorkerFindingsPanel.tsx` that uses `useQuery(['worker-findings', projectPath], () => listWorkerFindings(projectPath))` to fetch findings, groups them by `worker` (preserve insertion order from the DESC-ordered fetch), and renders one section per worker.
- [ ] 6.2 Each section header shows: worker name (with the same teal chip styling as the inline chip), total count, and a severity breakdown line `(1 critical, 4 high, 2 medium)` computed from `priority` via `priorityToSeverity()` in the helper. Hide severity counts of 0.
- [ ] 6.3 Each finding row shows: issue ID (using the existing `renderWithChips`-equivalent rendering or a plain navigation button), `P{priority}` styled via `PRIORITY_STYLE`, title (truncate), and `created_at` short-date. Clicking the row calls the existing workspace `openPinned(issue_id)` (see `task-workspace` spec) — match the keyboard/Enter contract used by `TaskListItem`.
- [ ] 6.4 Empty state: when `findings.length === 0`, render `"No worker findings. Run /audit, /ruflo-loop testgaps, or /ruflo-cost to generate some."` centred with the same neutral-600 chrome as the existing `"Click Re-run to start checks."` empty state.
- [ ] 6.5 Loading state: spinner matching the existing `CheckSection` spinner. Error state: red error pill with the error string.

## 7. BdHealthPanel tab strip

- [ ] 7.1 In `BdHealthPanel.tsx`, introduce a `useState<'checks' | 'findings'>('checks')` and render a small tab strip below the existing header. Style: underline tabs, `text-neutral-300` inactive, `text-neutral-100 border-b border-neutral-100` active. The strip is `border-b border-neutral-800` so it visually anchors to the header.
- [ ] 7.2 Move the existing body (`bdNotFound`, `projectNotConnected`, `allPassed`, and the `CHECKS.map(...)` render) into a `<ChecksBody />` sub-component or inline conditional, gated by `tab === 'checks'`.
- [ ] 7.3 When `tab === 'findings'`, render `<WorkerFindingsPanel />`.
- [ ] 7.4 The `Re-run` button is gated to `tab === 'checks'`. When the findings tab is active, the button is hidden (no `Re-run` for findings — they refresh via the task-cache cycle).
- [ ] 7.5 Verify the auto-run-on-mount effect (`useEffect` keyed on `[project, hasRun, runChecks]`) still triggers only the checks side and is not affected by tab state.

## 8. Verification

- [ ] 8.1 `cargo test -p beadspec_lib workers::tests` (or whichever crate hosts `commands::workers`) passes with all four backend tests.
- [ ] 8.2 `bun tsc --noEmit` passes after bindings regeneration.
- [ ] 8.3 `bun test src/lib/__tests__/worker-findings.test.ts` passes.
- [ ] 8.4 Manual: `bun tauri dev`, trigger `/audit` (or seed a Beads issue with `bd create -t bug ... && bd update <id> --notes "Auto-filed by ruflo-security-audit on $(date -u +%FT%TZ). Branch: main"`), confirm the new chip appears on its row in the task list and the issue appears under `ruflo-security-audit` in the Worker findings tab.
- [ ] 8.5 Manual: close the seeded issue via the task detail panel, confirm it disappears from the Worker findings tab within one task-cache refresh cycle.
- [ ] 8.6 Manual: confirm the `Checks` tab still auto-runs on mount and the `Re-run` button is hidden on the `Worker findings` tab.
- [ ] 8.7 `openspec validate worker-findings-dashboard` passes with zero errors.
