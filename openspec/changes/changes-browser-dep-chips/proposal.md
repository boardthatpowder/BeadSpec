## Why

The Changes browser shows per-change task progress and a link to the imported Beads epic, but nothing about how OpenSpec changes relate to each other. When the user has wired Beads dependencies between epics (via `bd dep add`), that structure is currently invisible on the Changes page — they have to drill into the dependency graph of an individual epic to discover that change A is blocked by change B. Surfacing those links directly on each card lets the user understand sequencing at a glance and click straight through to a blocker.

## What Changes

- Each `ChangeCard` SHALL render a dependency section showing two groups of chips: **Blocked by** (upstream changes whose epics block this one) and **Blocking** (downstream changes whose epics this one blocks).
- Only epic↔epic dependencies between changes that both carry an `openspec:<slug>` label are considered. Deps pointing to non-OpenSpec epics are ignored.
- Each chip displays the related change's slug. Clicking a chip navigates to the related change's epic in `TaskDetailPanel` (same nav contract as the existing `imported → EPIC-ID` pill: `setState({ view: 'all', taskId })`).
- The dependency section is hidden entirely when the change has no imported epic, or when its epic has no inter-change deps. No empty rows or placeholder text.
- A new Tauri command `get_change_dependencies(project_path, change_slug)` SHALL return the upstream and downstream link lists for a given change.

Non-goals (explicit):
- No write path — the UI cannot add or remove dependencies. Use `bd dep add/remove`.
- No transitive / multi-hop traversal — direct deps only.
- No graph visualisation — flat chip rows only.
- No new behaviour for archived changes beyond what's already shown by `ChangeInfo.is_archived`.

## Capabilities

### New Capabilities
<!-- None — this extends an existing capability. -->

### Modified Capabilities
- `openspec-change-browser`: adds a new requirement for surfacing inter-change dependencies on each change card, derived from Beads epic-level dependency links.

## Impact

- **Tauri command** (new): `get_change_dependencies` in `src-tauri/src/commands/openspec.rs`. Reuses the `ProjectRegistry` pool and queries the `dependencies`, `labels`, and `issues` tables.
- **Type bindings**: new `ChangeDepLink` and `ChangeDependencies` types auto-generated via `specta` into `src/bindings.ts`.
- **Frontend IPC**: new wrapper in `src/ipc.ts`.
- **React component**: `src/components/changes-browser/ChangeCard.tsx` gains a dependency section. Fetch is gated on `beadsProgress.epic_id` being non-null, so cards without an imported epic make no extra IPC call.
- **No schema changes** to Dolt — purely a read-side feature on existing `dependencies` / `labels` data.
- **No CLI shellouts** — the query goes directly against the Dolt SQL pool, like `get_change_beads_progress` already does.
