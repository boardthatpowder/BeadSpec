# OpenSpec + Beads + Ruflo + GitNexus — Developer Workflow Runbook

> **Audience:** Developers and AI assistants onboarding to this workflow, and engineers porting it to a different assistant runtime (Cursor, Codex, etc.).
>
> **Canonical living source:** This file. `AGENTS.md` and `CLAUDE.md` contain the agent-facing summary; this runbook is the full reference including installation, hook wiring, skill internals, and the porting guide.

---

## 1. Tool stack — what each piece does and why it's here

| Tool | Role | Why composed |
|---|---|---|
| **OpenSpec** (`openspec`) | Spec-driven change management. Maintains proposal → design → tasks artifacts per change. Validates spec integrity. | Keeps AI and human aligned on scope before any code is written. Archive operation merges deltas back to main specs. |
| **Beads** (`bd`) | Dolt-powered dependency-aware issue tracker. Computes a `bd ready` queue of unblocked work. Provides epics, gates, merge-slots, Dolt audit trail. | Turns a tasks.md file into an executable, queryable dependency graph. Work is always pulled from `bd ready` — no ad-hoc task assignment. |
| **Ruflo** (`ruflo`) | Memory (AgentDB WASM SQLite), background workers, neural pattern learning, session save/restore. | Cross-session memory so context survives compaction, new sessions, and worktree switches. Worker findings auto-file Beads issues. |
| **GitNexus** (`npx gitnexus`) | Code knowledge graph (symbols, call graph, execution flows). MCP server exposes `gitnexus_impact`, `gitnexus_context`, `gitnexus_query`, `gitnexus_detect_changes`. | Blast-radius awareness before editing. Prevents hidden breakage across the codebase. |

Together: OpenSpec owns **scope** → Beads owns **execution** → Ruflo owns **memory** → GitNexus owns **safety**.

---

## 2. Installation

### Prerequisites

| Tool | Install |
|---|---|
| `bd` (Beads) | `brew install gastownhall/beads/bd` |
| `openspec` | `npm install -g @fission-ai/openspec` |
| `ruflo` | `npm install -g ruflo@ruflo` |
| `gitnexus` | used via `npx gitnexus` (no global install needed) |
| `jq` | `brew install jq` |

### Project setup

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd <project>

# 2. Install Beads runtime (creates .beads/ and wires the Dolt database)
bd init

# 3. Link Beads runtime in this worktree (if using worktrees)
scripts/setup-worktree-beads.sh

# 4. Initialize Ruflo memory and embeddings
ruflo embeddings init
ruflo memory init

# 5. Index the codebase in GitNexus (first run; ~2 min)
npx gitnexus analyze

# 6. (Optional) Install .githooks pre-commit
git config core.hooksPath .githooks

# 7. Verify
bd doctor --agent --json
openspec list
ruflo memory stats
```

### Worktree setup

Always create worktrees via the provided script — it links the shared Beads Dolt database:

```bash
scripts/create-worktree.sh <path> --branch <branch-name>
```

If a worktree was created manually, repair it before running any `bd` command:

```bash
scripts/setup-worktree-beads.sh
```

---

## 3. Skill suite — all 7 skills

> **Finding these files:** `.claude/skills/openspec-beads-<name>/SKILL.md`
>
> **Helper library:** `scripts/openspec-beads/` (see §5).

---

### 3.1 openspec-beads-sync

**When to use:** At the start of any session before picking up OpenSpec-backed Beads work.

See `.claude/skills/openspec-beads-sync/SKILL.md` for the full skill definition.

**Key steps:**
1. Repair worktree Beads runtime + warm up embeddings (`ruflo embeddings warmup`)
2. `bd prime` + `bd dolt pull`
3. Resolve `_gitnexus_repo=$(basename "$(git rev-parse --show-toplevel)")` → read `gitnexus://repo/${_gitnexus_repo}/context` MCP resource; run `openspec validate --all --strict --json`
4. Advisory preflight (`obws_gate_preflight`) + surface open worker-filed issues (`ruflo:*` label count)
5. `bd ready --explain --json` + `bd blocked`
6. Write one-paragraph state summary

---

### 3.2 openspec-beads-import

