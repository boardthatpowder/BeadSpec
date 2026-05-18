## Context

The `openspec-beads-scope-change` skill — invoked when an implementer discovers a spec gap mid-task — does three things: (1) appends `Paused: <reason>` to the issue's notes via `bd update <id> --append-notes`; (2) applies `openspec:paused` via `bd tag`; (3) creates a new scope-change child issue via `bd create` and links it with `bd link <paused> <child>` (default `blocks` relationship). When the child is resolved the original issue is resumed by removing the tag and continuing.

All three data elements — `task.labels`, `task.notes`, and the `dependencies` table — are already available in the frontend. `task.labels` is an array on every `Task` object. `task.notes` is a nullable string column on `issues` returned by `list_tasks`. The `dependencies` table is queried per-task in `DependencyGraphTab` via the `get_task_dependencies` command.

Today, the `openspec:paused` label is simply another label chip rendered by `formatLabel`/`labelChipClass` — it looks identical to any other `openspec:*` chip. The KPI bar's `STATUS_CONFIG` array is status-keyed and has no slot for a label-based counter. The `OpenSpecPanelBody` has a `DriftWarning` section but no pause-specific callout.

The result: a paused issue is invisible as paused until the implementer opens the notes blob — a friction point that causes re-claiming of paused issues and lost context across sessions.

## Goals / Non-Goals

**Goals:**
- Make `openspec:paused` visually distinct in every surface an implementer scans first: the task list row, the KPI summary bar, and the OpenSpec detail panel.
- Parse and display the human-readable pause reason without any new IPC — purely from `task.notes`, which is already fetched.
- Provide a one-click path to the scope-change child issue from the pause banner.
- Integrate with the existing label-filter dimension so `smart-views` URL-hash filters and palette filters can target paused tasks.

**Non-Goals:**
- No write path — pausing and resuming remain `openspec-beads-scope-change` skill commands.
- No automatic resumption, no "Resume" button in the UI.
- No historical pause timeline or audit log.
- No cross-window notification for newly paused issues.
- No Beads schema change — no new table, column, or index.
- No Rust command change — the change is entirely in `src/`.
- No update to the `openspec-beads-scope-change` skill to enforce a canonical `Resolves:` note (that is a separate follow-up, flagged as an open question).

## Decisions

### 1. Detection: `openspec:paused` label is the single source of truth

A task is considered "paused" if and only if `task.labels` contains exactly the string `openspec:paused`. No other heuristic (status, notes keyword scan, or dependency check) is used for the primary detection.

**Rationale:** The label is set and unset atomically by `bd tag` / `bd untag` in the skill, and is observable via the existing `useTasks` TanStack Query cache (which is already invalidated by the real-time Tauri event loop). Adding a second detection signal (e.g. note-prefix scan) would create split state: a task could have the note without the label, or the label without the note, depending on partial skill execution. The label is the authority; the note is supplemental display data.

**Implication:** All three UI surfaces condition their pause rendering on `task.labels.includes('openspec:paused')`.

### 2. Pause-reason parsing — `parsePausedNote`

A new pure helper `parsePausedNote(notes: string | null): string | null` is added to `src/lib/parsePausedNote.ts`. It scans the notes string line by line and returns the **last** line matching the pattern `/^Paused:\s*(.+)$/` (case-sensitive, anchored to the start of the line, trimming the captured group). Returns `null` if no such line is found.

**Why last-wins:** The skill uses `--append-notes`, so a task that was paused, resumed, and paused again will have multiple `Paused:` lines. The most recent (last) line is the active reason. The resumption step does not remove the old `Paused:` lines — it simply removes the `openspec:paused` label, so at render time only labelled tasks are parsed.

**Edge cases tested:** notes is `null`, notes has trailing whitespace after reason, notes has `paused:` (lowercase, no match — intentional), notes has `Paused:` with no text after the colon (null returned — treated as missing reason).

