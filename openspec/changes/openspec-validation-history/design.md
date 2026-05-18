## Context

`OpenSpecPanel` (`src/components/task-detail/OpenSpecPanel.tsx`) hosts a `ValidateSection`
that calls the Tauri command `run_openspec_validate(project_path, change)` and renders a
single ephemeral `ValidationResult`. The result lives only in component state — re-validating
overwrites it; remounting (tab switch, task change) loses it.

Meanwhile the Ruflo memory store is already the canonical place for institutional knowledge
keyed by `branch/worktree/repo/openspec/issue`, and `RufloMemoryPanel` already shells out via
`ruflo_memory_search`. The gate used in `RufloMemoryPanel` for ruflo availability is the
existing `ruflo_version_probe` command (`src-tauri/src/commands/external.rs`).

`run_ruflo_managed(ruflo, &["memory", "store", "-k", KEY, "-v", VALUE], …)` already exists
as the underlying pattern for `ruflo_memory_search`; the new `record_*` command reuses it
for the `store` subcommand. The same key-derivation pattern from
`source ~/.claude/ruflo/lib/tags.sh && ruflo_key_prefix` is reproducible in Rust because
`get_workspace_context` already computes `branch:`, `worktree:`, and `repo:` labels from
`git rev-parse` and the project-path basename.

The work is read-mostly: one new store call per validate click, one new search call when the
panel opens (cached by TanStack Query), plus a compact UI list. All within existing patterns.

## Goals / Non-Goals

**Goals:**
- Persist every `openspec validate` invocation triggered from `OpenSpecPanel` so the user can
  audit pass/fail history per change.
- Render a collapsible "Validation history" section with the last 5 entries (newest-first).
  Each row shows timestamp + pass/fail badge + one-line summary, expandable to full errors.
- Re-use the Ruflo memory store — no new SQLite tables, no new files on disk.
- Gate the section behind `ruflo_version_probe` so users without `ruflo` installed get a
  clean degraded experience (mirrors `RufloMemoryPanel`).
- Auto-generated TypeScript bindings via `specta` / `tauri-specta`.

**Non-Goals:**
- No diff view between consecutive history entries.
- No retention or pruning policy — Ruflo's own consolidation handles long-term storage.
- No background or scheduled validation. Recording is strictly on-demand.
- No export, CSV, or copy-as-markdown of the history list.
- No surfacing of history on the Changes browser cards.
- No write API for editing or deleting individual history entries through the UI.

## Decisions

### 1. Storage: Ruflo memory store with structured pipe-delimited key

Each entry is one `ruflo memory store -k <KEY> -v <VALUE>` invocation.

**Key format** (matches the workspace convention in `~/.claude/ruflo/lib/tags.sh`):

```
branch:<branch>|worktree:<worktree>|repo:<repo>|openspec:<change-slug>|type:validate-history|outcome:<pass|fail>|ts:<epoch-ms>
```

`branch`, `worktree`, and `repo` are derived in Rust by the same logic as
`get_workspace_context` (`git rev-parse --abbrev-ref HEAD` + project-path basename). The
`outcome:` segment is `pass` if `ValidationResult.valid` is true, else `fail`. The `ts:`
segment is milliseconds since epoch from `SystemTime::now().duration_since(UNIX_EPOCH).as_millis()`.

**Value format**: a JSON object

```json
{
  "change_slug": "openspec-validation-history",
  "valid": false,
  "errors": ["spec.md missing scenario for empty state"],
  "ts_epoch": 1731808000,
  "ts_iso": "2024-11-17T01:46:40Z"
}
```

Stored as a single JSON string passed to `-v`. The `change_slug` is duplicated inside the
value so the list endpoint can verify each parsed entry matches the requested slug (defence
against future key-schema migrations).

**Alternative considered:** A new SQLite table or a JSON file under `.beads/`. Rejected —
the brief explicitly chose "lightweight: ruflo memory entries", and Ruflo memory is already
the canonical institutional-context store. Adding another sink fragments storage.

**Alternative considered:** `bd kv` or `bd remember`. Rejected — both are deprecated for
agent/UI context per the workspace `CLAUDE.md`.

### 2. Listing strategy: search by `type:validate-history` + slug, parse JSON values

`list_openspec_validations(project_path, change_slug)` runs:

```bash
ruflo memory search -q "openspec:<slug> type:validate-history" --format json
```

The command then:

1. Filters returned entries whose key contains `|openspec:<slug>|` AND `|type:validate-history|`.
   (Belt-and-braces against semantic over-match.)
2. Parses each entry's value as JSON into `ValidationHistoryEntry`.
3. Sorts by `ts_epoch` descending.
4. Truncates to a hard cap of 50 entries (the UI slices the first 5; the cap is defensive
   against runaway result sets).

**Alternative considered:** Encode all data in the key only (no JSON value). Rejected —
would require parsing structured data out of a delimiter-encoded key, which is brittle and
limits future fields. The pipe-delimited key indexes; the JSON value carries the payload.

### 3. Gating: `ruflo_version_probe` short-circuit

Following the pattern set by `RufloMemoryPanel`:

