## Context

The BeadSpec workflow instructs agents to run `code-review:code-review`, `security-review`, and `gitnexus-pr-review` at key moments, but the output of those skills is ephemeral — it exists only in the agent transcript for the duration of the session. The Ruflo memory system (`ruflo memory store / search`) already handles structured key-value storage backed by AgentDB (WASM SQLite). Review capture is a thin wrapper on top of that plumbing: a shell script to write and Tauri commands to read.

The two UI surfaces that benefit most are:
1. `TaskDetailPanel` — already has an Activity tab with multiple sections (OpenSpec, Related Memories, Git history). Reviews are another section in that tab, scoped per-issue by its `branch:` label.
2. `BdHealthPanel` — already has a tabbed layout for health checks. A Reviews sub-tab gives a cross-branch overview with filtering.

No persistence layer work is needed: Ruflo AgentDB already exists and is on the happy path for every workflow session.

## Goals / Non-Goals

**Goals:**
- CLI helper `scripts/bd-capture-review.sh` that writes review markdown to Ruflo memory under a structured, parseable key.
- Two Tauri commands (`list_reviews`, `get_review`) that surface captured reviews to the frontend.
- Reviews section in `TaskDetailPanel` Activity tab, scoped to the issue's branch (and PR if labelled).
- Reviews sub-tab in `BdHealthPanel` with branch grouping, kind-filter chips, and inline markdown viewer.
- All UI gated on the existing Ruflo feature flag — no reviews surface when Ruflo is disabled.

**Non-Goals:**
- No Dolt schema changes or new SQLite tables. Ruflo memory is the store for v1.
- No UI write / edit / delete. Reviews are append-only; removal uses `ruflo memory forget` in terminal.
- No automatic capture via hooks, transcript scraping, or pre-commit sidecars. Capture is explicit.
- No PR-number auto-resolution via `gh`; callers supply `--pr <num>` at capture time.
- No surfacing reviews on `ChangesBrowser` cards (possible follow-up; see changes-browser-dep-chips pattern).
- No migration path from v1 memory store to a future SQLite table — that is a separate follow-up change.

## Decisions

### 1. Storage: Ruflo memory entries with structured key

Review entries are stored via `ruflo memory store -k "$KEY" -v "$BODY"` where the key encodes all queryable dimensions:

```
<ruflo_key_prefix>|review:<kind>|branch:<name>|[pr:<num>|]ts:<epoch>
```

`<ruflo_key_prefix>` is `branch:<b>|worktree:<w>|repo:<r>` (from `source ~/.claude/ruflo/lib/tags.sh && ruflo_key_prefix`). The `review:<kind>` segment doubles as a type discriminator. The epoch suffix makes every key unique at second resolution. No key collisions are possible in normal usage.

**Why not Dolt?** Avoiding schema changes keeps the change small, reviewable, and rollback-safe. If review volume grows or cross-project search becomes important, a dedicated table is the obvious v2 path.

### 2. CLI helper: `scripts/bd-capture-review.sh`

- **Args:** `--kind <pr-review|code-review|security-review>` (required), `--branch <name>` (required), `--pr <number>` (optional), `--title <text>` (optional; defaults to first H1 line of stdin).
- **Reads:** full review markdown from stdin until EOF.
- **Resolves:** `ruflo_key_prefix` via sourcing `~/.claude/ruflo/lib/tags.sh`. Fails fast (exit 3) if the source or the function is unavailable.
- **Writes:** `ruflo memory store -k "$KEY" -v "$BODY"`. Fails with exit 4 if the store command returns non-zero.
- **Deduplication:** optional `--dedupe-sha` flag computes `sha256` of body and aborts (exit 0 + warning) if a key with `sha:<digest>` substring already exists. Prevents double-capture on reruns.
- **Exit codes:** 0 success, 2 bad/missing args, 3 prefix lookup failed, 4 ruflo store failed.
- **Output:** on success, prints the written key and a one-line confirmation to stdout.

### 3. Skill integration is explicit, not magic

Each review skill's SKILL.md receives a new final step instructing the agent to pipe output through `bd-capture-review.sh`. This is noted in `tasks.md` as task 8 (out-of-scope for this change's implementation — a follow-up PR per skill). No hook, transcript scraping, or auto-capture is introduced. Explicit pipe-through lets agents choose not to capture (e.g., a quick exploratory review).

### 4. Backend: new module `src-tauri/src/commands/reviews.rs`

Two Tauri commands:

