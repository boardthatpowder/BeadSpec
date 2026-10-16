## Context

`~/.claude/ruflo/hooks/on-finding.sh` is the canonical source of worker-filed Beads issues. Its note prefix is fixed today as `Auto-filed by ruflo-<worker-tag> worker on <ts>. Branch: <b>`. The `openspec-beads-followup` and `openspec-beads-sync` skills already detect these by string match (`.notes | test("Auto-filed by ruflo-")`) because the hook does not currently apply `ruflo:*` labels. The UI must match the same notes source — labels are not reliable yet, but the note prefix is.

The existing `BdHealthPanel` is a single-purpose surface (the five `bd` checks). The brief asks for the worker-findings list to live *inside* this panel as a new tab. That keeps "project health" as one entry in the navigation while letting the panel host multiple health-adjacent views.

The provenance chip on `TaskListItem` is a separate, smaller change: render parsed worker provenance from the task payload using the existing teal `worker:` palette. The chip is informational only.

## Goals / Non-Goals

**Goals:**
- One round-trip Tauri command `list_worker_findings(project_path)` returns all unresolved worker-filed issues with the worker tag already parsed in Rust.
- `TaskListItem` shows a provenance chip from parsed `Task.worker_provenance` — without an extra IPC call per row and without exposing full notes to the frontend task list.
- `BdHealthPanel` gains a `Worker findings` tab that lists findings grouped by worker tag, with priority-derived severity counts. Groups sort alphabetically; rows sort by priority ascending, then `created_at` descending.
- Chip and group palette match the existing `LABEL_CHIP_COLORS.worker` teal — no new palette tokens.
- Empty state for the new tab when no findings exist; no findings tab badge.

**Non-Goals:**
- No memory IPC, no write API, no notification surfacing.
- No transitive linking between findings (e.g. "all findings from the same scan run").
- No filtering UI beyond worker-grouped sections in v1.
- No re-emission of finding events; existing `dolt_log()` polling already drives task-cache refresh.
- Closed and deleted findings are excluded from the dashboard, but other unresolved statuses such as `blocked` or custom statuses remain visible.
- No coloured priority dots beyond the existing `PRIORITY_STYLE` map.

## Decisions

### 1. Source of truth: notes prefix, not labels

The hook applies the notes prefix unconditionally and does not (today) apply a `ruflo:<worker>` label. Existing skills (`openspec-beads-followup`, `openspec-beads-sync`) match the notes prefix as their canonical heuristic. The UI follows the same heuristic so that the list of findings on the panel matches the list the followup skill would surface.

**Current parser shape:** `^Auto-filed by ruflo-(?P<worker>[a-z0-9-]+) worker on `. The `[a-z0-9-]` class is intentional — current worker tags include values like `security` and `test-gap`. The parser also accepts the legacy/proposed form without the literal ` worker` marker (`^Auto-filed by ruflo-(?P<worker>[a-z0-9-]+) on `) so manually seeded or previously filed issues still render.

**Alternative considered:** match on `ruflo:*` labels. Rejected — the hook does not apply labels today, so a label-based match would surface zero findings until the hook is fixed upstream. The brief explicitly references the notes pattern.

### 2. Backend: single SQL query joining `issues` → notes scan

Add `list_worker_findings(project_path)` in `src-tauri/src/commands/workers.rs` (new module). Internally:

```sql
SELECT id, title, priority, status, issue_type, notes, created_at
FROM issues
WHERE notes LIKE 'Auto-filed by ruflo-%'
  AND status NOT IN ('closed', 'deleted')
  AND issue_type != 'deleted'
ORDER BY created_at DESC
```

In Rust, parse the worker token from the first line of `notes` using the regex above; reject rows where the regex fails to match (defensive — but the `LIKE` filter already guarantees the prefix).

Return `Vec<WorkerFinding>`. The frontend groups by `worker`.

**Alternative considered:** shell out to `bd list --json --notes-contains "Auto-filed by ruflo-"`. Rejected — `bd list` does not support notes filtering directly, and we already have the SQL pool.

### 3. Severity = derived from `priority`, not stored separately

Worker findings inherit Beads priority (P1..P4). Mapping for the per-worker severity breakdown:

| Priority | Severity label |
|---------:|----------------|
| 1 | critical |
| 2 | high |
| 3 | medium |
| 4 | low |
| null / 0 / >4 | unknown |

The `WorkerFinding` struct exposes raw `priority: i32`; the *mapping* is computed in the frontend so adjusting the labels later doesn't require a binding regen.

### 4. `TaskListItem` chip detection: backend parses row provenance

`Task` rows now carry `worker_provenance: { worker, notes_first_line } | null`, populated by the Rust parser while `list_tasks` reads the current page. The SQL projection returns only `SUBSTRING_INDEX(notes, CHAR(10), 1)` for rows matching the Ruflo prefix, not the full notes body. The frontend task list receives only parsed provenance and does not call `list_worker_findings` just to render chips. This keeps the Health tab query lazy and avoids a project-wide notes scan or full-notes payload on every task-list render.

### 5. UI: tab strip inside `BdHealthPanel`, default to `Checks`

