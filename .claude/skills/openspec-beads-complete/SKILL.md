---
name: openspec-beads-complete
description: Change-wide completion workflow. Verify no open or in-progress required Beads issues, run openspec validate and quality gates, close the epic, invoke openspec-archive-change, then follow the session-close protocol. Use when all implementation issues for an OpenSpec change are done.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.1.1"
---

Complete and archive an OpenSpec change after all implementation is done.

**Source-of-truth rule:** OpenSpec owns the spec. Archive only after Beads shows no remaining required work and OpenSpec validates.

**Input**: An OpenSpec change ID. If omitted, infer from conversation context or run `openspec list` and ask.

**Steps**

1. **Confirm Beads state is clean**

   ```bash
   bd list --status=open
   bd list --status=in_progress
   bd blocked
   ```

   There must be no open or in-progress issues required for this OpenSpec change.

   If any remain:
   - Deferred or out-of-scope follow-up issues (priority=4) do **not** block completion
   - If any required implementation issue is still open, stop and ask the user whether to complete it or explicitly defer it before proceeding

2. **Confirm tasks.md is fully checked**

   Read `openspec/changes/<change-id>/tasks.md` and verify every task has `- [x]` (not `- [ ]`).

   If any unchecked tasks remain:
   - Check whether the work is actually done in code (via `openspec-verify-change`)
   - If done: update the checkboxes now before continuing
   - If not done: stop and surface the gap to the user

   This ensures `openspec validate`, `/opsx:verify`, and future sessions see accurate completeness data.

3. **Confirm OpenSpec state**

   ```bash
   openspec validate <change-id>
   openspec status --change "<change-id>"
   ```

   Validation must pass. If it fails, stop and surface the specific errors to the user.

4. **Run quality gates**

   For code changes:
   ```bash
   <project unit test command>
   ```

   If no unit test command exists yet, run the narrowest available validation and state why no tests apply.

   For docs-only changes:
   ```bash
   git diff --check
   ```

   Run any additional focused tests required by the implementation issues. Do not run integration tests without explicit user approval in this thread.

5. **Close the epic**

   Find the parent epic for this change (look for issues with `openspec/changes/<change-id>` in their description).

   ```bash
   bd close <epic-id> --reason="All required Beads implementation issues closed; openspec validates; unit tests pass."
   ```

6. **Write change retrospective to memory** (run only if ruflo is installed)

   ```bash
   source ~/.claude/ruflo/lib/tags.sh 2>/dev/null && \
     KEY="$(ruflo_key_prefix)|openspec:<change-id>|type:retrospective|outcome:archived|ts:$(date +%s)" && \
     ruflo memory store -k "$KEY" -v "Change <change-id> archived. Summary: <what shipped>. What worked: <observations>. Surprises: <unexpected complexity or gaps>." 2>/dev/null || true
   ```

7. **Archive the OpenSpec change**

   Use the built-in **openspec-archive-change** skill:
   > Invoke: `openspec-archive-change` with the change-id

   If this workspace uses a review gate before archiving:
   > Invoke: `openspec-verify-change` first, then `openspec-archive-change`

   Treat these as black boxes — invoke them, don't reproduce their steps.

8. **Session close**

   Follow the `bd prime` session-close protocol:
   ```bash
   git status
   bd dolt pull
   git add <changed files>
   git commit -m "<summary of what shipped>"
   bd dolt push
   git push
   git status  # must show "up to date with origin"
   ```

   If `bd dolt pull` reports no remote, record that in handoff notes rather than pretending sync succeeded.

**Guardrails**
- Do NOT archive until `openspec validate` passes (step 2)
- Do NOT close the epic until all required implementation issues are closed (step 1)
- Do NOT run integration tests without explicit user approval
- Work is NOT complete until `git push` succeeds — never stop before pushing
- If push fails, resolve and retry
