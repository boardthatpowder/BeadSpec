## Context

The existing `dolt_log()` poller in `src-tauri/src/db/watchers.rs` and `db/poller.rs` already drives the real-time task list: it diffs the commit log on a 2-second cadence, detects changes to the `issues`, `labels`, and `dependencies` tables, and emits `task_list_changed` on the Tauri event bus. That same diffing logic, lightly extended, can produce semantically labelled events (`bd.close`, `bd.create`, `bd.dep_add`, …) routed to a new parallel topic `workflow:activity`.

Two other signal sources have no existing infrastructure but are cheap to add:

1. **Hook side-channel** — hooks already write to ruflo memory (trajectories, findings). A parallel key convention (`|type:event|kind:<k>|ts:<unix>|`) lets hooks optionally export structured events to a 3-second poller. Zero changes to existing hook behaviour.
2. **GitNexus filesystem poller** — the `.claude/cache/gitnexus-*-ack` and index JSON files already track analysis state. A 5-second mtime comparison detects staleness or refresh without shelling out.

All three sources fan into a single in-process ring buffer and a single Tauri topic so the frontend subscribes once.

## Goals / Non-Goals

**Goals:**
- Single `workflow:activity` Tauri event topic; all three sources route through it.
- New `ActivityEvent` struct with `specta::Type` so TypeScript bindings are auto-generated.
- `list_recent_events(limit, since_ts?)` command seeds the frontend on mount.
- In-memory ring buffer, 7-day horizon, ≤5k entries; eviction at poll time.
- Frontend: virtualised list, kind multi-select, time-range pills (last hour / today / week), auto-pin-to-bottom with "Jump to latest" pill.
- Filter state in URL hash (`activityKinds`, `activityRange`), consistent with other views.
- Hook writeback convention documented with copy-paste snippet; adoption is incremental.

**Non-Goals:**
- No new Dolt schema. No SQLite table. Feed is a derived, in-process projection.
- No hook behaviour changes; writeback is purely additive.
- No cross-window notification badges (this change is the foundation; the notification surface is follow-up).
- No edit/delete events from UI.
- No branch/worktree scoping in v1.
- No persistent replay across restarts beyond what ruflo memory already holds.

## Decisions

### 1. Single topic, three sources merged in a Rust module

One topic (`workflow:activity`) means the frontend subscribes once and the backend can evolve the source mix without API changes. `src-tauri/src/events/activity.rs` owns the `ActivityRingBuffer`, exposes one entry point `emit_event(handle, ActivityEvent)` called by all three sources, and serialises every event on the topic. Sources are wired up at app startup and each call `emit_event` independently.

**Alternative considered:** per-source topics (`workflow:activity:bd`, `workflow:activity:hook`, …). Rejected: forces N Tauri subscriptions on the frontend, complicates filter logic, harder to evolve source mix.

### 2. `bd` source piggybacks on the existing `dolt_log()` poller — zero new poller

The existing diff logic in `db/poller.rs` already detects per-table changes. Extending it to call `events::activity::emit_bd_event(handle, kind, issue_id, summary)` for each classified change costs roughly 10 lines. The poller is already debounced at 2 seconds; no additional latency introduced.

**Alternative considered:** separate poller for bd events. Rejected: duplicated debounce logic, potential double-emit of `task_list_changed` and `workflow:activity`.

### 3. Hook source is an OPTIONAL `ruflo memory store` writeback convention

Key schema: `branch:<b>|worktree:<w>|repo:<r>|type:event|kind:<k>|ts:<unix>`. Value JSON: `{ "summary": "<≤120 chars>", "detail": {…}, "correlation_id"?: "<id>" }`. A new poller in `events::activity` calls `ruflo memory search -q 'type:event'` every 3 seconds, watermarks on the highest `ts:` segment seen in the current process lifetime, and emits only rows newer than the watermark. Memory rows are never deleted by the feed.

Key segments are `|`-delimited; the CLAUDE.md "split on first colon only" rule applies per segment (each segment is `split_once(':')`), not across the whole key. This is explicitly documented.

**Alternative considered:** filesystem-watch on hook log files. Rejected: no structured payload, fragile path assumptions.

**Alternative considered:** a dedicated HTTP side-channel. Rejected: heavyweight, no existing infrastructure.

### 4. GitNexus source is a filesystem mtime poll at 5-second cadence

Reads `.claude/cache/gitnexus-*-ack` and `.claude/cache/gitnexus-*.json` mtime pairs. If the newest index JSON mtime is more than 5 minutes newer than the newest ack mtime, emits `kind:gitnexus.index_stale`. When an index JSON mtime advances compared to its previous poll value, emits `kind:gitnexus.index_refreshed`.

**Alternative considered:** call `mcp__gitnexus__list_repos` via a shell-out. Rejected: heavier async dependency; we only need file stats.

### 5. `ActivityEvent` payload shape

