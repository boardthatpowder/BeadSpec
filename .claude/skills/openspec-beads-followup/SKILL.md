---
name: openspec-beads-followup
description: Triage discovered work into in-scope bug, in-scope task, or out-of-scope follow-up. Sets correct type, priority, and dependency linkage in Beads. Does not silently expand the claimed issue's scope.
license: MIT
compatibility: Requires bd (beads) CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.1.1"
---

Triage work discovered during implementation without expanding the scope of the claimed issue.

**Source-of-truth rule:** OpenSpec owns agreed scope. Do not expand a claimed Beads issue to cover discovered work. File a new issue instead.

**Input**: A description of the discovered work and the current claimed issue ID.

**Decision tree**

Answer these questions in order:

**Q1: Does this change public API shape, user-visible behavior, acceptance criteria, or data model?**
- Yes → This is a scope change. Stop here. Use the **openspec-beads-scope-change** skill instead. Do not file a Beads issue until OpenSpec is updated.
- No → Continue to Q2.

**Q2: Is this a defect in behavior the OpenSpec change already specifies?**
- Yes → In-scope bug. See below.
- No → Continue to Q3.

**Q3: Is this work required for the current OpenSpec change to ship correctly?**
- Yes → In-scope task (priority=2). See below.
- No → Out-of-scope follow-up (priority=4). See below.

---

**In-scope bug**

```bash
bd create \
  --title="<concise bug description>" \
  --description="Bug found while implementing openspec/changes/<change-id>. Existing scope already requires <correct behavior>. <Steps to reproduce or evidence>. Add regression test coverage." \
  --type=bug \
  --priority=1
```

Link it as a blocker if the current issue cannot be closed without it:
```bash
bd dep add <current-issue-id> <new-bug-id>
```

**In-scope task**

```bash
bd create \
  --title="<task description>" \
  --description="Discovered while implementing openspec/changes/<change-id>. Required for this change to satisfy acceptance criteria. <Context and expected behavior>." \
  --type=task \
  --priority=2
```

Link downstream work that depends on it:
```bash
bd dep add <downstream-issue-id> <new-task-id>
```

**Out-of-scope follow-up**

```bash
bd create \
  --title="<follow-up description>" \
  --description="Follow-up idea discovered during openspec/changes/<change-id>. Not required for the current change. Consider after it ships. <Context and motivation>." \
  --type=task \
  --priority=4
```

No dependency linking needed for pure follow-ups.

---

**After creating the issue**

**Tag with the standard context labels (MANDATORY).** Every Beads issue must carry `branch:<name>`, `worktree:<name>`, `repo:<name>`, plus `openspec:<change-id>`:

```bash
source ~/.claude/ruflo/lib/tags.sh
PREFIX=$(ruflo_key_prefix)
BRANCH_LABEL=$(echo "$PREFIX"   | awk -F'|' '{print $1}')
WORKTREE_LABEL=$(echo "$PREFIX" | awk -F'|' '{print $2}')
REPO_LABEL=$(echo "$PREFIX"     | awk -F'|' '{print $3}')

bd tag <new-issue-id> "$BRANCH_LABEL"
bd tag <new-issue-id> "$WORKTREE_LABEL"
bd tag <new-issue-id> "$REPO_LABEL"
bd tag <new-issue-id> "openspec:<change-id>"
```

Verify with `bd show <new-issue-id>` — the LABELS line must show all four.

Report:
- Issue type (bug / in-scope task / follow-up)
- New Beads issue ID and priority
- Whether it blocks the current issue or not

Write triage rationale to memory (run only if ruflo is installed):
```bash
source ~/.claude/ruflo/lib/tags.sh 2>/dev/null && \
  KEY="$(ruflo_key_prefix)|openspec:<change-id>|issue:<new-issue-id>|type:followup-triage|ts:$(date +%s)" && \
  ruflo memory store -k "$KEY" -v "Triage: <bug|in-scope-task|follow-up>. Reason: <why this classification>. Parent issue: <current-issue-id>." 2>/dev/null || true
```

Then:
```bash
bd ready
```

**Guardrails**
- NEVER expand the scope of the currently claimed issue — file a new issue for any discovered work
- NEVER silently defer discovered work — always file a Beads issue
- NEVER skip the context tagging step — `branch:<name>`, `worktree:<name>`, `repo:<name>` labels are required on every issue so future sessions can filter cleanly
- If in doubt between Q2 and Q3, file as bug at priority=1 and let the user adjust
- If Q1 is yes, stop and use openspec-beads-scope-change — OpenSpec must be updated before filing in Beads
