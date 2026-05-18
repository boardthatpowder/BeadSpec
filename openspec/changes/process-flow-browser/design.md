## Context

GitNexus has indexed BeadSpec to 5545 symbols, 8288 relationships, and 277 execution flows. These are currently accessible only via MCP tools in agent chat (`mcp__gitnexus__query`, `mcp__gitnexus__context`, `mcp__gitnexus__route_map`). The BeadSpec UI has zero GitNexus surface: no flow viewer, no impact panel, no index-freshness indicator. The CLAUDE.md requires agents to run `gitnexus_impact` before every edit, yet there is no persistent in-app record of those results.

The existing `getGitRefsForIssue` IPC call (already in `src/bindings.ts`) returns the branch diff for any Beads issue. This is exactly the data needed to intersect a process's symbol/file set with issues — making "which open issues touch this flow?" answerable without new data collection.

`npx gitnexus` exposes JSON-capable subcommands: `processes`, `process <name>`, `clusters`, and `analyze`. The MCP tools confirm the data shape; the CLI is the documented invocation path for the desktop app.

## Goals / Non-Goals

**Goals:**
- A top-level `Processes` nav entry in `ViewSwitcher`, visible when a project is connected.
- A two-pane `ProcessBrowser` view: left list (search + cluster filter, virtualized), right detail (stepped trace, symbol/file:line/snippet per row).
- "Find issues touching this process" popover — top 20 Beads issues by overlap size.
- "Open in editor" — opens `file:line` in the user's editor via `openPath`.
- Stale-index banner (age > 4h) with Re-analyze CTA (background shellout + toast progress).
- Deep-linkable via hash (`view=processes&processId=<name>`).
- Graceful fallback when `npx gitnexus` is not installed: install-hint card, no crash.

**Non-Goals:**
- No write path to GitNexus (no editing flows or clusters).
- No graph visualisation — stepped list only. Cytoscape or mermaid would increase bundle size and offer no navigational advantage at flow granularity.
- No real-time auto-refresh on code changes — refresh is on demand via Re-analyze.
- No symbol-level deep dive — stays at flow granularity; `gitnexus-impact-panel` handles per-symbol impact.
- No multi-repo support — single connected project only.
- No new Dolt schema changes — GitNexus data comes entirely from CLI shellout.

## Decisions

### 1. Backend transport: CLI shellout with in-process 60s cache

Wrap `npx gitnexus <subcommand> --json` via a Rust `gitnexus_cli(args, ttl_secs)` helper in a new file `src-tauri/src/commands/gitnexus_processes.rs`. The helper:

1. Computes a cache key from the `args` tuple.
2. Returns the cached `serde_json::Value` if it is younger than `ttl_secs`.
3. Spawns `Command::new("npx").args(["gitnexus", ...])`, captures stdout, parses as JSON.
4. On spawn failure or non-zero exit, returns a typed `Err(String)` — never panics.
5. Caches the parsed value on success.

Cache is per-process (a `Mutex<HashMap<...>>` in a `once_cell::sync::Lazy` statics block). TTL is 60s for `processes`/`clusters`/`process`, 5m for `index status`.

**Why CLI, not direct MCP?** MCP is consumed by the agent layer; the desktop app needs a deterministic invocation path that works in a sandboxed Tauri process with no ongoing agent session. `npx gitnexus` is the documented invocation path in CLAUDE.md ("npx gitnexus analyze").

**Alternative considered:** Direct HTTP to the GitNexus local server (if running). Rejected — the server port is not stable, not guaranteed to be running, and the CLI is already the canonical path.

### 2. Cluster grouping: frontend deterministic hash

Call `list_gitnexus_clusters` once on view mount; group the process list by cluster in the React layer. Cluster name → colour is resolved by a deterministic hash (`djb2` mod palette size) so unknown clusters still render distinctly without a server round-trip. The palette reuses the `LABEL_CHIP_COLORS` neutral set from `TaskListItem.tsx`.

**Why frontend grouping?** The cluster list is small (expected < 20 entries); sorting in React avoids a second Tauri call per filter change.

### 3. Process-detail step format: `{ symbol, file, line, snippet }`