```rust
pub struct ActivityEvent {
    pub id: String,          // uuid v4, generated at emit time
    pub ts: String,          // RFC 3339
    pub kind: String,        // dotted, lowercase: "bd.close", "hook.pre_commit_risk", …
    pub source: String,      // "bd" | "hook" | "gitnexus"
    pub summary: String,     // ≤120 chars
    pub detail: serde_json::Value,
    pub correlation_id: Option<String>,  // issue id, commit sha, or absent
}
```

Derives `serde::Serialize`, `serde::Deserialize`, `specta::Type`, `Clone`. Auto-generated into `src/bindings.ts` — no hand-written TypeScript.

### 6. Initial load via `list_recent_events(limit: u32, since_ts: Option<String>)`

Default limit 200. Returns ring-buffer slice newer than `since_ts` (ISO-8601 string), or all entries if omitted, most-recent-first. Frontend caches with TanStack Query; live events from the Tauri topic are appended to the cache and trigger re-render without a full refetch.

### 7. Frontend: virtualised list, kind multi-select, time-range pills, auto-follow

Virtualised list reuses the `@tanstack/react-virtual` pattern already present in `TaskList`. Kind multi-select uses the existing `LABEL_CHIP_COLORS` family from `TaskListItem.tsx` for kind badge colours. Range pills default to "today". Filter keys in URL hash: `activityKinds=bd.close,hook.pre_commit_risk` and `activityRange=hour|today|week`, following the `HashStateContext` pattern used by other views.

Auto-follow: a `useAutoFollow` hook maintains a ref to the scroll container; it disables auto-scroll when the user scrolls more than 50px above the bottom, and a "Jump to latest" pill appears. Clicking the pill re-enables auto-follow and scrolls to the bottom.

### 8. No write API

Events come from the three sources only. Manual injection: `ruflo memory store -k "…|type:event|kind:demo|ts:$(date +%s)" -v '{"summary":"…"}'`. This is documented as the escape hatch, not an in-app feature.

### 9. Capability split: `workflow-activity-feed` + `hooks-event-bus`

`workflow-activity-feed` owns the view, the ring buffer, the IPC command, and the Tauri topic. `hooks-event-bus` owns the writeback convention, the JSON schema for hook-emitted events, and the ruflo memory poller. Splitting them lets a future change evolve the hook contract (e.g. add worker-specific kinds, schema versioning) without touching the feed UI spec.

## Risks / Trade-offs

- **Ring buffer is in-process only.** App restart loses feed history from the bd and gitnexus sources. Mitigation: the ruflo memory poller backfills the last 7 days of `type:event` rows on startup; `dolt_log()` replays recent diffs. Acceptable v1 trade-off.
- **Hook writeback adoption is gradual.** Feed will be sparse for hook events until hooks opt-in. Mitigation: `.claude/hooks/README.md` ships with a one-line snippet. A follow-up bd task (not bundled here) can add writeback to `ruflo-pre-commit.sh` as an example.
- **Poller contention at startup.** Three pollers starting simultaneously. Mitigation: stagger startup by 1s each (bd at 0s offset, ruflo memory at 1s, gitnexus at 2s) using a single shared `tokio::time::interval` per source.
- **`correlation_id` is best-effort.** Hook events carrying an issue id can be linked; gitnexus events have no natural id. UI shows the chip only when present.
- **Key pipe-delimiters vs colon-delimiters.** Memory keys are `|`-separated; each segment is then `split_once(':')`. Documented explicitly to avoid confusion with the CLAUDE.md "split on first colon only" rule.

## UI Design Direction

**Register:** `product` — use `impeccable craft` (product register) at implementation time, not the brand register.

**Aesthetic:** minimalist-utility. Compact monospaced timestamps, small neutral kind-badge chips reusing `LABEL_CHIP_COLORS` from `TaskListItem.tsx`, zero card-shadow inflation. Rows ≈ 28px at Comfortable density; expand to full-detail JSON inline on click. Filter row is single-line and does not wrap.

**Anti-references:** no animated splash on new events, no full-row gradients, no AI-stock sparkle iconography, no Discord-style avatars, no coloured left-border "severity" bars.

**Skills used at implementation:**
- `impeccable craft` — drafting `ActivityFeed.tsx`, `ActivityRow.tsx`, `ActivityFilters.tsx`.
- `impeccable audit` — diff review of the new components against `TaskListItem` / `KpiBar` aesthetic.
- `minimalist-ui` reference — condensing the filter row when it risks overflowing.

**ASCII mockup:**

```
┌────────────────────────────────────────────────────────────────┐
│ Activity   [bd ×] [hook ×] [gitnexus ×]   Last hour Today Week │
├────────────────────────────────────────────────────────────────┤
│ 14:02:11  [bd.close]      Closed BD-417 "fix env_fix import"   │
│ 14:01:48  [hook.commit]   risk 6/10 on commit 3829e9d          │
│ 14:00:02  [gitnexus]      Index refreshed (5545 sym, 8288 rel) │
│ 13:58:17  [bd.dep_add]    BD-419 → BD-417  (blocks)            │
│ 13:55:30  [hook.tdd]      TDD nudge: missing test for ImportE… │
│ ...                                                            │
│                                              ↓ Jump to latest  │
└────────────────────────────────────────────────────────────────┘
```
