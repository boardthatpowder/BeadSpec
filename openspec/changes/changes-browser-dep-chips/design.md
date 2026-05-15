## Context

The Changes browser (`src/components/changes-browser/ChangesBrowser.tsx` + `ChangeCard.tsx`) already shows per-change task progress, an "imported → EPIC-ID" pill that navigates to the linked Beads epic, and artifact links. `openspec-beads-import` creates exactly one epic-typed Beads issue per change, labelled `openspec:<slug>`. That epic can be linked to other epics via standard Beads dependencies (`bd dep add`). Today, those inter-epic links are only visible inside `TaskDetailPanel`'s `DependencyGraphTab` — there's no way to see, from the Changes page, that "change A is blocked by change B".

The data is already present and locally cheap to query:
- `dependencies` table holds `(issue_id, depends_on_id)` rows. The convention in this codebase (see `src-tauri/src/commands/read.rs:423-443`) is that `depends_on_id` is the upstream/blocker and `issue_id` is the downstream/dependent.
- `labels` table maps issue IDs to label strings. `openspec:<slug>` is the canonical label for "issue belongs to this change".
- `issues.issue_type ∈ {epic, feature, ...}` — only the first two represent change-level containers.

The work is a read-side feature: one new SQL query, one new Tauri command, one IPC wrapper, and a small UI section on `ChangeCard`.

## Goals / Non-Goals

**Goals:**
- Each `ChangeCard` shows two chip groups — **Blocked by** (upstream) and **Blocking** (downstream) — listing related OpenSpec changes derived from epic-level Beads dependencies.
- Each chip is clickable and navigates to the related change's epic in `TaskDetailPanel`, matching the existing `imported → EPIC-ID` pill behaviour exactly.
- The query is a single round-trip per change, gated on the change already having an imported epic. Cards without an epic make no extra IPC call.
- The dependency section is invisible when there's nothing to show — no empty rows, no placeholders.
- Auto-generated TypeScript bindings via `specta` / `tauri-specta`, consistent with existing OpenSpec commands.

**Non-Goals:**
- No write API. Editing dependencies stays in `bd dep add/remove` or the existing `DependencyGraphTab`.
- No transitive traversal. We only show direct (one-hop) deps. Multi-hop is the dependency graph's job.
- No visual graph. Flat chip rows only.
- No cross-change dependency creation flow in the Changes browser.
- No batch / bulk endpoint. Per-card fetch is fine at expected scale (dozens of changes); revisit if profiling shows otherwise.
- No special treatment for archived ↔ active links. Style the chip the same; the user can already see `is_archived` on the linked change's own card.

## Decisions

### 1. Backend: single SQL query joining `dependencies` → `labels` → `issues`

Add `get_change_dependencies(project_path, change_slug)` in `src-tauri/src/commands/openspec.rs`. Internally:

1. Resolve `epic_id` for `change_slug` (same query shape as `get_change_beads_progress`): find the unique issue with label `openspec:<slug>` and `issue_type ∈ ('epic', 'feature')` and `status != 'deleted'`. If none, return an empty `ChangeDependencies`.
2. One query for upstream (this epic depends on …):

   ```sql
   SELECT i.id AS epic_id, i.issue_type, l.label
   FROM dependencies d
   JOIN issues i ON i.id = d.depends_on_id
   JOIN labels l ON l.issue_id = i.id
   WHERE d.issue_id = ?                     -- the source epic
     AND l.label LIKE 'openspec:%'
     AND i.issue_type IN ('epic', 'feature')
     AND i.status != 'deleted'
   ```

3. Symmetric query for downstream, with `d.depends_on_id = ?`.
4. Parse `label` → strip the `openspec:` prefix to recover the slug. Resolve `is_archived` and `name` by scanning the filesystem the same way `list_changes` does (or returning just `slug` + `epic_id` and letting the frontend resolve from its already-loaded `ChangeInfo[]` — see Decision 3).

**Alternative considered:** Two-step lookup (raw `bd dep list` then per-id label fetch). Rejected because (a) it's an extra CLI shellout per call, (b) we already have a SQL pool, (c) the join is trivially expressible in one query.