Add a horizontal tab strip directly below the existing header. Tabs: `Checks` (default), `Worker findings`. Use the same neutral chrome as the rest of the panel — small underline tabs, no boxed pills.

When the user lands on `Health`, the `Checks` tab is active and auto-runs as today. The `Worker findings` tab is lazy — its query fires only on first activation, then caches in TanStack Query keyed by `[project_path, 'worker-findings']` and invalidates on the existing `dolt_log()` task-cache cycle.

### 6. Chip placement on `TaskListItem`

The chip is inserted *before* the existing label chips and *after* the issue ID. It uses the same `text-[10px] px-1.5 py-0 rounded font-mono leading-4 max-w-24 truncate` styling as a label chip. Its title attribute is the full first-line of the notes (the `Auto-filed by ruflo-<worker> worker on <ts>. Branch: <b>` prefix, or the accepted legacy delimiter).

Layout sketch (current vs new):

```
Before: [id] [label1] [label2] +N
After:  [id] [worker:security] [label1] [label2] +N
```

The chip never consumes a `visibleLabels` slot — it is a sibling of the chip row, not an element of `task.labels`.

### 7. No notification or badge

The brief explicitly omits a notification surface. The findings tab does not display a numeric badge on the panel header or in the navigation; counts are visible only inside the tab.

### 8. UI design direction

**Register:** `product`. Use `impeccable craft` (product register), not the brand register.

**Aesthetic:** minimalist-utility. Reuses the existing `LABEL_CHIP_COLORS.worker` palette (teal) for the provenance chip and for the group accent in the findings tab. Group section chrome matches the existing `CheckSection` chrome in `BdHealthPanel.tsx` — neutral-800 borders, `bg-neutral-900` header, `bg-neutral-950` body, `text-neutral-200` labels. No card-shadow inflation, no animated splashes.

**Anti-references:** no severity colour explosion (use existing `PRIORITY_STYLE` only), no animated count-ups, no gradient backgrounds on the worker groups, no novelty icons for each worker tag. The chip is text-only; no icon.

**Skills used at implementation time:**
- `impeccable craft` to draft `WorkerFindingsPanel.tsx`.
- `impeccable audit` to review the diff against the rest of the panel.
- `minimalist-ui` reference when condensing the per-finding row.
- `gitnexus-impact-analysis` before editing `TaskListItem.tsx` (high-traffic component).

**ASCII mockup of the new surface:**

```
┌─ bd Health ──────────────────────────────────────────── [Re-run] ─┐
│ [ Checks ] [ Worker findings ]                                    │
├───────────────────────────────────────────────────────────────────┤
│ ruflo-security                    7 findings  (1 critical, 4 hi…) │
│   BUI-abc123  P1  CVE in lodash <4.17.21          2026-05-16      │
│   BUI-abc124  P2  Outdated react-router            2026-05-15      │
│   …                                                                │
│ ruflo-test-gap                    3 findings  (3 medium)          │
│   BUI-def456  P3  src/auth.ts missing tests        2026-05-15     │
│ ruflo-cost                        1 finding   (1 low)             │
│   BUI-ghi789  P4  Daily token spend > $10          2026-05-14     │
└───────────────────────────────────────────────────────────────────┘
```

And the `TaskListItem` chip in context:

```
● Bug: stale dep in lodash             [ open ]
  BUI-abc123 [worker:security] [branch:main] [openspec:foo] +1   P1
```

## Risks / Trade-offs

- **Notes-prefix coupling.** If the hook ever changes its prefix string, the chip stops appearing. **Mitigation:** centralise the regex in one place (a `parseWorkerProvenance(notes)` helper in `src/lib/worker-findings.ts`) and reference it from both the Tauri parser-test and the frontend chip. Document the coupling in the helper's docstring.
- **Stale tab cache.** If `dolt_log()` invalidation doesn't propagate to the `worker-findings` query key, the tab could go stale. **Mitigation:** invalidate `['worker-findings', project_path]` from the same place `useTasks` invalidates, or piggyback by re-running the query whenever the global task cache rev changes.
- **Closed findings drop off.** Closing a finding removes it from the dashboard immediately, while blocked/custom unresolved statuses stay visible. **Mitigation:** acceptable — the tab is intentionally an action queue. A future `Closed` filter is a separate change.
- **Label-vs-notes drift.** Once `on-finding.sh` starts applying `ruflo:<worker>` labels (planned upstream), this UI keeps working — we keep the notes match as the source of truth and the label is treated as supplemental noise. A future change can flip the default to label-match without breaking the chip.
- **Notes containing the prefix in a comment (false positive).** A user-authored note that *starts* with `Auto-filed by ruflo-foo worker on …` or the legacy delimiter would match. **Mitigation:** acceptable for an informational chip, but the value is heuristic and MUST NOT be treated as authoritative identity for future write/trust workflows.
- **Worker tag explosion.** If a new worker tag appears, the group section renders the unknown tag verbatim and uses the teal palette. No code change required to support new workers.
- **Task row payload widening.** Adding parsed `worker_provenance` to `Task` is an additive binding change. **Mitigation:** the field is nullable, the SQL projection returns only the first notes line for matching rows, and the task list avoids shipping full notes or adding a second query.
