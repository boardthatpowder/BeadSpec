## Context

The Ruflo Stop hook (`~/.claude/hooks/stop/`) calls `ruflo session save -n auto-<YYYYMMDD-HHMMSS>` at the end of every Claude Code session. Ruflo writes a snapshot manifest (JSON) under `~/.claude/ruflo/sessions/`. The `ruflo session list --json` CLI command enumerates those manifests. Today, the only way to interact with them is via the terminal.

`BdHealthPanel` (`src/components/health/BdHealthPanel.tsx`) currently renders all five `bd` checks directly in the panel body with no tab system. Introducing a tab strip is the minimal-invasive path to adding the Sessions surface without disrupting the existing Checks layout or the navigation shell.

## Goals / Non-Goals

**Goals:**

- Tab strip at the top of `BdHealthPanel` with two tabs: "Checks" (default active) and "Sessions".
- Sessions tab: chronological list (newest first) of session snapshots with timestamp, auto/manual chip, and optional derived metadata.
- Drawer: slides in from the right on row click; shows name, created-at, full metadata JSON, and two action buttons.
- "View memory entries from this session": navigates to Memory view with `?ts_from=<ms>&ts_to=<ms>` params.
- "Restore conversation context": copies snapshot ID to clipboard with a toast showing the exact CLI.
- Manual Refresh button in the Sessions tab header; no auto-polling.
- Graceful empty states for: ruflo not found, no snapshots, no project connected.

**Non-Goals:**

- No snapshot create / delete from the UI.
- No `ruflo session restore` invocation from the app.
- No snapshot-to-snapshot diff view.
- No background timer polling the Sessions tab.
- No modifications to `ruflo-memory-panel` spec (memory filter is a soft contract; a follow-up Beads issue handles the Memory view side if needed).

## Decisions

### 1. Tab state: local `useState` inside `BdHealthPanel`

Introduce `const [activeTab, setActiveTab] = useState<'checks' | 'sessions'>('checks')` near the top of the panel function. No router change; no Zustand state lifted. Rationale: tabs are a panel-internal concern identical to how `TaskDetailPanel` manages its own tab state. Alternative considered: hoist to `ViewSwitcher` as a nested route — rejected because it leaks a panel concern outward and changes the URL contract for a sub-tab of a single view.

### 2. Backend: shell out to `ruflo session list --json`

Create `src-tauri/src/commands/ruflo_sessions.rs`. Use `std::process::Command` (same pattern as `bd_preflight` in `commands/external.rs`) to spawn `ruflo session list --json` with `current_dir(project_path)`. Parse stdout as `Vec<SessionSnapshot>`. On I/O error or "command not found", return the sentinel string `"ruflo CLI not found"`. On JSON parse failure, return `Err` with the error message and leading stdout characters for diagnostics.

Alternative considered: query Ruflo's internal SQLite store directly — rejected (hard dependency on Ruflo's internal schema; the CLI is the published contract).

### 3. Auto vs manual derivation: `name.starts_with("auto-")`

The Stop hook always names snapshots `auto-<YYYYMMDD-HHMMSS>`. Any other name is manual. `is_auto: bool` is computed at parse time in Rust (`name.starts_with("auto-")`); it is not a raw field in the CLI output. This keeps the frontend free of string-matching logic.

### 4. Memory filter window: `[created_at, next_created_at)` or `[created_at, now)`

When the user clicks "View memory entries from this session", compute the window: `from = selected.created_at`, `to = next_newer_snapshot.created_at ?? Date.now()`. Pass as `?ts_from=<ms>&ts_to=<ms>` to the Memory view route. If the Memory view does not yet honour those params, degrade to copying `|ts:<from>-<to>|` to clipboard with an explanatory toast, and file a follow-up Beads issue at implementation time. The `session-snapshot-timeline` spec documents the fallback — no change to `ruflo-memory-panel` spec in this package.

Gap risk: a missed Stop hook can leave a session boundary with an unusually large window (days). Mitigation: clamp the lower bound to `now - 30 days`; show "window may include earlier sessions" in the drawer when the gap exceeds 7 days.

