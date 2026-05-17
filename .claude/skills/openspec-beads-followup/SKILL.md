---
name: openspec-beads-followup
description: Triage discovered work into in-scope bug, in-scope task, or out-of-scope follow-up. Sets correct type, priority, and dependency linkage in Beads. Does not silently expand the claimed issue's scope.
license: MIT
compatibility: Requires bd (beads) CLI.
metadata:
  author: openspec
  version: "1.2"
  generatedBy: "1.1.1"
---

Triage work discovered during implementation without expanding the scope of the claimed issue.

**Source-of-truth rule:** OpenSpec owns agreed scope. Do not expand a claimed Beads issue to cover discovered work. File a new issue instead.

**Input**: A description of the discovered work and the current claimed issue ID.

**Setup**

```bash
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
obws_init followup || return 1
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/dup.sh"
```

**Decision tree**

**Q1: Does this change public API shape, user-visible behavior, acceptance criteria, or data model?**
- Yes → Use **openspec-beads-scope-change** instead. Do not file a Beads issue until OpenSpec is updated.
- No → Q2.

**Q2: Is this a defect in behavior the OpenSpec change already specifies?**
- Yes → In-scope bug (priority=1).
- No → Q3.

**Q3: Is this work required for the current OpenSpec change to ship correctly?**

Required = blocks an unchecked task in `tasks.md` AND is named in at least one acceptance criterion. Both must hold → in-scope task. Otherwise → out-of-scope follow-up.

If in doubt between Q2 and Q3, file as bug at priority=1 and let the user adjust.

---

**In-scope bug or task**

| | Bug (Q2) | Task (Q3) |
|---|---|---|
| `--type` | `bug` | `task` |
| `--priority` | `1` | `2` |
| Description template | "Bug found while implementing ... Existing scope already requires ... Add regression test coverage." | "Discovered while implementing ... Required for this change to satisfy acceptance criteria. ..." |
| Dep linkage | `bd dep add <new-id> <current-issue-id> --type=discovered-from`; if current cannot close without this fix: `bd dep add <current-issue-id> <new-id>` | `bd dep add <new-id> <current-issue-id> --type=discovered-from`; downstream work: `bd dep add <downstream-id> <new-id>` |

Check for near-duplicates first:
```bash
obws_find_dups "<proposed title>"
# Set OBWS_DUP_METHOD=ai for semantic comparison (requires ANTHROPIC_API_KEY; costs tokens)
```

```bash
_acceptance="<acceptance criterion from the OpenSpec scenario>"
bd create \
  --title="<title>" \
  --description="<description per table above>" \
  --type=<bug|task> \
  --priority=<1|2> \
  --acceptance="$_acceptance" \
  --spec-id="openspec/changes/<change-id>/proposal.md" \
  --labels "openspec:<change-id>,$OBWS_BRANCH_LABEL,$OBWS_WORKTREE_LABEL,$OBWS_REPO_LABEL" \
  --validate \
  --json
# Record the returned ID as <new-id>
```

Apply dep linkage from table above, then confirm labels (safety net):
```bash
obws_tag_context <new-id>
obws_tag_change  <new-id> <change-id>
```

---

**Out-of-scope follow-up**

```bash
bd create \
  --title="<follow-up description>" \
  --description="Follow-up idea discovered during openspec/changes/<change-id>. Not required for the current change. Consider after it ships. <Context and motivation>." \
  --type=task \
  --priority=4 \
  --labels "$OBWS_BRANCH_LABEL,$OBWS_WORKTREE_LABEL,$OBWS_REPO_LABEL" \
  --json
# Record the returned ID as <new-followup-id>
# No openspec:<change-id> label — follow-ups must not appear in openspec-beads-complete's clean-state check.
```

Preserve lineage:
```bash
bd dep add <new-followup-id> <current-issue-id> --type=discovered-from
```

Confirm context labels (# safety net: explicit tag in case --labels was empty). Do NOT call `obws_tag_change` here:
```bash
obws_tag_context <new-followup-id>
```

---

**Worker-filed findings**

Background workers (`security-audit`, `test-gap-detector`) auto-file `bd` issues tagged `ruflo:<worker-tag>`. These arrive without a parent issue and must be triaged to the right epic.

```bash
# Find open worker findings
bd list --status open --json | jq '.[] | select(.labels[]? | startswith("ruflo:")) | {id, title, labels}'
```

Apply the Q1→Q3 decision tree as normal. After creating or identifying the right issue, link the worker finding:
```bash
bd link <worker-issue-id> <epic-id> --type=related
```
Close the worker-filed issue after the follow-up is created (it's now tracked in Beads properly):
```bash
bd close <worker-issue-id> --reason="Triaged to <new-id>"
```

---

**After creating the issue**

Verify labels on the new issue:
```bash
bd show <new-issue-id> --json | jq '.[].labels'
```
Array must contain all three context labels. Bugs and in-scope tasks also carry `openspec:<change-id>`. Follow-ups do not.

Write triage rationale to memory:
```bash
obws_mem_write "<change-id>" "<new-issue-id>" "followup-triage" "<bug|in-scope-task|follow-up>" \
  "Triage: <bug|in-scope-task|follow-up>. Reason: <why this classification>. Parent issue: <current-issue-id>."
```

Report issue type, new ID and priority, and whether it blocks the current issue. Then:
```bash
bd ready
```

**Non-obvious traps**
- Q1 = scope change → stop and use openspec-beads-scope-change; OpenSpec must be updated before Beads
- `OBWS_DUP_METHOD=ai` costs tokens per call — only set when near-title collisions are frequent
- Follow-ups deliberately omit `openspec:<change-id>` so they don't appear in the completion check
