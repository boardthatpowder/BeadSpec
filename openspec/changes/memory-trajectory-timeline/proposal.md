## Why

`RufloMemoryPanel` flattens all Ruflo memory hits for the active issue into a single ranked list. Trajectory entries — the workflow's own audit trail written by `scripts/openspec-beads/memory.sh::obws_mem_write_trajectory` — are intermixed with retrospectives, followup-triage notes, and scope-change snippets. There is no ordering, no event-type chip, and no way to read the history of how an issue moved (claim → spec-gap → resume → close).

The data is already produced by `openspec-beads-work` on every claim, block, and close. It carries structured metadata: `|type:trajectory|`, `|outcome:<value>|`, and `|ts:<unix>|`. The only gap is a dedicated surface that reads those segments and renders them in chronological order.

## What Changes

- `RufloMemoryPanel` splits into two sub-tabs: **Search** (preserves the current free-form behavior including label-augmented query and expand-in-place) and **Trajectory** (new).
- Trajectory tab triggers a Ruflo search using a query tuned for trajectory recall: `<title> type:trajectory issue:<taskId>`. Results are filtered client-side to entries whose `key` contains `|type:trajectory|`.
- Each surviving entry is parsed: the segment `|outcome:<value>` becomes the event-type chip; the trailing `|ts:<unix>` becomes the timestamp. Entries are sorted by `ts` descending (most recent first).
- Each row renders: timestamp (relative + absolute hover), outcome chip (color-coded per outcome value, neutral fallback), short preview, and expand-in-place full content (matching the existing Search idiom).
- Empty state: instructive blurb pointing at the openspec-beads workflow.
- Loading and error states mirror the existing Search behavior.
- No new IPC; no new Tauri command; no new Rust code. Frontend-only changes.
- Sub-tab state resets to Search when the active `taskId` changes.

Non-goals:
- No write path — the UI does not create trajectory entries.
- No cross-issue trajectory aggregation — per-issue only. A namespace-level browser is a separate change (`memory-namespace-browser`).
- No graph/diagram view — flat timeline rows only.
- No new memory key segments — reads what `memory.sh` already writes.
- No backend filter — client-side `|type:trajectory|` segment check. Ruflo CLI does not support key-fragment filtering today.
- No persistence of selected sub-tab across reloads (default always returns to Search).
- No paginated history — Ruflo CLI result-set cap (~20) is a known limitation; pagination is a follow-up.
- No integration with the dolt-log real-time polling — trajectory entries are fetched on demand, not pushed via Tauri events.

## Capabilities

### New Capabilities
<!-- None — this extends an existing capability. -->

### Modified Capabilities
- `ruflo-memory-panel`: extends the panel with a 2-segment sub-tab control (Search / Trajectory) and a new Trajectory sub-tab that surfaces chronological trajectory audit entries per issue.

## Impact

- `src/components/task-detail/RufloMemoryPanel.tsx` — add `subTab` state, a 2-segment control, refactor existing state into a `searchTab` object, render `MemoryTrajectoryTab` conditionally.
- `src/components/task-detail/MemoryTrajectoryTab.tsx` (new) — owns trajectory state machine (`TrajectoryLoadState` discriminated union), `parseTrajectoryKey` parser, `outcomeChipClass` helper, `formatRelative` timestamp helper, sort, and render.
- No changes to `src-tauri/` (zero backend or IPC changes).
- No `src/bindings.ts` regeneration needed.
- No new npm/crate dependencies.
- Tests: new unit tests for `parseTrajectoryKey`, `outcomeChipClass`, `formatRelative`; new component tests for `MemoryTrajectoryTab` states; updated component test for sub-tab reset in `RufloMemoryPanel`.