Each step in `ProcessDetail` is typed as `ProcessStep { symbol: String, file: String, line: u32, snippet: Option<String> }`. `snippet` is the first non-empty docstring line from the GitNexus JSON, truncated to 120 chars. If `snippet` is absent, the frontend falls back to the function signature line (parsed from the GitNexus step's `signature` field if present). The step list is virtualized with `@tanstack/react-virtual` (already a dep) to handle large flows without layout thrash.

### 4. Issues-touching-process: O(issues × files) with 20-item cap

For a clicked process, `find_issues_touching_process` enumerates all open issues carrying a `branch:` label, calls `getGitRefsForIssue` for each, intersects the modified-files set with the process's `file` set, and ranks by overlap-count desc. Cap at 20; cache per process-id for the session (cleared on Re-analyze). The operation is Rust-side to keep the intersection tight; no JS array gymnastics.

**Boundary:** If a project has hundreds of open issues, the N calls to `getGitRefsForIssue` may be slow. The command runs in a Tokio task and reports progress via a Tauri event; the popover shows a spinner until complete.

### 5. Open in editor: reuse `openPath` with `file:line:0`

The existing `openPath` Tauri shell helper is already scoped to the `open` plugin and used by the git-history-panel. This decision adds no new permission scope. The handler constructs `${absolute_file}:${line}:0` and passes it to `openPath`. Detect the preferred editor via `$EDITOR` env var; default to `code -g` (VS Code). The button is disabled (greyed out) when no step is focused.

**Fallback:** If `openPath` returns an error (editor not found, permission denied), show a toast with the error message. Never crash the view.

### 6. Stale-index handling: conditional reuse of `gitnexus-index-freshness-badge`

If the `gitnexus-index-freshness-badge` change has landed, the Processes view subscribes to its shared Zustand store (`useGitnexusIndexStore`) instead of making a redundant `list_gitnexus_repos` call. If the store is absent at runtime (change not yet landed), `StaleIndexBanner` falls back to calling `get_gitnexus_index_status` once on mount and on Re-analyze completion.

`trigger_gitnexus_reanalyze` spawns `npx gitnexus analyze` in a Tokio background task and emits Tauri events:
- `gitnexus_reanalyze_progress { stage: "started" | "running" | "finished" | "error", message: String }`

The UI subscribes via `listen()` and shows a toast progress bar. On `finished`, the Processes list re-fetches (invalidate the TanStack Query key for `listGitnexusProcesses`).

### 7. Routing and hash state

Add `'processes'` to the `View` union in `HashStateContext`. `processId` is encoded in the hash alongside `view`:
- `#view=processes` → ProcessBrowser with no selection
- `#view=processes&processId=auth-login-flow` → ProcessBrowser with that process pre-selected

Switching active process calls `window.history.replaceState` (not `pushState`) to avoid polluting the back-stack. The view is gated on `project != null` only — no OpenSpec feature flag.

**Reuse:** The `taskId` hash slot is already used by TaskDetailPanel. `processId` is a new slot; the encoder/decoder in `HashStateContext` gets a simple `processId?: string` field.

### 8. No new spec capability for the IPC layer

All Tauri commands live under the new `process-flow-browser` capability. The `layout-shell` delta spec gains exactly one requirement (the Processes nav entry). Defining a separate IPC capability would over-fragment the spec.

## Risks / Trade-offs

- **CLI shellout cost on first paint** → mitigated by parallel `list_processes` + `list_clusters` calls on mount and 60s in-process cache. Expected < 1s on warm runs.
- **Index drift between branches** → the freshness banner is the only signal; deliberate non-goal to auto-refresh on file changes.
- **Large flows (hundreds of steps)** → virtualized with `@tanstack/react-virtual`; no layout thrash even at 500+ steps.
- **`npx gitnexus` not installed** → the helper returns `Err("gitnexus not found: ...")`; the view renders an install-hint card with `npm install -g gitnexus` instructions. No crash, no effect on other views.
- **Label-parsing rule** → when bucketing issues by `branch:foo:bar`, use the "split on first colon only" helper already present in the codebase, consistent with CLAUDE.md invariant.
- **N×M overlap computation** → capped at 20 results; if future profiling shows latency, add a batch SQL query against a hypothetical `gitnexus_symbols` table. Out of scope now.

## UI Design Direction

**Register:** product. Implementers use `impeccable craft` (product register) for new components and `impeccable audit` against the diff.

**Aesthetic:** minimalist-utility, consistent with `LABEL_CHIP_COLORS` in `src/components/task-list/TaskListItem.tsx`. Two-pane layout mirrors `ChangesBrowser`. Step rows are dense, monospace for `file:line`, neutral background. Cluster chips follow the same neutral-palette system as label chips — no custom colours per cluster beyond the deterministic hash.

**Anti-references:** no animated graph visualisations, no AI-stock gradients, no colourful flow diagrams, no card-shadow inflation, no novelty chrome on the cluster filter dropdown.

**Skills used at implementation time:** `impeccable craft` (drafting new components), `impeccable audit` (reviewing the diff against existing app surfaces), `minimalist-ui` (condensing the dense step list), `gitnexus-exploring` (verifying CLI output shape against the MCP resource).

**ASCII mockup:**
```
┌─ Processes ─────────────────────────── stale 4h • Re-analyze ─┐
│ [search…]  Cluster ▾ (all | auth | sync | ui)                  │
│ ──────────────────────────────────────────────────────────────  │
│ • auth-login-flow            • render-task-list                 │
│ • dolt-port-discovery        • openspec-validate                │
│ • get_git_refs_for_issue     • bd-import-epic                   │
│ … (virtualized)                                                 │
├─────────────────────────────────────────────────────────────────┤
│ auth-login-flow              [Find issues] [Open in editor]     │
│ Cluster: auth · 7 steps                                         │
│ 1. AuthProvider.signIn  src/auth/provider.ts:42  "Initiates…"  │
│ 2. dispatchToken        src/auth/provider.ts:88  "Persists…"   │
│ 3. …                                                            │
└─────────────────────────────────────────────────────────────────┘
```
