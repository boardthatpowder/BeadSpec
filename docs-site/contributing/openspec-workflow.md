# OpenSpec Workflow

BeadSpec uses **OpenSpec** — a structured, artifact-based specification workflow — for all non-trivial feature changes. Understanding it helps you contribute effectively.

## What is OpenSpec?

OpenSpec is a lightweight spec-first workflow where every significant change produces a set of Markdown artifacts before any code is written. This keeps design, implementation, and tracking in sync.

Each change lives in `openspec/changes/<change-id>/` and produces:

| Artifact | Purpose |
|---|---|
| `proposal.md` | Problem statement and context |
| `spec.md` | Agreed behavior, acceptance criteria, edge cases |
| `design.md` | Technical decisions and trade-offs |
| `tasks.md` | Implementation checklist linked to Beads issues |

The canonical feature specs (not in-flight changes) live in `openspec/specs/<feature-name>/spec.md`.

## When to use OpenSpec

**Required** when your change affects:
- Tauri command signatures or IPC types
- User-visible behavior
- Data model or database schema
- Acceptance criteria for an existing spec

**Not required** for:
- Bug fixes with obvious correct behavior
- Documentation updates
- Refactors with no behavior change
- Typo fixes

If you're not sure, open a GitHub Discussion to check with the maintainer.

## External contributor workflow

If you're an external contributor without the `openspec` CLI set up, you don't need to create OpenSpec artifacts yourself. Just describe the change thoroughly in your PR:

- What user problem does it solve?
- What is the expected behavior (acceptance criteria)?
- What edge cases did you consider?

The maintainer will create the OpenSpec artifacts as needed and link them to the PR.

## Reviewing existing specs

Before implementing a feature or fix, check whether a spec exists:

```
openspec/specs/<feature>/spec.md
```

The feature directories match the areas listed in [Architecture](/contributing/architecture):
`task-list`, `dependency-graph`, `smart-views`, `velocity-burndown`, `quick-capture`, `openspec-change-browser`, `app-settings`, etc.

If the spec disagrees with current behavior, the spec is authoritative (unless the spec is wrong — in which case, raise it before implementing).
