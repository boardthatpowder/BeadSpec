## Context

The `gitnexus-impact-reminder.sh` and `gitnexus-detect-reminder.sh` hooks write ACK marker files under `.claude/cache/` whenever Claude acknowledges a freshness nudge. The hooks derive staleness from the mtime of those markers and from the mtime of the `.gitnexus/` directory produced by `npx gitnexus analyze`. The project CLAUDE.md says: "If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first." That workflow is fully functional — but invisible in the UI. The user must read hook stderr or check file mtimes manually.

This change makes the same freshness signal available in the BeadSpec top bar as a passive, always-visible badge. The badge is not a workflow gate — it does not block the user — but it answers the question "is my index current?" without leaving the app.

The badge lives in the top bar (rightmost chrome strip) because freshness is a project-level health signal, not a task-level detail. It must be visible in every view. The popover surfaces the one concrete action the user can take: run `npx gitnexus analyze` — the same command the hooks recommend.

## Goals / Non-Goals

**Goals:**

- Surface GitNexus index age (green / amber / red) in the top bar with a 60 s polling interval.
- Provide a click-to-open popover with last-analyzed timestamp, symbol / relationship / process counts, and a Re-analyze button.
- Stream progress from an in-flight `npx gitnexus analyze` into the popover; update the badge on completion.
- Expose index state via two new Tauri commands so the React layer never shells out directly.
- Degrade gracefully when `npx gitnexus` is not on PATH or the project has no index.

**Non-Goals:**

- Running `mcp__gitnexus__*` MCP tools from the UI (those are remote-agent tools, not Tauri-ready).
- Wrapping `gitnexus impact`, `gitnexus context`, or `gitnexus query` (planned for `gitnexus-impact-panel`).
- Editing ACK marker files from the UI.
- Keeping an analysis history beyond the current snapshot.
- Supporting projects that are not the currently active project.

## Decisions

### 1. Source of truth: `npx gitnexus status --json`, fallback to `.gitnexus/` mtime

`get_gitnexus_status` shells out to `npx gitnexus status --json` (cwd = project_path). If that exits non-zero or the JSON envelope fails to parse, the backend falls back to reading the mtime of the `.gitnexus/` directory in the project root. Counts (`symbols`, `relationships`, `processes`) default to 0 on the fallback path.

**Rationale:** This matches what the hooks do and survives future `gitnexus` CLI upgrades transparently. The mtime fallback is unconditionally safe — it requires only that `npx gitnexus analyze` was run at least once (which it must be for any GitNexus signal to exist).

**Assumption for implementer:** The `npx gitnexus status --json` envelope should be verified against the installed version before writing the Rust parser. If the CLI does not yet emit stable JSON, the fallback path becomes the primary path; counts remain 0 and `last_analyzed_ts` is derived from `.gitnexus/` mtime.

### 2. Polling cadence: 60 s via TanStack Query `refetchInterval`

The React layer polls via `useQuery({ refetchInterval: 60_000 })`. The Tauri backend short-circuits by caching the last `npx gitnexus status` result for 55 s (atomic `Mutex<Option<(Instant, GitnexusStatus)>>`), so rapid component remounts do not re-shell.

**Rationale:** 60 s is cheap (one CLI invocation per minute) and matches the granularity of the amber/red thresholds. The hooks operate on 5 min + 4 h windows, so 60 s polling captures any human-initiated re-analysis quickly without hammering the shell.

### 3. Color thresholds: ≤30 min green, 30 min–4 h amber, >4 h red

These match the hooks' intent: a 5 min TDD nudge for zero-impact changes and a "stale" designation in CLAUDE.md for indexes older than ~4 h. The 30 min midpoint is a pragmatic dividing line — within one focused work session an index analyzed at session start stays green throughout.

### 4. Re-analyze concurrency: `Arc<Mutex<HashMap<String, JoinHandle<()>>>>`

A module-level `OnceCell<Mutex<HashMap<String, JoinHandle<()>>>>` maps `project_path → JoinHandle`. `run_gitnexus_analyze` returns `Err("already_running")` if the key is present. On task completion the handle is removed. `is_running` in `get_gitnexus_status` is derived from `registry.contains_key(&project_path)`.

**Rationale:** Prevents multiple concurrent `npx gitnexus analyze` processes on the same project path (which would corrupt the index). The per-project keying means multiple open projects do not interfere.

