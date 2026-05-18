## Why

The hook layer already enforces GitNexus index freshness: `gitnexus-impact-reminder.sh` and `gitnexus-detect-reminder.sh` write `.claude/cache/gitnexus-*-ack` markers and nudge Claude to re-run `npx gitnexus analyze` when the index is stale. But the user has no visibility into this state — the index age lives entirely in shell stderr. Every session begins with a silent unknown: is the index 10 minutes old or 10 hours old? The hooks know; the app does not.

Making the index freshness visible closes this gap. A small top-bar badge surfaces the signal the hooks already produce — green / amber / red by age — so the user knows before opening any issue or running any GitNexus tool whether the data they are about to act on is current.

## What Changes

- A new `<GitnexusBadge />` chip in the top bar, positioned between the human-queue chip and the Refresh button.
- Badge text: "Index: \<human-age\>" — green (≤30 min), amber (30 min–4 h), red (>4 h). Greyed-out "Index: unknown" when status cannot be determined.
- Click opens a popover showing: last-analyzed ISO timestamp, symbol / relationship / process counts, and a "Re-analyze" button.
- "Re-analyze" spawns `npx gitnexus analyze` as an async Tauri task; emits `gitnexus_analyze_progress` (chunk) and `gitnexus_analyze_complete { ok, error }` events; badge refreshes on completion.
- Badge polls every 60 s via TanStack Query `refetchInterval`.
- New Tauri command `get_gitnexus_status(project_path) -> GitnexusStatus { last_analyzed_ts, symbols, relationships, processes, is_running }`.
- New Tauri command `run_gitnexus_analyze(project_path)` — starts the analyze task if not already running; rejects with `Err("already_running")` otherwise.

Non-goals (explicit):

- No GitNexus tool wrappers — `impact`, `context`, `query` surfaces belong to the planned `gitnexus-impact-panel` change.
- No editing of `.claude/cache/gitnexus-*-ack` markers from the UI.
- No historical timeline of analyses — a single current-state snapshot only.
- No GitNexus query or process-flow browser (those are Tier 3 items).
- No offline/remote repository support — the badge always refers to the active local project path.

## Capabilities

### New Capabilities
- `gitnexus-index-status`: the first GitNexus-facing surface in BeadSpec. Defined as its own capability so future GitNexus changes (e.g., `gitnexus-impact-panel`, `process-flow-browser`) can extend it independently rather than colonising `layout-shell`.

### Modified Capabilities
- `layout-shell`: adds one requirement — the top bar SHALL host a GitNexus index-status badge slot between the human-queue chip and the Refresh button.

## Impact

- **Tauri command** (new): `get_gitnexus_status` and `run_gitnexus_analyze` in new file `src-tauri/src/commands/gitnexus_status.rs`. Shell out to `npx gitnexus status --json`; fall back to `.gitnexus/` directory mtime on parse failure.
- **Type bindings**: new `GitnexusStatus` type auto-generated via `specta` into `src/bindings.ts` after bindings regen.
- **Frontend IPC**: new wrappers `getGitnexusStatus` / `runGitnexusAnalyze` in `src/ipc.ts`.
- **React component**: new `src/components/layout/GitnexusBadge.tsx` with inline popover.
- **Layout integration**: `src/components/layout/index.tsx` gains one import and one JSX insertion in `TopBar`.
- **No Dolt schema changes** — the feature reads only from the filesystem / `npx gitnexus` process; no new tables.
- **Event channel** (new): `gitnexus_analyze_progress` and `gitnexus_analyze_complete` Tauri events.