### 5. Restore action = clipboard copy only

`ruflo session restore <id>` mutates the running Claude Code environment. Invoking it from a desktop app would be unpredictable. BeadSpec exposes only the snapshot ID via `navigator.clipboard.writeText(id)` plus a toast with the exact command string. Alternative considered: spawn `ruflo session restore` as a Tauri sidecar — rejected (out of scope; mutates a live session).

### 6. Empty / error state branches

Three states inside `SessionsTab.tsx`:

1. `rufloNotFound === true` → "Ruflo CLI not configured" empty state with install hint. Mirror the existing `bdNotFound` empty state in `BdHealthPanel`.
2. `snapshots.length === 0` (and ruflo is found) → "No session snapshots yet. Snapshots are created automatically when a Claude Code session ends."
3. No project connected → reuse the parent panel's "Connect a project" guard; do not re-render the check inside the tab.

### 7. Refresh contract: manual button, no polling

Matches the Checks tab contract. Snapshots arrive at session-end pace (once per multi-hour Claude Code session); auto-refresh adds CLI churn with no real benefit. The Refresh button in `SessionsTab` re-invokes `listSessionSnapshots` and is disabled while the fetch is in flight.

### 8. `BdHealthPanel` Re-run button: Checks tab only

The "Re-run" button controls the five `bd` checks. It shall render only when `activeTab === 'checks'`. The Sessions tab provides its own Refresh button inside `SessionsTab.tsx`.

### 9. Capability split: tab requirement in `bd-health-panel`, all session semantics in new capability

The `bd-health-panel` delta spec adds only the tab strip requirement. All session-list, drawer, and action semantics live in the new `session-snapshot-timeline` capability. Rationale: keeps the existing health-checks contract clean; the Sessions feature is independently testable and could in principle be relocated to another view.

## UI Design Direction

**Register:** `product` — use `impeccable craft` (product register) at implementation time, not the brand register.

**Aesthetic:** minimalist-utility. Reuse the `LABEL_CHIP_COLORS` neutral palette from `TaskListItem.tsx`. Tabs are small text buttons with a `border-b-2` active indicator — not pill buttons, not segmented controls. Row layout matches `CheckSection` density: single line, `text-sm` label, `text-[10px] font-mono` for the ID/timestamp suffix. Drawer slides from the right at `w-96 max-w-full`, semantically the same as the task detail drawer.

**Anti-references:** no card shadows on rows, no novelty timeline ribbon, no per-row colored backgrounds, no gradients, no animated splashes.

**Skills used at implementation time:** `impeccable craft` to draft `SessionsTab.tsx` and the drawer; `impeccable audit` on the diff before opening a PR; `minimalist-ui` to keep row density consistent with `CheckSection`.

**ASCII mockup:**

```
┌── bd Health ─────────────────────── [Refresh] ┐
│  Checks │ Sessions                             │
│ ──────────────────────────────────────────────│
│  2026-05-17 14:22  auto   3 issues  12 files →│
│  2026-05-17 09:11  auto   1 issue   4 files  →│
│  2026-05-16 17:48  manual  scope-review      →│
│  …                                            │
└───────────────────────────────────────────────┘
```

## Risks / Trade-offs

- **`ruflo session list --json` schema drift** — Pin the parser to a minimal subset (`id`, `name`, `created_at`, optional `metadata`). Unknown fields are ignored via `#[serde(default)]`. If Ruflo renames `created_at`, the parser fails and the tab renders an error state with the raw stderr. Visible failure; not silent.
- **Per-session memory window is heuristic** — Two adjacent auto-snapshots define a session boundary, but a hook failure can produce a giant window. Mitigation: 30-day clamp + "window may include earlier sessions" hint when the gap exceeds 7 days.
- **`ruflo` CLI absent in CI / fresh installs** — Same empty-state handling as `bd CLI not found`. No crash.
- **Privacy** — Snapshot metadata can contain file paths. Drawer renders metadata as a `<pre>` block. No automatic outbound calls; same security stance as `CheckSection`'s combined-output rendering.
