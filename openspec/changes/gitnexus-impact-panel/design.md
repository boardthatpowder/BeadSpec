## Context

BeadSpec's `gitnexus-impact-reminder.sh` hook fires before every edit and prints a GitNexus impact reminder to stderr — but the output is ephemeral and disappears when the agent session ends. The Tier-1 ★ recommendation in the gap review was to surface this signal inside `TaskDetailPanel`. Two pieces of existing infrastructure make this cheap:

1. `getGitRefsForIssue` already returns a `GitRefs` object including a `diff` string used by the Activity tab's branch badge. The diff names changed symbols — we can parse candidates from it without any new IPC.
2. The existing `external::*` command pattern in `src-tauri/src/commands/external.rs` already shells out to user-installed CLIs (`bd`, etc.) using a shell-resolved PATH and stderr capture. The new `gitnexus.rs` module reuses that pattern verbatim.

GitNexus exposes two relevant CLI subcommands: `npx gitnexus impact --target <sym> --json` (upstream + downstream callers + risk) and `npx gitnexus context --name <sym> --json` (full per-symbol context including process membership). For the MVP we shell out to `impact` only. Whether process grouping is embedded in the `impact` payload or requires a chained `context` call is the single largest open question (see Risks); the IPC contract is designed so the answer does not change the frontend interface.

## Goals / Non-Goals

**Goals:**
- Surface GitNexus impact analysis per-issue, click-driven, without leaving `TaskDetailPanel`.
- Reuse the `Details / Dependencies / Activity` tab pattern verbatim — the new `Impact` tab is a fourth tab with the same controlled inner-sub-tab state.
- Auto-suggest symbols from the issue's diff so the common case is one click, not typing.
- Treat results as ephemeral: re-run on demand, no cache.
- Auto-generated bindings via `specta` — no hand-written IPC types.
- Explicit empty/error states for every failure mode the hook already detects.

**Non-Goals:**
- No write API or "Re-analyze index" button.
- No background polling or Tauri-event-driven invalidation.
- No multi-symbol batch analysis.
- No graph visualisation — flat grouped lists only.
- No MCP-direct calls from the renderer.
- No persistence (Dolt or Ruflo memory). A follow-up change may pipe `type:impact-history` memory entries.

## Decisions

### 1. Backend: shell-out to `npx gitnexus impact --json`, not the MCP

Add `run_gitnexus_impact(project_path, symbol, registry) -> Result<GitnexusImpactReport, String>` in `src-tauri/src/commands/gitnexus.rs`. Spawn `npx gitnexus impact --target <symbol> --json` with `project_path` as CWD and the shell-resolved PATH from `commands::external`. Parse stdout JSON; on non-zero exit or empty stdout, classify the error into `MissingCli | NoIndex | SymbolNotFound | Timeout | Other` and surface as a typed error string. Timeout constant: 15s.

**Alternative considered:** Wrap `mcp__gitnexus__impact` directly from the renderer. Rejected: (a) MCP tool surfaces aren't `specta`-typed, (b) IPC contracts must be auto-generated per the repo's IPC invariant, (c) the renderer must never call MCPs directly.

**Alternative considered:** Use the GitNexus Rust analysis crate as a dependency. Rejected — GitNexus is a separate Node/TypeScript project; `npx` is the supported integration boundary.

### 2. Symbol resolution: diff-derived candidates with manual fallback

`useGitRefsForIssue` already returns `GitRefs.diff`. Parse it on the client with a small regex pass extracting identifiers from added/removed declaration lines:
- TypeScript / JS: `function <name>(`, `class <Name>`, `<name> = (\(|async)`, `(public|private|protected)? <name>\(`
- Rust: `fn <name>(`, `impl <Name>`, `struct <Name>`
- Python: `def <name>(`, `class <Name>(`

Deduplicate, sort by occurrence frequency, cap at 10 candidates. Render as clickable chips. If the issue has no branch / diff, the candidate list is empty and only the manual input is shown.

**Why not ask GitNexus to suggest symbols?** That would require a round-trip before the user has committed to a target — adds latency and a circular dependency. Diff parsing is cheap and covers the common case.

### 3. UI: new `Impact` tab positioned last in the tab row

Extend the existing `TabId` union in `TaskDetailPanel.tsx`:

```ts
type TabId = "details" | "dependencies" | "activity" | "impact";
```

Append `{ id: "impact", label: "Impact" }` last in the `tabs` array. Render `<ImpactPanel task={task} project={project} paneId={paneId} />` when `activeTab === "impact"`. Per-tab sub-state already persisted by `useWorkspaceStore.innerSubTab` keyed by `${paneId}:${taskId}` — no schema change needed.

**Why last?** Lowest discoverability cost for an opt-in, click-driven feature. Existing three tabs are workflow-critical and stay in their positions.

### 4. `ImpactPanel.tsx` internal layout (canonical ASCII mockup)