**When to use:** After OpenSpec artifacts are approved, before coding starts.

See `.claude/skills/openspec-beads-import/SKILL.md` for the full skill definition.

**Key steps:**
1. `obws_gate_validate <change-id> strict` + `obws_gate_status`
2. Read tasks.md — 1:1 mapping, every `- [ ] N.M` → one Beads node
3. Build dependency graph (cognitive step) enriched via `gitnexus_query`
4. Write `.bd-graph.json` to `openspec/changes/<change-id>/`
5. `obws_import_graph <change-id>` — atomic create + tag + wire deps
6. Verify: `bd children <epic-id> --pretty`; all issues carry the four context labels + `openspec:<change-id>`
7. `bd ready --explain --json` + optional HTML dep graph

---

### 3.3 openspec-beads-work

**When to use:** Working one Beads issue from claim to completion.

See `.claude/skills/openspec-beads-work/SKILL.md` for the full skill definition.

**Key steps:**
1. `bd dolt pull` + `bd ready`
2. `bd show` + `obws_assert_claimable` + `bd update --claim`; recall memory
3. Re-read OpenSpec artifacts; fetch task-relevant guidance via `ruflo guidance retrieve`
4. `obws_gate_impact "<Symbol>"` + MCP calls `gitnexus_context` + `gitnexus_impact` — **mandatory before editing**
5. Implement scoped to this issue only; TDD
6. `obws_gate_unit_tests` + `obws_gate_validate` + `obws_gate_guidance_gates` + `obws_gate_detect_changes`
7. `obws_tick_task <change-id> "$TASK_REF"` — mandatory checkbox tick
8. `bd close --reason --suggest-next`; `git commit`; `obws_mem_write_trajectory`

---

### 3.4 openspec-beads-complete

**When to use:** All implementation issues for an OpenSpec change are done.

See `.claude/skills/openspec-beads-complete/SKILL.md` for the full skill definition.

**Key steps:**
1. Query `openspec:<change-id> AND status!=closed AND (type=task OR type=bug)` — must return 0 rows
2. Confirm all tasks.md checkboxes are `- [x]`
3. `obws_gate_validate <change-id> strict` + `obws_gate_status` — both must pass
4. `obws_gate_unit_tests` + `obws_gate_guidance_gates` + `obws_gate_lint` + `obws_gate_detect_changes` + `obws_affected_processes` + `obws_gate_orphans` + `obws_gate_preflight`
5. `bd epic close-eligible --dry-run --json` → `bd close "$_epic_id"`
6. `obws_mem_write` retrospective + `obws_mem_consolidate` + `ruflo neural train`
7. Invoke `openspec-archive-change`
8. `bd merge-slot acquire` → `git add` + `git commit` → `obws_session_close "<change-id>" "$_epic_id"`

---

### 3.5 openspec-beads-followup

**When to use:** Work discovered during implementation that must be filed without expanding scope.

See `.claude/skills/openspec-beads-followup/SKILL.md` for the full skill definition.

**Decision tree:** Q1 (scope change?) → Q2 (defect in existing spec?) → Q3 (required for change to ship?)

| Result | Type | Priority | Carries `openspec:<change-id>` |
|---|---|---|---|
| In-scope bug | `bug` | 1 | Yes |
| In-scope task | `task` | 2 | Yes |
| Follow-up | `task` | 4 | **No** — must not appear in completion check |
| Worker finding | varies | varies | After triage → `bd link <worker-id> <epic-id> --type=related` |

---

### 3.6 openspec-beads-scope-change

**When to use:** Spec gap found — API, acceptance criteria, behavior, or data model must change.

See `.claude/skills/openspec-beads-scope-change/SKILL.md` for the full skill definition.

**Key steps:**
1. Pause current issue + write memory + optional `bd gate create --type=human`
2. Update OpenSpec artifacts via `openspec-continue-change` or `openspec-sync-specs`
3. `obws_gate_validate <change-id>` (non-strict) + `obws_validate_main_specs`
4. `bd create` new scope issue + `obws_tag_context` + `obws_tag_change`
5. `bd dep add` with `--type=caused-by`
6. `bd ready` + hand off to `openspec-beads-resume`

---