**Fallback copy when reason is null but label is present:** "*(no reason recorded)*".

### 3. Scope-change child detection — `findScopeChangeChild`

A new pure helper `findScopeChangeChild(currentTask: Task, allTasks: Task[], blockingIds: string[]): Task | null` is added to `src/lib/findScopeChangeChild.ts`. `blockingIds` is a pre-fetched list of issue IDs that have a `blocks` dependency pointing **at** `currentTask.id` (i.e. `depends_on_id = currentTask.id`).

Detection is a two-signal priority search:

1. **Signal A (note prefix):** Among all tasks in `allTasks`, find the first whose notes contain a line matching `/^Resolves:\s*<currentTask\.id>\b/`. If found, return it immediately.
2. **Signal B (dependency + shared label):** Among tasks in `allTasks` whose `id` appears in `blockingIds`, find the one sharing the most specific `openspec:<change>` label with `currentTask` and created most recently (using `task.created_at`). Return it, or `null` if none matches.

**Why not Signal A alone:** The `openspec-beads-scope-change` skill does not currently write a `Resolves:` note. Signal A is forward-compatible — once the skill is updated, it will automatically become the primary signal without UI change.

**Why not Signal B alone:** The `blocks` dependency from the child to the parent is reliable, but not unique to scope-change children (any blocker issue triggers it). Adding the shared `openspec:<change>` label constraint filters to only siblings of the same change, which is the most precise disambiguation currently available.

**`blockingIds` sourcing:** The `DependencyGraphTab` already calls `get_task_dependencies` per task on open. For the banner, we need only the `depends_on_id = currentTask.id` half. The existing `useTaskDependencies` hook (or its query result) can be reused; if it is not yet available on the `OpenSpecPanel`'s props chain, a new `useTaskBlockers` hook wrapping the same command is added. No new Rust command is required.

### 4. `TaskListItem` paused pill — `STATUS_BADGE_PAUSED`

A new constant `STATUS_BADGE_PAUSED` is added alongside `STATUS_BADGE` and `STATUS_DOT` in `TaskListItem.tsx`:

```ts
const STATUS_BADGE_PAUSED =
  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ' +
  'bg-violet-900/40 text-violet-300 border border-violet-800/40';
```