**`list_reviews(project_path, scope)`** — Returns `Vec<ReviewEntry>`. `scope` is a `ReviewScope` enum: `Branch(String)`, `Pr(u32)`, `TaskId(String)` (derives branch from the task's `branch:` label), `All`. Implementation: shell out to `ruflo memory search -q <query> --json`, parse JSON array into `Vec<ReviewEntry>`.

**`get_review(key)`** — Returns `ReviewEntry` with full `body` populated. Implementation: `ruflo memory retrieve -k "$key" --json`.

Specta-derived types:
- `ReviewKind` enum: `PrReview`, `CodeReview`, `SecurityReview`
- `ReviewEntry { key, kind, branch, pr_number, ts, title, body_preview, body }`
- `ReviewScope` enum

**v1 assumption:** `ruflo memory search --json` returns a stable JSON array. If the `--json` flag is absent in the installed version, the backend falls back to reading AgentDB SQLite directly (path: `~/.claude/ruflo/data/agentdb.sqlite3`). The Rust code encodes this fallback path with a `TODO(v2)` note pointing to a direct SQLite read via `sqlx`.

### 5. IPC wrappers in `src/ipc.ts`

```ts
listReviews(projectPath: string, scope: ReviewScope): Promise<ReviewEntry[]>
getReview(key: string): Promise<ReviewEntry>
```

Both follow the `invoke<T>` pattern already established by `getChangeBeadsProgress` and `runOpenspecValidate`.

### 6. `TaskDetailPanel` Activity tab integration (MODIFIED `task-detail`)

A new `ReviewsSection` component mounts **below** the existing Related Memories section in the Activity tab (preserving the "additive section ordering" requirement: OpenSpec → Related Memories → Reviews → Git history). The component:

- Derives `branch` from the task's `branch:<name>` label using the existing label-parse helper (split on first colon).
- Optionally includes `pr:<num>` scope if the task carries a `pr:` label.
- Renders each review as a `ReviewRow`: kind pill + title + relative timestamp. Clicking a row expands inline using the existing Tiptap markdown renderer.
- Hides the entire section (no placeholder) when the `ReviewEntry[]` result is empty — matching the changes-browser-dep-chips convention.
- Entirely absent (no IPC call) when Ruflo is disabled in Settings — matching existing `RufloMemoryPanel` gating.

### 7. `BdHealthPanel` Reviews sub-tab (MODIFIED `bd-health-panel`)

New sub-tab alongside the existing health check sections. Layout:

```
┌─ Health ──────────────────────────────────────────────────────┐
│  [Checks]  [Reviews]                                          │
│                                                               │
│  Reviews                             [PR] [Code] [Security]   │
│  Search: ___________________________                          │
│                                                               │
│  ▼ branch: feat/skill-output-capture (2)                      │
│    ● PR Review  · "PR #42 review"  · 2h ago                   │
│    ● Code Review · "auth module"   · 5h ago                   │
│                                                               │
│  ▼ branch: feat/epic-progress-dashboard (1)                   │
│    ● Security Review · "dep audit" · 1d ago                   │
│                                                               │
│  (Empty state) "No reviews captured yet. Run a review skill   │
│   and pipe through scripts/bd-capture-review.sh."             │
└───────────────────────────────────────────────────────────────┘
```

- Filter chips: `PR`, `Code`, `Security` — toggle independently, all active by default.
- Text search filters on title (case-insensitive substring).
- Branch groups are collapsible. Collapsed by default when there are >3 groups.
- Row click opens `ReviewMarkdownViewer` inline (same Tiptap renderer instance pattern used in ReviewsSection).

### 8. Kind pill palette

Reuse `LABEL_CHIP_COLORS` neutrals — no new palette tokens:
- `code-review` → neutral-slate
- `pr-review` → neutral-amber
- `security-review` → neutral-rose

### 9. No write/edit/delete in v1

Reviews are append-only from the CLI. The UI renders no edit button, no delete button, no "add review" modal. Deletion is `ruflo memory forget -k <key>` from terminal. This is an explicit design decision: reviews are source-of-truth artifacts produced by skills, not user-editable notes.

## UI Design Direction

**Register:** `product` — use `impeccable craft` (product register) at implementation time, not brand register.

**Aesthetic:** minimalist-utility. Small kind pills using the existing `LABEL_CHIP_COLORS` system. Dense but legible row list. Neutral palette consistent with `RufloMemoryPanel` and `BdHealthPanel`. Low chrome — no card shadows, no animated reveals.

**Anti-references:** no novelty chrome, no animated splashes, no AI-stock gradients, no card-shadow inflation.

**Skills at implementation time:**
- `impeccable craft` — draft `ReviewsSection`, `ReviewRow`, `ReviewMarkdownViewer`, and the BdHealthPanel Reviews sub-tab.
- `impeccable audit` — review the diff against the rest of the app for consistency.
- `minimalist-ui` reference — condense branch group lists; avoid over-padding.

**ASCII mockup — Activity tab Reviews section:**

```
┌─ Activity ─────────────────────────────────────────────────────┐
│  · [slate] Code Review  "auth module refactor"   · 5h ago  ›  │
│  · [amber] PR Review    "PR #38 review"          · 1d ago  ›  │
└────────────────────────────────────────────────────────────────┘
```

**ASCII mockup — BdHealthPanel Reviews sub-tab:**

```
[Checks]  [Reviews]
Reviews                           [PR ×] [Code ×] [Security ×]
Search: ______________________

▼ feat/skill-output-capture  (2)
  [amber] PR Review   · "PR #42 review"   · 2h ago
  [slate] Code Review · "auth module"     · 5h ago

▼ feat/epic-progress-dashboard  (1)
  [rose]  Security    · "dep audit"       · 1d ago
```

## Risks / Trade-offs

- **`ruflo memory search --json` contract** — v1 assumes the `--json` flag exists and returns a stable array. If absent, the backend panics with a clear error pointing to the AgentDB SQLite fallback. Verification required at implementation time (open question for implementer).
- **Tiptap renderer reuse** — assumes the renderer component is exportable without context coupling. If it has a deep context dependency, a thin wrapper will be needed (already noted in task 5).
- **Performance at scale** — `ruflo memory search` issues a subprocess call per `listReviews` invocation. At expected review volume (<100 entries per branch) this is fine. If it becomes slow, cache via `TanStack Query` with a reasonable `staleTime`.
- **Key format stability** — if `ruflo_key_prefix` output format changes, stored keys become unparseable. Mitigation: parse defensively (skip entries that fail to parse) and log a warning.