### 3.7 openspec-beads-resume

**When to use:** Resuming a paused issue (`Paused:` in notes) or recovering a partial import.

See `.claude/skills/openspec-beads-resume/SKILL.md` for the full skill definition.

**Key steps:**
1. `bd dolt pull` + locate via `bd list --label "openspec:paused"`
2. Recover memory via `obws_mem_search_issue` + `bd history`
3. `obws_gate_validate <change-id>` (non-strict)
4. `obws_import_graph` if partial import
5. `obws_assert_claimable` + `bd update --claim`
6. Hand off to `openspec-beads-work` (skip steps 1–2)

---

## 4. Hook wiring

### 4.1 Claude Code hooks (`.claude/settings.json`)

All hooks live under `.claude/hooks/`. They fire automatically within Claude Code sessions.

**Hooks wired by default (in `.claude/settings.json`):**

| Event | File | Behavior |
|---|---|---|
| PreToolUse: `Write\|Edit` | `ruflo-pre-edit.sh` | Fires `ruflo hooks pre-edit -f <file>` in background |
| PreToolUse: `Bash` | `ruflo-pre-commit.sh` | On `git commit`: `ruflo analyze diff --risk`; validates active OpenSpec change — **blocking (exit 1)** |
| PostToolUse: `Edit\|Write` | `ruflo-post-edit.sh` | Fires `ruflo hooks post-edit -f <file>` in background |
| PostToolUse: `Bash` | `ruflo-post-push.sh` | On `git push`: `ruflo neural train` in background |
| PostToolUse: `Bash` | `gitnexus-analyze.sh` | On `git push`: `npx gitnexus analyze` async (300s timeout) |
| Stop | `ruflo-session-end.sh` | Saves session state and trains neural patterns |

**Stack-specific hooks (present but NOT wired — opt-in):**

| File | Stack | What it does |
|---|---|---|
| `no-any.sh` | TypeScript | Blocks `any` usage — exit 2 |
| `no-mock-module.sh` | Bun | Blocks module-stubbing API — exit 2 |
| `tdd-nudge.sh` | TypeScript (generic) | Warns (non-blocking) when a new source file has no sibling test |
| `biome-fix.sh` | Biome (TS/JS) | Auto-formats after each edit |
| `typecheck.sh` | TypeScript | On `git commit`: `tsc --noEmit` — **blocking (exit 2)** |

To wire a stack-specific hook, add it to the relevant event in `.claude/settings.json`. See README.md for the wiring snippet.

### 4.2 Background workers (`~/.claude/ruflo/workers.toml`)

Workers run as Claude Code session commands (`/ruflo-loop`, `/ruflo-schedule`). They are report-only — never commit code.

| Worker | Schedule | Files what | Worker tag |
|---|---|---|---|
| `security-audit` | daily 9am | `bd type=bug priority=1` | `ruflo:security-audit` |
| `test-gap-detector` | every 4h | `bd type=task priority=3` | `ruflo:test-gap-detector` |

Filed issues land in Beads with `ruflo:<worker-tag>` label. Triage them with `openspec-beads-followup` → "Worker-filed findings" variant.

---

## 5. Helper library (`scripts/openspec-beads/`)

All helpers are sourced automatically when `. init.sh` is executed. `obws_init <skill>` then resolves the `OBWS_*_LABEL` environment variables.

```bash
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
obws_init work || return 1   # resolves OBWS_BRANCH_LABEL, OBWS_WORKTREE_LABEL, OBWS_REPO_LABEL
```

| File | Key exports |
|---|---|
| `context.sh` | `obws_resolve_prefix`, `obws_tag_context`, `obws_tag_change`, `obws_assert_claimable` |
| `memory.sh` | `obws_mem_write`, `obws_mem_write_trajectory`, `obws_mem_search_change`, `obws_mem_search_issue`, `obws_mem_consolidate` |
| `gates.sh` | `obws_gate_validate`, `obws_gate_status`, `obws_gate_unit_tests`, `obws_gate_preflight`, `obws_gate_impact`, `obws_gate_detect_changes`, `obws_gate_lint`, `obws_gate_orphans`, `obws_gate_guidance_gates`, `obws_affected_processes`, `obws_validate_main_specs`, `obws_session_close` |
| `graph.sh` | `obws_import_graph` |
| `branch.sh` | `obws_base_branch` |
| `tasks.sh` | `obws_tick_task` |
| `dup.sh` | `obws_find_dups` |

