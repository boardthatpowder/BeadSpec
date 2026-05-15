---
name: openspec-beads-followup
description: Triage discovered work into in-scope bug, in-scope task, or out-of-scope follow-up. Sets correct type, priority, and dependency linkage in Beads. Does not silently expand the claimed issue's scope.
license: MIT
compatibility: Requires bd (beads) CLI.
metadata:
  author: openspec
  version: "1.1"
  generatedBy: "1.1.1"
---

Triage work discovered during implementation without expanding the scope of the claimed issue.

**Source-of-truth rule:** OpenSpec owns agreed scope. Do not expand a claimed Beads issue to cover discovered work. File a new issue instead.

**Input**: A description of the discovered work and the current claimed issue ID.

**Setup** — source the helper library:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
. "${REPO_ROOT}/scripts/openspec-beads/context.sh"
. "${REPO_ROOT}/scripts/openspec-beads/memory.sh"
obws_resolve_prefix
```

**Decision tree**

Answer these questions in order:

**Q1: Does this change public API shape, user-visible behavior, acceptance criteria, or data model?**
- Yes → This is a scope change. Stop here. Use the **openspec-beads-scope-change** skill instead. Do not file a Beads issue until OpenSpec is updated.
- No → Continue to Q2.

**Q2: Is this a defect in behavior the OpenSpec change already specifies?**
- Yes → In-scope bug. See below.
- No → Continue to Q3.

**Q3: Is this work required for the current OpenSpec change to ship correctly?**

"Required" means: it blocks any unchecked task in `tasks.md` AND is named in at least one
acceptance criterion of the change's spec artifacts. If both conditions hold → in-scope task.
Otherwise → out-of-scope follow-up.

If in doubt between Q2 and Q3, file as bug at priority=1 and let the user adjust.

---

**In-scope bug**

```bash
bd create \
  --title="<concise bug description>" \
  --description="Bug found while implementing openspec/changes/<change-id>. Existing scope already requires <correct behavior>. <Steps to reproduce or evidence>. Add regression test coverage." \
  --type=bug \
  --priority=1 \
  --json
# Record the returned ID as <new-bug-id>
```

Always preserve lineage to the issue that surfaced this bug:
```bash
bd link <new-bug-id> <current-issue-id> --type=discovered-from
```

If the current issue cannot be closed without this fix, also link it as a blocker:
```bash
bd dep add <current-issue-id> <new-bug-id>
```

Tag with context labels and the `openspec:<change-id>` label (in-scope items gate completion):
```bash
obws_tag_context <new-bug-id>
obws_tag_change  <new-bug-id> <change-id>
```

---

**In-scope task**

```bash
bd create \
  --title="<task description>" \
  --description="Discovered while implementing openspec/changes/<change-id>. Required for this change to satisfy acceptance criteria. <Context and expected behavior>." \
  --type=task \
  --priority=2 \
  --json
# Record the returned ID as <new-task-id>
```

Always preserve lineage to the issue that surfaced this task:
```bash
bd link <new-task-id> <current-issue-id> --type=discovered-from
```

Link downstream work that depends on it:
```bash
bd dep add <downstream-issue-id> <new-task-id>
```

Tag with context labels and the `openspec:<change-id>` label:
```bash
obws_tag_context <new-task-id>
obws_tag_change  <new-task-id> <change-id>
```

---

**Out-of-scope follow-up**

```bash
bd create \
  --title="<follow-up description>" \
  --description="Follow-up idea discovered during openspec/changes/<change-id>. Not required for the current change. Consider after it ships. <Context and motivation>." \
  --type=task \
  --priority=4 \
  --json
# Record the returned ID as <new-followup-id>
```

Always preserve lineage so the follow-up's origin remains queryable:
```bash
bd link <new-followup-id> <current-issue-id> --type=discovered-from
```

No `blocks` dependency is needed — by definition this does not gate the current change.

Tag with context labels only. Do **not** apply the `openspec:<change-id>` label — pure follow-ups
are tracked outside the change's scope and must not appear in **openspec-beads-complete**'s
clean-state check:
```bash
obws_tag_context <new-followup-id>
# Do NOT call obws_tag_change here
```

---

**After creating the issue**

Verify with `bd show <new-issue-id>` — the LABELS line must show all three context labels,
plus `openspec:<change-id>` for bugs and in-scope tasks (not for follow-ups).

Write triage rationale to memory (if ruflo is installed):
```bash
obws_mem_write "<change-id>" "<new-issue-id>" "followup-triage" "<bug|in-scope-task|follow-up>" \
  "Triage: <bug|in-scope-task|follow-up>. Reason: <why this classification>. Parent issue: <current-issue-id>."
```

Report:
- Issue type (bug / in-scope task / follow-up)
- New Beads issue ID and priority
- Whether it blocks the current issue or not

Then:
```bash
bd ready
```

**Guardrails**
- NEVER expand the scope of the currently claimed issue — file a new issue for any discovered work
- NEVER silently defer discovered work — always file a Beads issue
- ALWAYS link the new issue to the current one with `bd link --type=discovered-from` for lineage, regardless of triage outcome
- In-scope bugs and tasks get the `openspec:<change-id>` label via `obws_tag_change`; pure follow-ups do NOT (so they are excluded from completion checks)
- NEVER skip the context tagging step — `obws_tag_context` applies `branch:<name>`, `worktree:<name>`, `repo:<name>` in one call
- If Q1 is yes, stop and use openspec-beads-scope-change — OpenSpec must be updated before filing in Beads
