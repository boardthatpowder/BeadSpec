## Context

`RufloMemoryPanel` is mounted in `TaskDetailPanel` (line 293 of `TaskDetailPanel.tsx`) inside the Details tab, guarded by `rufloEnabled && rufloOnPath`. It calls the Tauri IPC command `rufloMemorySearch(query)` lazily on first expand and renders the resulting entries with an expand-in-place idiom (`expandedIndex` state). The IPC command shells out to `ruflo memory search "<query>" --format json` and returns a JSON string whose shape is `{ key: string; score: number; namespace: string; preview: string }[]`.

Memory keys follow the pipe-delimited convention defined in `scripts/openspec-beads/memory.sh`. Canonical key format:

```
<branch>|<worktree>|<repo>|openspec:<change-id>|issue:<issue-id>|type:<type>|outcome:<outcome>|ts:<unix>
```

Allowed `type` values per `memory.sh`: `trajectory`, `retrospective`, `followup-triage`, `scope-change`, `paused`.

Trajectory entries are written by `obws_mem_write_trajectory` on `bd close` / `bd update --blocked` via the `openspec-beads-work` skill. Current `outcome` values produced: `closed`, `blocked`. The brief reserves `claim`, `spec-gap`, `resume` as expected future values — the UI must not hard-fail on them.

The `preview` field returned by the IPC is a truncated excerpt; the full content is available only after a second IPC call or by expanding in place — we use the expand-in-place idiom rather than a second fetch.

Existing Search behavior summary (must be preserved verbatim on the Search sub-tab):
1. Query built as `"${title} ${nonSystemLabels.join(' ')}"` where non-system labels exclude `branch:`, `worktree:`, `repo:`, `openspec:` prefixes.
2. Results filtered to exclude `namespace === 'session'` and `namespace === 'default'`.
3. Each result shows a truncated preview (first 120 chars); clicking expands in place.
4. Fetch fires once on first expand, is not re-triggered on subsequent opens (until `taskId` changes).

## Goals / Non-Goals

**Goals:**
- Surface trajectory entries as a chronological per-issue timeline without changing the IPC contract.
- Preserve every existing Search behavior verbatim — all current spec scenarios continue to pass on the Search sub-tab.
- Treat `outcome` as an opaque string-keyed enum: known outcomes get a color, unknown ones get the neutral chip.
- Keep the surface dense and minimalist, consistent with existing chip aesthetics.
- Frontend-only change: zero modifications to `src-tauri/` or `src/bindings.ts`.

**Non-Goals:**
- No backend filtering — Ruflo CLI cannot filter by key fragments; filter in TypeScript.
- No multi-issue trajectory aggregation, no cross-change rollups.
- No editing or deletion of memory entries from the UI.
- No persistence of selected sub-tab across reloads.
- No animated transitions or scroll behavior beyond the standard expand-in-place idiom.

## Decisions

### 1. Sub-tab UI: segmented control inside the existing collapsible

Render the existing `<button>` header unchanged. When `open` is true, render a 2-segment control (Search / Trajectory) above the result list. Sub-tab state lives in `RufloMemoryPanel` as `subTab: 'search' | 'trajectory'`, default `'search'`, reset to `'search'` on `taskId` change.

**Rationale:** keeps single-collapsible affordance; a top-level tab list would visually inflate the detail pane.

### 2. Trajectory query construction

