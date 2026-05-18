## Context

The OpenSpec ↔ Beads linkage today is **conventional**: child issues are expected to carry `N.M`-prefixed titles, and `reconcile_tasks_checkboxes` parses those titles with `extract_task_num` (`src-tauri/src/commands/openspec.rs:187`). When the convention is violated — empirically, by a section-granularity import like `promotion-sync-pollers` (1 epic + 8 `Task N: …` children for 24 numbered openspec tasks) — every downstream consumer fails silently:

- `reconcile_tasks_checkboxes` ignores the issue → tasks.md checkboxes never reflect bd status.
- `get_change_beads_progress` still counts the issue, so the beads bar shows N/N children regardless of N.M coverage; the spec bar diverges based on actual tasks.md state.
- The user has no UI affordance to inspect which task maps to which issue.

The prior commit on this branch (`parse_progress` now uses `parse_task_line`) corrected the spec-side count to align with the importer's numbered-task definition; it did not fix the linkage problem itself.

A parallel implementation already exists in this file: `get_change_dependencies` (line ~395) demonstrates the pattern of joining `dependencies → issues → labels` filtered by `openspec:<slug>`, plus prefix parsing. The new mapping/sync work follows that pattern.

## Goals / Non-Goals

**Goals:**

- Make the openspec ↔ beads task link **structural** for new imports via a `task:N.M` label, so it survives prose titles and renames.
- Keep existing well-formed imports working — title-prefix extraction remains as a fallback.
- Surface the per-task mapping in the Changes browser so users can see at a glance which openspec tasks have backing beads issues and which don't.
- Provide an explicit, idempotent "sync missing tasks" action for changes that gain new openspec tasks after import.
- Detect legacy (section-granularity) imports and refuse to sync — never silently mix granularities.

**Non-Goals:**

- Retroactively repairing legacy imports (no auto-backfill, no auto-split of "Task N" section issues into per-N.M children). Out of scope per user decision.
- Auto-running sync on tasks.md save or on a timer — sync is explicit-only.
- Changing the beads progress counter contract (`get_change_beads_progress` remains slug-label based, counts all non-epic children regardless of granularity).
- Cleaning up the `allTasks` `useEffect` dependency in `ChangeCard.tsx:134` (cosmetic; defer).

## Decisions

### D1. Label scheme: `task:N.M` (one label per child)

**Decision.** Each Beads child issue created by `openspec-beads-import` receives a label of the form `task:N.M` (e.g. `task:1.1`, `task:4.8`) **in addition to** the existing `openspec:<slug>` and the three context labels.

**Why.** Labels are already the linkage vehicle for openspec changes (`openspec:<slug>`) and for ruflo context (`branch:`, `worktree:`, `repo:`). Adding a fourth namespace `task:` keeps everything in one consistent schema, requires no DB migration, and is queryable via the existing `labels` table. Splitting on first colon (per the project convention noted in spec context) makes `task:1.1` unambiguous even with future namespaces.

**Alternatives considered.**

- *New column on `issues`*: would require a Dolt migration coordinated across all consumer projects (campaign-ninja-app, etc.). Rejected — too invasive for what is essentially a small linkage hint.
- *Embed task number in issue ID*: bd IDs are opaque; rebuilding the ID scheme would break the universe. Rejected.
- *Pure title-prefix convention (status quo)*: brittle, demonstrated to fail. Rejected.

### D2. Resolution precedence: label first, title fallback

**Decision.** `reconcile_tasks_checkboxes` and the new `get_change_task_mapping` both resolve a child issue's task number by:

1. Looking for any label matching `^task:` and stripping the prefix.
2. If no `task:` label exists, calling `extract_task_num(title)` as today.
3. If neither yields a parseable `N.M`, the issue is "unbound" (becomes a legacy orphan signal).

**Why.** Backwards-compatible: existing well-formed imports (titles like `1.1 description`) keep working without re-tagging. New imports become robust to title edits. Legacy section-granularity imports (titles like `Task 1: …`) fall through both checks and are reliably detectable.

**Alternatives considered.**

- *Title first, label fallback*: would let a stale title (e.g. someone manually edited `1.1 …` → `Rewritten as …`) silently unbind a correctly-labelled issue. Rejected.
- *Require both to agree*: too strict; would forbid harmless title edits. Rejected.

### D3. New IPC shape: a single mapping query, a single sync mutation

**Decision.** Two new commands in `src-tauri/src/commands/openspec.rs`:

- `get_change_task_mapping(project_path, change_slug) -> ChangeTaskMapping` — pure read; returns the ordered task list paired with bindings and the `has_legacy_orphans` flag.
- `sync_missing_beads_tasks(project_path, change_slug, epic_id) -> SyncMissingResult` — mutation; refuses on `has_legacy_orphans`.

Both follow the existing pattern (`get_change_beads_progress`, `get_change_dependencies`) — Tauri command, `ProjectRegistry` state, sqlx query, specta-typed return.