### Environment overrides

| Variable | Default | Purpose |
|---|---|---|
| `OBWS_UNIT_TEST_CMD` | `bun run test:unit` | Override for your stack's test command |
| `OBWS_SKIP_NONGO_PREFLIGHT` | `1` | Suppress Go-toolchain preflight (irrelevant in non-Go repos) |
| `OBWS_DUP_METHOD` | `mechanical` | `mechanical` (fast) or `ai` (semantic, costs tokens) |

---

## 6. Session-close protocol

**Canonical source for agents and humans.** Every work session ends with this sequence:

```bash
git pull --rebase
bd dolt push
git push
git status   # MUST show "up to date with origin"
```

The `openspec-beads-complete` skill automates this via `obws_session_close <change-id> [epic-id]`. For ad-hoc sessions, run the sequence manually.

Work is **NOT done until `git push` succeeds.** Never say "done" before pushing.

---

## 7. Mandatory Beads tagging

Every `bd create` call (ad-hoc or skill-driven) must be followed by three context tags:

```bash
source ~/.claude/ruflo/lib/tags.sh
PREFIX=$(ruflo_key_prefix)
BRANCH_LABEL=$(echo "$PREFIX"   | awk -F'|' '{print $1}')
WORKTREE_LABEL=$(echo "$PREFIX" | awk -F'|' '{print $2}')
REPO_LABEL=$(echo "$PREFIX"     | awk -F'|' '{print $3}')

bd tag <new-issue-id> "$BRANCH_LABEL"
bd tag <new-issue-id> "$WORKTREE_LABEL"
bd tag <new-issue-id> "$REPO_LABEL"
```

The `openspec-beads-*` skills handle this automatically via `obws_tag_context`. Ad-hoc `bd create` calls must tag manually.

Verify with `bd show <id>` — `LABELS:` must contain all three context labels.

---

## 8. Porting to other runtimes (Cursor, Codex, etc.)

### What's Claude-specific

| Feature | Claude-specific? | Alternative |
|---|---|---|
| Skill files (`.claude/skills/*.md`) | Yes — loaded by Claude Code slash-command harness | Copy skill content into your assistant's system prompt or a `AGENTS.md`-style instruction file |
| Hook wiring (`.claude/settings.json`) | Yes — Claude Code hook system | Wire equivalent shell scripts as pre/post-commit git hooks or editor on-save hooks |
| `bd prime` SessionStart injection | Yes — Claude Code `SessionStart` hook | Call `bd prime` manually at the start of each agent session, or add it to your assistant's init prompt |
| MCP tool calls (`{}` syntax) | Yes — Claude MCP client | Replace `gitnexus_impact({...})` with the CLI fallback: `gitnexus impact <symbol> --upstream --depth 3` |

### What ports directly

All shell helpers in `scripts/openspec-beads/` are POSIX `sh` and work in any terminal. Any assistant that can run shell commands can call `obws_gate_validate`, `obws_import_graph`, etc. after `. init.sh`.

`bd`, `openspec`, `ruflo`, and `npx gitnexus` are all CLI tools — they work from any shell regardless of the AI runtime.

### Porting checklist

1. Copy `scripts/openspec-beads/` into the target repo or reference it via submodule.
2. Copy the 7 skill files' content into your assistant's instruction set (system prompt, AGENTS.md, etc.).
3. Wire the quality gates (tsc, formatter) as native git hooks if the runtime doesn't have a hook system.
4. Replace MCP tool calls (`gitnexus_impact({...})`) with CLI equivalents: `gitnexus impact <symbol> --upstream --depth 3`.
5. Replace `bd prime` SessionStart hook with a manual `bd prime` invocation in the assistant's init.
6. Replace `ruflo hooks session-restore` with `ruflo memory search -q "recent context $(git branch --show-current)"` for session recovery.
7. The `biome-fix.sh` auto-format hook becomes a git `post-checkout` or `post-commit` hook, or an editor on-save action.
