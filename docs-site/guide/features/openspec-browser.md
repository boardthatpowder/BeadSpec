# OpenSpec Browser

The OpenSpec Browser lets you read and navigate OpenSpec change proposals and their linked Beads issues directly inside BeadSpec — without leaving the app or opening files manually.

## What is OpenSpec?

OpenSpec is a structured specification workflow used in BeadSpec's own development. Each feature change has:
- A **proposal** (`proposal.md`) — the problem and context
- A **spec** (`spec.md`) — agreed behavior and acceptance criteria  
- A **design** (`design.md`) — technical decisions
- A **tasks** (`tasks.md`) — implementation checklist linked to Beads issues

The `openspec/` directory is committed to the repo alongside the source code, so specs and implementation stay in sync.

## Opening the browser

Click the **Changes** tab in the main navigation.

## Navigating changes

The left panel lists all OpenSpec changes (in-flight and archived). Click a change to open its artifacts on the right.

The right panel shows:
- **Status** — which artifacts exist and whether the change is in-flight or archived
- **Proposal** — rendered Markdown of the proposal document
- **Spec** — rendered Markdown of the spec
- **Tasks** — checklist with real-time completion status (linked to Beads issues)

## Task completion status

Each task in `tasks.md` that is linked to a Beads issue (via `beads:<id>` reference) shows live status pulled from the database. You can see at a glance how much of a change is implemented.

## Who this is for

The OpenSpec Browser is primarily useful for contributors and maintainers working on BeadSpec itself. End users who are using BeadSpec to manage their own projects will not typically have OpenSpec changes in their repos.