- The `<ValidationHistory>` component runs `ruflo_version_probe` once on mount (cached via
  TanStack Query with `staleTime: Infinity`, keyed `['ruflo-version']`).
- If the probe rejects (non-zero exit or "ruflo CLI not found"), the section renders a single
  muted line: `Validation history requires the ruflo CLI (memory store).` No history queries
  fire, no record calls fire.
- The `recordOpenspecValidation` IPC wrapper short-circuits client-side when the same probe
  result is unavailable — preventing wasted IPC and keeping the `ValidateSection` click flow
  resilient when ruflo is missing.

**Alternative considered:** Quietly swallow the error in the backend command. Rejected —
silent no-ops make "where did my history go?" debugging painful. Explicit gate, visible
message.

### 4. UI layout: section appended below ValidateSection, collapsible, last 5 rows

The new sub-component `<ValidationHistory>` is rendered inside `OpenSpecPanelBody` directly
after `<ValidateSection>`. It is wrapped in a `<details>` element (matches the existing
`OpenSpecPanel` outer collapsible pattern). Default state: collapsed.

Row layout (one per entry):

```
▸ 12:01 · 17 Nov · ✓ Valid
▸ 11:47 · 17 Nov · ✗ Invalid — spec.md missing scenario
```

Clicking a row chevron expands to show the full errors list (same rendering as `ValidateSection`).
Row text is truncated with `text-ellipsis overflow-hidden whitespace-nowrap`. A `<Tooltip>`
(already used by `ArtifactLink`) wraps the timestamp cell, showing the full ISO string on hover.

Empty state: a single muted line "No validations recorded yet — click Re-validate above."

"Show all" footer appears when `entries.length > 5`, expanding the list inline (not a
separate route).

### 5. Recording trigger: in-place hook inside ValidateSection

`ValidateSection.handleValidate` already awaits `runOpenspecValidate`. Immediately after the
result is computed (success OR failure path — we record both), the function calls
`recordOpenspecValidation(projectRoot, changeName, JSON.stringify(payload))` and then
`queryClient.invalidateQueries({ queryKey: ['validation-history', projectRoot, changeName] })`
so the new history row appears without a manual refresh. Recording failures are caught and
`console.warn`'d — they never surface to the user.

**Alternative considered:** Make the backend `run_openspec_validate` write to memory directly.
Rejected — it couples `run_openspec_validate` to ruflo availability (which it is independent
of today) and prevents future callers from opting out of recording.

### 6. No new spec capability

This change ADDS one requirement to and MODIFIES one scenario inside the existing
`openspec-panel` capability. The capability slug already exists at
`openspec/specs/openspec-panel/spec.md`. A separate `validation-history` capability would
over-fragment for a small per-change feature.

### 7. Concurrency / duplicate-key safety

Two validate clicks within the same second produce identical `ts:` segments at second
resolution. Mitigation: use `SystemTime::now().duration_since(UNIX_EPOCH).as_millis()` for
the `ts:` key segment. A human cannot click faster than 1ms. The JSON `ts_epoch` field stays
at seconds for display readability; `ts_ms` is only needed for the key.

### 8. UI design direction

- **Register**: `product` — surface lives inside the existing `OpenSpecPanel` task-detail
  pane. Implementers must use `impeccable craft` in product register, not the brand register.
- **Aesthetic**: minimalist-utility — small rows, neutral palette consistent with the
  surrounding `ValidateSection` (green for pass, red for fail, neutral-400/500 for chrome).
  Reuse the existing `Tooltip` component for timestamp on hover. No card shadows, no
  gradients, no animated reveals.
- **Anti-references**: no timeline rail with circles, no graph, no animated transitions,
  no novelty colour palette.
- **Skills used at implementation time**: `impeccable craft` to draft the `<ValidationHistory>`
  component and row sub-component; `impeccable audit` to review the diff against the existing
  panel chrome; `minimalist-ui` reference when condensing rows.

ASCII mockup of the new section:

```
  ▼ OpenSpec   openspec-validation-history
    ...
    Validate                            [Re-validate]
    ✓ Valid as of 12:01:14
    ─────────────────────────────────────────────────
    ▶ Validation history (5)
      ▸ 12:01 · 17 Nov · ✓ Valid
      ▸ 11:47 · 17 Nov · ✗ Invalid — spec.md missing scenario
      ▸ 09:12 · 16 Nov · ✓ Valid
      Showing 3 of 3
```

## Risks / Trade-offs

- **Ruflo missing** → degraded gate is explicit; Re-validate still works. History just doesn't
  accrue. No silent data loss.
- **Memory entry write fails mid-session** → recording errors are logged but never thrown
  back to the user; the Re-validate flow remains unaffected. A subsequent successful write
  populates the next row.
- **`ruflo memory search` semantic over-match** → defended by the client-side key-pattern
  filter (`|openspec:<slug>|` AND `|type:validate-history|`).
- **Cross-branch leakage** → the key embeds `branch:<branch>|worktree:<worktree>|repo:<repo>`
  derived from the current project, same convention `ruflo_key_prefix` enforces in shell. Two
  worktrees on the same change see distinct histories.
- **Very long error lists in summary** → summary row truncates the first error to a single
  line. Full text is available in the expanded view.