Badge text: `"⏸ paused"`. When `task.labels.includes('openspec:paused')` is true, the status badge slot renders `STATUS_BADGE_PAUSED` instead of `STATUS_BADGE[task.status]`. The status dot (the coloured circle at the row's leading edge) is **not** replaced — it remains driven by `task.status` so status is still scannable without opening the detail panel.

**Tooltip:** The pause pill wraps a `title` attribute set to the parsed pause reason (or empty string if none), surfacing the reason on hover without requiring a full panel open.

**Visual precedence:** Paused overrides the status badge regardless of the underlying status (open, in-progress, blocked, or even closed — rare but possible if the tag was forgotten at close).

### 5. `KpiBar` Paused chip

A new chip is rendered **after** the output of `STATUS_CONFIG.map(...)` in `KpiBar.tsx`. It is not added to `STATUS_CONFIG` because its filter dimension is label-based, not status-based.

**Count computation:** `allTasks.filter(t => t.labels.includes('openspec:paused')).length`. This mirrors the existing `whatIfCounts` pattern.

**Visibility gate:** The chip is rendered only when `pausedCount > 0 || state.filters.labels?.includes('openspec:paused')`. This prevents a 0-count chip cluttering projects that never pause, while keeping the chip visible when the filter is active (so the user can de-activate it).

**Click handler:** Toggles `openspec:paused` in `state.filters.labels` (the label filter dimension). The `applyFilters` function in `src/lib/filterParser.ts` already handles label-array AND-of-OR semantics; no change to the filter engine is required.

**Active state:** Uses the same `ring-1 ring-violet-500` ring treatment as other active chips.

**Separator:** A thin `<span className="mx-1.5 w-px h-4 bg-white/10" />` divider is rendered between the Closed chip and the Paused chip to signal the orthogonal dimension.

### 6. `OpenSpecPanel` banner placement — `<PausedBanner>`

A new `<PausedBanner>` sub-component is added to `src/components/task-detail/OpenSpecPanel.tsx` (or extracted to its own file if the component grows large). It is rendered as the **first child** of `OpenSpecPanelBody`, before `DriftWarning`, so it is the top-of-mind signal when a paused task's panel is opened.

**Render condition:** `task.labels.includes('openspec:paused')` — if false, nothing is rendered.

**Layout:** A thin info row matching the aesthetic of `DriftWarning` but in violet to differentiate. Contains: a `⏸` glyph, the parsed reason, and (if a child is found) a button rendering `Resolves: <child.id> — <child.title>` that calls `setState({ view: 'all', taskId: child.id })`.

## Risks / Trade-offs

- **Pause-reason parsing depends on exact note prefix.** Mitigation: the regex is anchored to line start and case-sensitive, matching exactly what `--append-notes="Paused: ..."` produces. Unit tests cover all known forms emitted by the skill.
- **Scope-change child detection has no enforced canonical signal.** Neither `Resolves:` notes nor the `blocks` link are guaranteed today. Mitigation: the UI degrades gracefully — banner renders without the child link, and a muted "No scope-change child detected yet" note is shown. Long-term: update `openspec-beads-scope-change` to write a `Resolves:` line (separate change, flagged as open question).
- **`blockingIds` requires an extra query in `OpenSpecPanel`.** The panel does not currently fetch dependency data. Mitigation: reuse or share the result of `get_task_dependencies` already called in `DependencyGraphTab`; if not co-located, add a narrow `useTaskBlockers` hook. Cost is one extra IPC call per task detail open — acceptable at this scale.
- **KPI Paused chip is hidden at zero count.** Trade-off: discoverability suffers on projects that have never paused a task. Acceptable because pause is a low-frequency event in the workflow, and the chip appears immediately after the first pause.
- **`task.notes` threading.** `Task.notes` must be available on the props chain reaching `OpenSpecPanel`. If it is currently stripped by the TanStack Query selector, a selector update is required — no Rust change, but a frontend data-flow change. The tasks.md section on data threading ensures this is an explicit implementation step.

## UI Design Direction

**Register:** `product`. Implementers use `impeccable craft` (product register) and NOT the brand register.

**Aesthetic:** minimalist-utility. Reuse `LABEL_CHIP_COLORS` and `STATUS_BADGE` palette patterns; introduce a single new neutral-violet variant (`bg-violet-900/40 text-violet-300 border border-violet-800/40`) that visually rhymes with the existing `branch:/repo:/worktree:` violet chips already in the UI. Pause glyph: Unicode `⏸` — no SVG dependency.

**Anti-references:** no marketing-grade animation, no gradient backgrounds, no card-shadow inflation, no novelty iconography. The banner is a thin info row matching `DriftWarning`'s aesthetic but in violet to differentiate pause from drift.

**Implementation-time skills:** `impeccable craft` to draft the three new UI surfaces; `impeccable audit` to diff the new components against existing surfaces for palette and density consistency; `minimalist-ui` reference when condensing banner copy.

**ASCII mockup:**

```
KpiBar:
  [ 142 Total ]  | • 87 Open  • 12 InProgress  • 3 Blocked  • 40 Closed  | ⏸ 2 Paused

TaskListItem (paused):
  ● task title here ............................................ [⏸ paused]  P2
    bs-123  openspec:my-change  branch:my-branch  +1

OpenSpecPanel banner (above drift warning):
  ┌──────────────────────────────────────────────────────────────┐
  │ ⏸ Paused: discovered spec gap — KPI chip needs label filter  │
  │   Resolves: bs-456 — Add paused-state-surfacing UI           │
  └──────────────────────────────────────────────────────────────┘
```