**Alternative considered:** Wrap `bd dep list <epic-id> --json`. Rejected for the same shellout reason — and because `bd dep list` doesn't filter by label, so we'd have to over-fetch and filter in TS.

### 2. SQL convention: `issue_id` = dependent, `depends_on_id` = blocker

Confirmed by inspection of `src-tauri/src/commands/read.rs:423-443`. Stick with it. No renaming. The new types use semantic names (`upstream` = blockers, `downstream` = dependents) to keep the frontend free of database-table reasoning.

### 3. Frontend resolves `name` + `is_archived` from already-loaded `ChangeInfo[]`

The backend returns only `{ slug, epic_id }` per link. The frontend has the full `ChangeInfo[]` list in `ChangesBrowser` and threads it down to `ChangeCard`. Looking up `name` and `is_archived` by slug is O(N) once per card render; trivial.

**Why not return full `ChangeInfo`?** Two reasons: (a) it duplicates data the frontend already has, (b) it would require the backend to re-scan the filesystem for every dep call. Slug + epic_id is the minimum useful payload.

**Edge case:** A link can point to a slug that has no corresponding directory (e.g., the change was deleted but the Beads epic still exists). Frontend renders the chip with just the slug + epic_id; click still navigates to the epic. No directory lookup failure.

### 4. Fetch trigger: gate on `beadsProgress.epic_id`

The existing `getChangeBeadsProgress` effect in `ChangeCard.tsx` returns `epic_id`. Add a second effect that runs only when `epic_id` is non-null, calling `getChangeDependencies(project, change.slug)`. Cards with no imported epic skip the call entirely.

Cancellation pattern follows the existing `let cancelled = false` idiom in the same file.

### 5. UI layout: chips appear below the artifact row, hidden when empty

Two rows, each prefixed by a small label ("Blocked by" / "Blocking") and a horizontal chip list. Visual treatment matches the existing `imported → EPIC-ID` pill (small rounded pill, neutral-blue palette for upstream, neutral-amber for downstream — or whatever reads cleanly against the existing card). If `upstream.length === 0` and `downstream.length === 0`, render nothing.

**Click behaviour:** `setState({ view: 'all', taskId: epic_id })` — identical to the existing pill. No new navigation primitive.

### 6. No new spec capability

This adds one new requirement to the existing `openspec-change-browser` capability. Defining a separate `change-dependencies` capability would over-fragment the spec for a feature that's logically part of the changes browser.

## Risks / Trade-offs

- **Stale data after `bd dep add`** → The `useTasks` Tauri event invalidation cache fires for issue-level mutations; dep add/remove flips the `dependencies` table only. We need to either piggyback on the existing change-list refresh event (`changes_list_changed` already triggers re-fetches on the browser) or re-fetch when `allTasks` changes (current `getChangeBeadsProgress` effect already keys on `allTasks`). **Mitigation:** key the new effect on `[project, change.slug, beadsProgress?.epic_id, allTasks]` — `allTasks` changes whenever a relevant Tauri event fires, so the deps refresh comes for free.
- **N+1 IPC calls on large projects** → One call per card × number of cards. Today's typical scale is ~10–30 changes — fine. **Mitigation:** if it ever shows up in profiling, add a single batch command `get_all_change_dependencies(project_path)` that returns a `HashMap<slug, ChangeDependencies>`; the frontend swap is mechanical.
- **Self-deps** → If someone runs `bd dep add EPIC-1 EPIC-1`, the chip would link a change to itself. **Mitigation:** filter `epic_id != source_epic_id` in the SQL, or in Rust before returning.
- **Duplicate epics per change** → A misuse of `openspec-beads-import` could theoretically create two epic-typed issues with the same `openspec:<slug>` label. `get_change_beads_progress` already silently picks the first; we do the same for consistency. **Mitigation:** none beyond matching existing behaviour — fixing this is out of scope.
- **Label parsing** → The repo CLAUDE.md note is "split on first colon only". A label like `openspec:foo:bar` would parse to slug `foo:bar`. **Mitigation:** use `label.strip_prefix("openspec:")` in Rust — exactly equivalent to "split on first colon only" with no ambiguity.