Query string: `${title} type:trajectory issue:${taskId}` (taskId appended so Ruflo's hybrid index prefers entries containing the issue id). If `title` is empty, drop it. The query never includes user labels — we don't want unrelated-label hits drowning out trajectory entries.

After the IPC returns, parse each result's `key`, keep only those whose segments contain `type:trajectory`. An optional secondary filter checks that `issue:` segment matches the current `taskId`; if the strict set is empty, fall back to the broader `type:trajectory` set. This handles legacy keys missing `issue:<id>`.

**Why not use the label-augmented query from Search?** Labels belong to the *issue context*, not the trajectory *event type*. Adding them increases false positives (retrospectives and scope-change entries share the same labels).

### 3. Key parsing

Inline helper `parseTrajectoryKey(key: string): { outcome?: string; ts?: number; issueId?: string; changeId?: string } | null`. Splits on `|`. For each segment `s`:

- `s.startsWith('type:')` → confirm value `=== 'trajectory'`. If not, return `null`.
- `s.startsWith('outcome:')` → `outcome = s.slice(8)`.
- `s.startsWith('ts:')` → `ts = Number(s.slice(3))` (NaN → `undefined`).
- `s.startsWith('issue:')` → `issueId = s.slice(6)`.
- `s.startsWith('openspec:')` → `changeId = s.slice(9)`.

Label-parse rule (split-on-first-colon-only) is honored implicitly: each segment is a single `prefix:rest` pair parsed with `startsWith` + `slice`, never `split(':')`.

### 4. Sort + grouping

Sort by `ts` descending (most recent first). No group separators — the brief asks for a flat chronological list. Each row prefixed by a relative timestamp ("2h ago") with the absolute ISO timestamp in a `title` attribute. If `ts` is undefined for an entry, sort it to the bottom and render the timestamp slot as "—".

### 5. Outcome chip palette

Known outcomes get a stable color; unknown fall through to neutral. Extensible mapping:

| outcome    | chip classes (Tailwind)              | semantic  |
|------------|--------------------------------------|-----------|
| `closed`   | `bg-emerald-500/10 text-emerald-400` | success   |
| `close`    | `bg-emerald-500/10 text-emerald-400` | alias     |
| `blocked`  | `bg-amber-500/10 text-amber-400`     | warning   |
| `paused`   | `bg-amber-500/10 text-amber-400`     | alias     |
| `claim`    | `bg-sky-500/10 text-sky-400`         | info      |
| `resume`   | `bg-sky-500/10 text-sky-400`         | info      |
| `spec-gap` | `bg-rose-500/10 text-rose-400`       | attention |
| default    | `bg-neutral-700/40 text-neutral-300` | unknown   |

The map lives local to `MemoryTrajectoryTab.tsx` — not added to a global palette.

Unknown outcomes render with the neutral default chip and a `title` attribute showing the raw value. No errors.

### 6. Empty / error / loading states

- **Empty (loaded, zero entries after filter):** instructive blurb — *"No trajectory yet. The `openspec-beads-work` skill writes a trajectory entry when this issue is claimed, blocked, or closed."*
- **Loading:** matches the existing Search "Loading…" affordance.
- **Error:** matches Search — "Could not load memories".
- **Trajectory tab fires its own IPC the first time it is opened** (lazy, mirroring Search). Switching back to Search uses Search's already-loaded cache; switching back to Trajectory reuses the trajectory cache. Both caches reset on `taskId` change.

### 7. State shape and `TrajectoryEntry` type

Current panel state moves into a `searchTab` object; the new trajectory tab gets a parallel `trajectoryTab` object. Types (all defined in or co-located with `MemoryTrajectoryTab.tsx`):

```ts
interface ParsedKey {
  outcome?: string;
  ts?: number;
  issueId?: string;
  changeId?: string;
}

interface TrajectoryEntry {
  key: string;
  preview: string;
  parsed: ParsedKey;
}

type TrajectoryLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; entries: TrajectoryEntry[] };
```

The `LoadState` discriminated union is intentionally duplicated (small) rather than parameterized — this preserves readability without generics overhead. The `searchTab` equivalent keeps its own `MemoryResult[]` shape unchanged.

### 8. Namespace filter

The existing Search tab excludes `session` and `default` namespaces. The Trajectory tab does NOT apply that filter — trajectory entries live under workspace-scoped namespaces and the namespace field is not a reliable discriminator for trajectory data. The `|type:trajectory|` segment is the authoritative filter.

**Alternative considered:** Mirror the Search namespace exclusion on Trajectory. Rejected because trajectory entries are stored under workspace-qualified keys (e.g. `branch:feat-foo|worktree:feat-foo|repo:BeadSpec|…`) and applying the namespace exclusion could silently drop valid hits if the namespace returned by Ruflo CLI doesn't match the workspace-scope convention.

### 9. Relative timestamp formatting

Use a simple `formatRelative(ts: number): string` helper that buckets into: "just now" (< 60 s), "Xm ago" (< 1 h), "Xh ago" (< 24 h), "Xd ago" (< 30 d), ISO date string (≥ 30 d). The helper is kept inline in `MemoryTrajectoryTab.tsx`. No external date library needed.

### 10. Component file layout

```
src/components/task-detail/
  RufloMemoryPanel.tsx          (modified)
  MemoryTrajectoryTab.tsx       (new)
```

`MemoryTrajectoryTab` is a named export; `RufloMemoryPanel` imports and renders it. No barrel re-export needed — both files are in the same directory and only `RufloMemoryPanel` is consumed by `TaskDetailPanel`.

## UI Design Direction

- **Register:** `product` (app UI). Implementers use `impeccable craft` (product register) to draft `MemoryTrajectoryTab.tsx` and `impeccable audit` to review the diff.
- **Aesthetic:** minimalist-utility — small chips, neutral palette aligned with the existing `LABEL_CHIP_COLORS` system in `src/components/task-list/TaskListItem.tsx`, dense rows, low chrome.
- **Anti-references:** no novelty chrome, no animated splashes, no AI-stock gradients, no card-shadow inflation.
- **Skills at implementation time:** `impeccable craft` to draft components, `impeccable audit` to review against the rest of the app, `minimalist-ui` reference for dense row layout.
- **ASCII mockup:**

```
┌─ Related memories ─────────────────────────── ▾ ─┐
│ [ Search ] [ Trajectory ]                         │
│ ─────────────────────────────────────────────── │
│ 2h ago   [closed]    "title: fix sidebar bug"     │
│ 6h ago   [spec-gap]  "Paused: blocked on epic…"   │
│ 1d ago   [claim]     "claimed bd-42 from ready"   │
│ 3d ago   [closed]    "title: extract panel"       │
└───────────────────────────────────────────────────┘
```

### 11. Integration point in `RufloMemoryPanel`

`MemoryTrajectoryTab` receives `taskId` and `title` as props. The parent `RufloMemoryPanel` holds `trajectoryTab` state (`TrajectoryLoadState`) and passes it down together with a `onLoad` callback so the parent controls the cache lifecycle (reset on `taskId` change). This avoids the child managing its own state that the parent needs to reset — keeping the single source of truth in `RufloMemoryPanel`.

The parent's `useEffect([taskId])` clears both `searchTab` and `trajectoryTab` to `{ status: 'idle' }` and resets `subTab` to `'search'`.

```tsx
// Sketch — exact API agreed during implementation
<MemoryTrajectoryTab
  taskId={taskId}
  title={title}
  state={trajectoryTab}
  onStateChange={setTrajectoryTab}
/>
```

If `state.status === 'idle'` and the tab is active, `MemoryTrajectoryTab` immediately fires the IPC call and lifts the resulting state via `onStateChange`. On subsequent renders with `status !== 'idle'`, it skips re-fetching.

## Risks / Trade-offs

- **Ruflo recall variance** — `ruflo memory search` ranks by hybrid similarity. Trajectory entries may not all appear in the top-K results for short titles. **Mitigation:** explicit `type:trajectory issue:<id>` tokens push relevant hits to the top; the fallback drops the `issue:` filter if the strict set is empty.
- **Outcome enum drift** — `memory.sh` may add new outcomes the UI doesn't know about. **Mitigation:** unknown outcomes render with the neutral default chip and a `title` attribute showing the raw value. No errors thrown.
- **Legacy keys missing `ts:`** — older entries may predate the canonical key. **Mitigation:** undefined `ts` sorts last; row still renders with "—" in the timestamp slot.
- **Result-set cap** — `ruflo memory search` caps results (likely ~20). For long-lived issues this could hide older trajectory entries. **Mitigation:** out of scope; documented as a known limitation. Paginated mode is a follow-up.
- **Cross-worktree trajectory leakage** — the fallback query (no `issue:` filter) may surface trajectory entries from unrelated issues on the same branch. **Mitigation:** the strict filter is applied first; the fallback is only used when zero entries survive the strict filter. In practice, the Ruflo hybrid index ranks `issue:<id>` matches above others, so leakage is unlikely in the top-K.
