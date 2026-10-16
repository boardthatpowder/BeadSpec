---
name: generate-detailed-git-commit-messages
description: Use when preparing a git commit and needing a detailed, accurate message that explains what changed, why it changed, and how it was verified.
---

# Generate Detailed Git Commit Messages

## Overview

Create commit messages that are specific, reviewable, and traceable to actual staged changes.
Prioritize factual summaries over generic phrasing.

## Inputs To Collect

Run these commands before drafting a message:

```bash
git status --short
git diff --staged --name-status
git diff --staged
```

If intent is unclear, also inspect recent context:

```bash
git log --oneline -n 10
```

## Output Format

Use this structure:

```text
<type>(<scope>): <imperative summary, <= 72 chars>

Why:
- <problem, requirement, or motivation>
- <secondary reason if needed>

What changed:
- <specific implementation change 1>
- <specific implementation change 2>
- <data/schema/config impact, if any>

Validation:
- <tests run, e.g., "bun run test:unit">
- <manual checks run>
```

If there is no meaningful scope, omit `(<scope>)`.
If validation was not run, say so explicitly and include why.

## Type Selection

- `feat`: user-visible capability added
- `fix`: defect corrected
- `refactor`: internal restructuring without behavior change
- `perf`: measurable performance improvement
- `test`: test-only changes
- `docs`: documentation-only changes
- `chore`: maintenance/config/tooling work

## Quality Bar

Before finalizing, verify all of the following:

- Subject line reflects staged diff, not planned future work
- Body includes rationale (`Why`) and concrete change list (`What changed`)
- Validation section is honest and specific
- No vague phrases like "update stuff", "misc fixes", or "improvements"
- Message explains impact when touching migrations, APIs, auth, or infra

## Anti-Patterns

- Writing the message before reviewing staged diff
- Repeating file names without explaining behavior impact
- Hiding risk by omitting skipped tests
- Bundling unrelated changes under one summary