```
+--------------------------------------------------+
| [Details] [Dependencies] [Activity] [Impact ●]   |
+--------------------------------------------------+
| Symbol: [ runImpact() ▾ ]  [ refresh ]           |
| Risk: ●●○○ MEDIUM    Affected processes: 3       |
| Upstream callers (grouped by process)            |
|   ▾ openspec-import   (4)                        |
|       importChange         openspec.rs:34        |
|       resolveChangeEpic    openspec.rs:198       |
|   ▾ task-detail-render (2)                       |
|       TaskDetailPanel      TaskDetailPanel.tsx:35|
| Downstream callees                                |
|   typedError               bindings.ts:118       |
+--------------------------------------------------+
```

Each row is a non-clickable text entry for the MVP. Clicking a process name to open the GitNexus process browser is a follow-up (`process-flow-browser` in the gap review).

### 5. Risk badge palette

Map `GitnexusRisk` to the project's existing `LABEL_CHIP_COLORS` palette in `src/components/task-list/TaskListItem.tsx`:
- `Low` → neutral / slate
- `Medium` → amber
- `High` → orange
- `Critical` → red (matches existing `priority:critical` chip)
- `Unknown` → muted grey, `—` placeholder

### 6. Error and empty states

Six explicit inline states rendered within `ImpactPanel`:
- **No symbol selected** (initial, no diff candidates) — "Pick a symbol from the issue diff, or type one below" + manual input.
- **`npx gitnexus` not on PATH** — "GitNexus CLI not found. Run `npm i -g gitnexus` or `npx gitnexus analyze`." Detected by command-not-found exit code.
- **No index** — "GitNexus has no index for this project. Run `npx gitnexus analyze` first." Detected by exit code or known error string.
- **Stale index** — yellow callout "Index may be stale (ack marker older than HEAD). Re-run `npx gitnexus analyze`." The impact call still runs and the result is shown below.
- **Symbol not found** — "GitNexus didn't find `<symbol>` in the index. Try a fully-qualified name or re-run analyze."
- **Timeout** — "GitNexus impact timed out after 15s. Try a smaller symbol or re-run."

### 7. Index-freshness detection

Add `detect_index_status(project_path)` helper in `gitnexus.rs` that compares the mtime of `.claude/cache/gitnexus-*-ack` files to the current `HEAD` commit time (via the `git2` crate already in the dependency tree or a `git log -1 --format=%ct HEAD` shellout). Returns `GitnexusIndexStatus: Fresh | Stale | Unknown`. Stale means the ack is older than HEAD; the result is still returned with `index_status: Stale` and the panel shows the non-blocking callout.

### 8. No caching, no persistence

Results live in component state only. Re-mounting the tab re-renders the empty state; the user must re-click. This matches the gap-review constraint ("results are cheap and the index changes"). If profiling later shows a problem, a tiny in-memory map keyed by `(taskId, symbol)` invalidated by ack mtime can be added without changing the IPC contract.

## UI design direction

- **Register**: `product` (in-app UI, not marketing). Implementers SHALL use `impeccable craft` (product register), not the brand register.
- **Aesthetic**: minimalist-utility — small chips, neutral palette consistent with the existing `LABEL_CHIP_COLORS` system in `src/components/task-list/TaskListItem.tsx`, low chrome, dense but legible. Reuse existing tab button styling from `TaskDetailPanel`. Reuse chip styling for risk badge — no third visual vocabulary.
- **Anti-references**: no novelty chrome, no animated splashes, no AI-stock gradients, no card-shadow inflation, no large hero icons.
- **Skills at implementation time**:
  - `impeccable craft` to draft `ImpactPanel.tsx` and tab wiring.
  - `impeccable audit` to review the final diff against the rest of `task-detail`.
  - `minimalist-ui` reference when condensing the grouped caller list.
  - `gitnexus-exploring` skill before authoring the diff-symbol regex, to confirm what `gitnexus impact --json` actually returns.

## Risks / Trade-offs

- **`npx gitnexus impact --json` output shape uncertainty** — the CLI's exact JSON schema isn't pinned in BeadSpec sources. **Mitigation:** Task 2.1 snapshots the fixture before authoring the parser; add an integration test asserting known fields (`risk`, `upstream`, `downstream`, process grouping). If grouping requires a second `context` call, `run_gitnexus_impact` chains both server-side; the IPC contract stays unchanged.
- **Stale-index false positives** — ack mtime vs. HEAD time will mark "re-analyzed, no commits since" as stale if the user re-analyzed but didn't commit. **Mitigation:** callout is informational, not blocking.
- **Diff-symbol regex over/under-fires** — heuristic extraction misses anonymous fns and may false-positive on local variables. **Mitigation:** manual input is always available; candidates are labelled as suggestions.
- **Timeout pessimism on cold cache** — first impact call after `npx gitnexus analyze` can be slow. **Mitigation:** 15s is generous for BeadSpec scale; expose via Settings in a follow-up if needed.
- **Shell environment** — `npx` needs to find `gitnexus`. The existing `external::*` shell-resolved PATH handles this. Reuse verbatim; do not roll a new spawn path.
- **No `Activity` regression** — the new tab does not change behaviour of the three existing tabs. The `task-detail` spec delta only adds to the tab set; all existing scenarios remain valid.