**Why.** One query and one mutation keep the IPC surface minimal. The mapping query is cheap (single SQL join + a small file read); UI can refetch freely. The sync mutation is rare and well-defined.

**Alternatives considered.**

- *Per-task IPCs (one-issue-at-a-time)*: chattier and racier; rejected.
- *Streaming sync*: not needed at expected scale (≤ 50 tasks/change).

### D4. Sync uses bd CLI shellout, not direct SQL writes

**Decision.** `sync_missing_beads_tasks` creates issues by invoking the `bd` CLI (`bd create … && bd tag … && bd dep add …`) via the existing `bd::runner::invoke_bd_in_project` helper. It does **not** write directly to Dolt.

**Why.** Beads owns its own data model and emits auto-export (`.beads/issues.jsonl`) on every write — bypassing the CLI would skip the export hook and could desync the jsonl from Dolt, breaking PRs and other tools. Following the same pattern as `reconcile_openspec_checkboxes` (`openspec.rs:714`).

**Alternatives considered.**

- *Direct SQL insert*: faster but breaks the contract above. Rejected.

### D5. Legacy detection is a boolean, not granular

**Decision.** `ChangeTaskMapping.has_legacy_orphans` is a single boolean: any `openspec:<slug>`-tagged non-epic child that cannot be resolved to a `N.M` task flips it true. We do **not** enumerate the orphan IDs in the response.

**Why.** The UI's only legitimate use is "should I show 'sync disabled' instead of the button?". Enumerating orphans invites a backfill workflow that's explicitly out of scope. Keep the door closed by not exposing the data.

### D6. UI surface: inline expandable disclosure on ChangeCard

**Decision.** Add a `<details>`-style disclosure below the progress bars on `ChangeCard.tsx`. Closed by default. On first expand, lazy-fetch `get_change_task_mapping` and render `<TaskMappingPanel>`. Re-renders driven by the same `allTasks` cache invalidation already used for the existing beads-progress effect, so any `bd close` flows back into the panel within a sync cycle.

**Why.** Matches the user's stated preference. Inline keeps the panel in the same visual context as the progress bars it explains. Lazy-loading keeps the per-card render cost zero until the user opts in.

**Alternatives considered.**

- *Tab on TaskDetailPanel*: would scatter information; rejected per user direction.
- *Modal*: over-weight for what is essentially a sub-section view; rejected.

### D7. Skill update strategy

**Decision.** Edit `.claude/skills/openspec-beads-import/SKILL.md` in two places:
- Step 5 (child creation) prose mandates the `N.M description` title format (with example).
- Step 5 (or a new 5c) adds `bd tag $id "task:N.M"` to the tagging block alongside `openspec:<change-id>`.

**Why.** Skills are the contract for agent-driven imports. Codifying the rule there fixes the systemic source of legacy imports going forward.

## Risks / Trade-offs

- **Risk**: An agent following an older cached copy of the skill creates a new section-granularity import. → **Mitigation**: detection still kicks in via `has_legacy_orphans` and the panel suppresses the sync button with a clear message; user noticed; user re-runs import correctly.
- **Risk**: A new task is added to `tasks.md` between mapping fetch and sync click → sync creates an issue for it (fine) but the mapping is stale until refetch. → **Mitigation**: on sync success the panel invalidates and refetches the mapping (and the cache event flushes the parent `useTasks`).
- **Risk**: `bd dep add` fails after `bd create` succeeds in the sync loop, leaving an orphan issue without a parent edge. → **Mitigation**: log the failure into `SyncMissingResult.errors` and surface it in the UI; the issue is still tagged and findable by `openspec:<slug>`, so the next sync click can recover (it'll see the issue and skip the create, but won't re-attempt the dep edge — accept this as the cost of bd-CLI write atomicity).
- **Trade-off**: Title-fallback resolution means an issue can be re-bound by editing its title. That's intentional but means a typo in a freshly-edited title could orphan it momentarily. Acceptable — the label takes precedence and is the durable link.
- **Trade-off**: We treat any unresolved child as "legacy". A user who manually creates a one-off bd issue tagged `openspec:<slug>` (with a free-form title and no `task:` label) will flip the change into sync-disabled mode. Acceptable — this is exactly the case where automated sync shouldn't act.

## Migration Plan

No data migration. The change is additive:

1. Ship the Rust commands and UI behind no feature flag (small, low-risk surface).
2. Ship the skill update.
3. Existing imports stay valid via title fallback; existing reconcile behaviour unchanged.
4. Newly imported changes (post-skill-update) automatically gain `task:N.M` labels.

**Rollback**: revert the commit. `task:N.M` labels left on issues are inert — any future code that does not know about them simply ignores them. No cleanup required.

## Open Questions

- None blocking. The boolean `has_legacy_orphans` design leaves a clean opening for a follow-up "legacy import repair" change if the user later wants it (out of scope here).