### 5. Event channel: `gitnexus_analyze_progress` + `gitnexus_analyze_complete`

The Rust task pipes stdout + stderr line-by-line via `app.emit("gitnexus_analyze_progress", chunk)` (payload: `String`). On exit it emits `gitnexus_analyze_complete { ok: bool, error: Option<String> }` and removes the registry entry. The React popover subscribes to both events via `listen()` only while it is open and `is_running` is true; unsubscribes on popover close or completion.

**Rationale:** Reuses the existing Tauri event pattern (`dolt_log()` poller already does this for DB events). Scoping the subscription to open+running avoids memory-leaking listeners.

### 6. Failure mode: `npx gitnexus` not on PATH

When the shell command fails with "command not found", `get_gitnexus_status` returns `GitnexusStatus { last_analyzed_ts: None, symbols: 0, relationships: 0, processes: 0, is_running: false }`. The badge renders "Index: unknown" in a neutral-grey palette. The popover shows a hint: "GitNexus is not installed. Run `npm install -g gitnexus` or `bun add -g gitnexus`."

### 7. New capability slug `gitnexus-index-status` vs. extending `layout-shell` only

`layout-shell` is touched for the slot placement, but the body of requirements (color thresholds, polling, popover content, re-analyze, events) belongs to a dedicated capability. Future changes (`gitnexus-impact-panel`, `process-flow-browser`) will add `gitnexus-index-status` to their modified-capabilities list rather than growing `layout-shell` with GitNexus-specific requirements.

### 8. No persistence of analysis history

Only the current-state snapshot is kept. History belongs to `openspec-validation-history`-style thinking — a separate change when the use case is validated.

## Risks / Trade-offs

- **CLI latency (100–300 ms):** Mitigated by TanStack Query's in-memory cache — subsequent renders within the 60 s window see cached data; only the background refetch waits on the shell.
- **Long-running analyze (first index, >2 min):** The streaming event channel keeps the popover live rather than blocking. The badge shows `is_running: true` and a running elapsed counter.
- **Re-analyze button spam:** The concurrency mutex prevents duplicate processes. The button is disabled while `is_running` is true.
- **`npx` version drift:** If `npx gitnexus status --json` envelope changes in a future release, the JSON parser in Rust may silently fall back to the mtime path. The implementer should add a version-sniff or treat the JSON parse defensively (partial decode, unknown fields ignored).
- **Project path resolution:** The badge needs the currently active project's path. The implementer must confirm the source (likely the same `project` context already consumed by `useTasks` and other TanStack queries) during task 5.1.

## UI Design Direction

**Register:** `product` — this is app UI, not marketing. Implementers should use `impeccable craft` (product register) when drafting the component and `impeccable audit` to review the diff against top-bar siblings.

**Aesthetic:** Minimalist-utility chip matching `BdHumanQueueChip`. Target ~22 px tall, neutral-800 border, a single 6 px colored dot followed by the label text in the app body font. The popover uses the same neutral-900 surface as the Health / RufloMemory panels: no drop shadows larger than 4 px, no gradient fills, no animated rings.

**Palette mapping:**
- Green dot: Tailwind `green-400` (or the theme token nearest to it in the existing LABEL_CHIP_COLORS system)
- Amber dot: `amber-400`
- Red dot: `red-400`
- Unknown/grey dot: `neutral-500`

**Anti-references:** no animated pulse rings, no gradient pills, no novelty icons, no AI-stock color washes.

**Skills at implementation time:** `impeccable craft` to draft `GitnexusBadge.tsx` + popover; `impeccable audit` to review against `BdHumanQueueChip` and the Refresh/Help/Settings buttons; `minimalist-ui` reference when condensing the popover's counts row.

**ASCII mockup:**

```
┌─ Top bar (right side) ──────────────────────────────────┐
│  [Views]  [BdQueue 3]  [● Index: 14m]  [↻]  [?]  [⚙]   │
└─────────────────────────────────────────────────────────┘

Click ● Index chip ↓

┌─ Popover ────────────────────────────────────────────────┐
│  GitNexus index                                           │
│  Last analyzed: 2026-05-17 09:42 (14m ago)               │
│  5,545 symbols · 8,288 relationships · 277 processes      │
│  ──────────────────────────────────────────────────────  │
│  [ Re-analyze ]    running… 23 s                          │
└──────────────────────────────────────────────────────────┘
```
