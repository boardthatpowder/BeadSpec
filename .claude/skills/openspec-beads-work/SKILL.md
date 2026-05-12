---
name: openspec-beads-work
description: Single-issue agent execution loop for OpenSpec-backed Beads work. Claim one ready issue, re-read the referenced OpenSpec artifacts, plan, implement scoped changes, run unit tests and openspec validate, then close or update with blockers. Self-contained — no runbook needed.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.1.1"
---

Work one Beads issue from claim to completion.

**Source-of-truth rule:** OpenSpec owns the spec. Beads owns the task graph. All scope decisions defer to OpenSpec artifacts. If scope is unclear, re-read the spec — do not invent behavior.

**Input**: A Beads issue ID. If omitted, run `bd ready` and pick the top-ranked issue.

**Steps**

1. **Refresh session state**

   ```bash
   bd dolt pull
   bd ready
   ```

   If no issues are ready, report that to the user and stop.

2. **Inspect and claim the issue**

   ```bash
   bd show <issue-id>
   bd update <issue-id> --claim
   ```

   From the issue description, extract:
   - The OpenSpec change path (e.g., `openspec/changes/add-account-health-summary/`)
   - The original task wording
   - Acceptance criteria
   - Expected validation command
   - Likely file/module boundary

   Surface past memory for this change and issue (run only if ruflo is installed):
   ```bash
   ruflo memory search -q "openspec:<change-id> implementation decisions" 2>/dev/null | head -20 || true
   ruflo memory search -q "<issue-title-keywords> patterns" 2>/dev/null | head -20 || true
   ruflo intelligence suggest --context "$(bd show <issue-id> --format title 2>/dev/null)" 2>/dev/null | head -10 || true
   ```

3. **Re-read the OpenSpec source**

   Read the referenced OpenSpec artifacts before touching any code:
   - `openspec/changes/<change-id>/proposal.md` — scope and requirements
   - `openspec/changes/<change-id>/design.md` — architecture decisions
   - `openspec/changes/<change-id>/tasks.md` — task context and neighboring tasks
   - Any capability spec file referenced in the issue description

   State a short plan before editing:
   ```
   Plan:
   1. <what you will implement>
   2. <where it lives>
   3. <what tests you will write or update>
   4. <validation command>
   ```

4. **Implement — scoped to this issue only**

   Allowed scope: the files and modules named in the issue and its OpenSpec task.

   Not allowed: unrelated integration wiring, UI changes, refactors, schema changes, or public API changes not named in this issue.

   Follow TDD: write or update failing tests first, then implement.

   If you discover extra work during implementation:
   - Do NOT silently expand scope
   - Use the **openspec-beads-followup** skill to triage it (in-scope bug vs. out-of-scope follow-up)
   - If it blocks this issue, link the new issue as a dep before continuing

   If you discover a spec gap (behavior is missing or contradictory in OpenSpec):
   - Use the **openspec-beads-scope-change** skill to update OpenSpec first
   - Do not implement behavior that isn't specified in OpenSpec

5. **Validate**

   ```bash
   <project unit test command>
   openspec validate <change-id>
   ```

   If no unit test command exists yet, run the narrowest available validation and state why no tests apply.

   For narrow changes, run the focused test command instead of the full suite:
   ```bash
   <focused test command>
   ```

   Do not run integration tests unless the user explicitly approves in this thread.

6. **Tick the tasks.md checkbox**

   Before closing, mark this task done in the OpenSpec tasks file:
   ```
   openspec/changes/<change-id>/tasks.md
   ```
   Change `- [ ] <task text>` → `- [x] <task text>` for the task(s) this issue covers.

   This keeps the tasks.md in sync with Beads so `openspec validate` and `/opsx:verify` have accurate completeness data.

7. **Close or update**

   If complete:
   ```bash
   bd close <issue-id> --reason="<what was implemented, what tests were added, that validation passes>"
   ```

   Write a trajectory entry so future sessions can recall this work (run only if ruflo is installed):
   ```bash
   source ~/.claude/ruflo/lib/tags.sh 2>/dev/null && \
     KEY="$(ruflo_key_prefix)|openspec:<change-id>|issue:<issue-id>|type:trajectory|outcome:closed|ts:$(date +%s)" && \
     VALUE="$(bd show <issue-id> --format markdown 2>/dev/null)
   files: $(git diff --name-only main..HEAD 2>/dev/null | tr '\n' ',')
   commit: $(git rev-parse HEAD 2>/dev/null)" && \
     ruflo memory store -k "$KEY" -v "$VALUE" 2>/dev/null || true
   bd ready
   ```

   If blocked:
   ```bash
   bd update <issue-id> --notes="Blocked: <reason>. Created <blocker-id> to resolve."
   bd ready
   ```

**Guardrails**
- Never start implementing without claiming the issue first (step 2)
- Never expand scope beyond the claimed issue — create new issues for discovered work
- Always re-read OpenSpec artifacts before coding (step 3)
- Always run unit tests and `openspec validate` before closing
- Always update the tasks.md checkbox before closing (step 6)
- Never run integration tests without explicit user approval in this thread
