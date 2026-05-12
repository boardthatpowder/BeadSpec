# Optional Integrations

BeadSpec works out of the box with just `bd`. Two optional integrations add extra capabilities when their CLI tools are installed: **OpenSpec** and **Ruflo**.

Both are off-by-default in new installations... actually both default to **on** — BeadSpec will attempt to detect them automatically. If the binary is not found, those features degrade silently without affecting core functionality.

## Enabling and disabling

Open **Settings → Features** to toggle each integration independently:

- **OpenSpec integration** — shows the Changes view, OpenSpec doc tabs in the workspace, import/validate controls, and task progress panels.
- **Ruflo integration** — shows the Ruflo memory panel and Ruflo filter chips in the task list.

Toggling either setting takes effect immediately. No restart needed.

## Binary paths

If BeadSpec cannot find a binary automatically (i.e. it is not on your `PATH`), enter the full path in **Settings → Binary Paths**:

| Field | Default |
|---|---|
| `bd` | auto-detect from `PATH` |
| `openspec` | auto-detect from `PATH` |
| `ruflo` | auto-detect from `PATH` |
| `dolt` | auto-detect from `PATH` — **changing this requires an app restart** |

Leave a field blank to use auto-detection.

## OpenSpec

OpenSpec is a structured specification workflow. When enabled, BeadSpec adds:

- **Changes view** (in the top navigation) — browse in-flight and archived change proposals from your project's `openspec/changes/` directory
- **OpenSpec doc tabs** — open proposal, spec, design, and tasks artifacts as read-only tabs in the workspace
- **Task progress panel** — see live completion status for tasks linked to Beads issues
- **Import to Beads** — create Beads issues from a change's `tasks.md` in one click
- **Validate** — run `openspec validate` on a change from inside the app

If the `openspec` binary is not found, these surfaces are hidden and the rest of the app continues normally.

To install OpenSpec, see the [OpenSpec project](https://github.com/gastownhall/openspec).

## Ruflo

Ruflo is a cross-session memory and agent-tooling CLI. When enabled, BeadSpec adds:

- **Ruflo memory panel** — search and review memories stored by `ruflo` in the current project
- **Ruflo filter chips** — filter tasks by Ruflo-tagged labels

If the `ruflo` binary is not found, the panel hides silently. No error is shown — Ruflo is entirely optional.

To install Ruflo, see the [Ruflo project](https://github.com/gastownhall/ruflo).

## Feature degradation summary

| Scenario | Behavior |
|---|---|
| `openspec` not installed, feature **on** | Changes view hidden; app otherwise unaffected |
| `openspec` not installed, feature **off** | Same — no Changes view |
| `ruflo` not installed, feature **on** | Memory panel hidden; app otherwise unaffected |
| `ruflo` not installed, feature **off** | Same — no memory panel |
| `bd` not installed | Setup dialog appears — `bd` is required for all writes |
| `dolt` not installed | Dolt server cannot start — recovery dialog appears |
