---
name: ruflo-swarm-dispatch
description: Use when deciding between built-in Agent parallelism and ruflo-swarm for multi-agent tasks. Default is always the built-in Agent tool. Ruflo swarm is the escalation path for consensus-required or state-sharing tasks only.
license: MIT
metadata:
  author: prism
  version: "1.0"
---

Decide the right parallelism strategy and dispatch multi-agent work.

## Default: built-in Agent tool (use 90% of the time)

Most agent runtimes provide built-in parallel agent or tool calls for independent subtasks. This handles:
- Research and exploration across multiple areas
- Reading multiple files or codebases simultaneously
- Running independent tests or checks
- Any task where subtasks share no state and need no consensus

No shared memory, no coordination overhead, no Ruflo required.

## Escalate to `ruflo-swarm` when ALL of the following are true:

1. **Consensus needed** — subtasks must agree on an approach before proceeding (e.g., three agents reviewing the same refactor must reach one answer)
2. **Shared intermediate state** — one agent's output must inform another agent's work *within the same dispatch*
3. **Overlapping artifact risk** — independent agents would modify the same file and create conflicting edits

If any condition is absent, fall back to the built-in Agent tool.

**Do NOT use ruflo-swarm for:**
- Pure exploration or research (built-in Agent is faster and cheaper)
- Independent test runs (use `Bash` background jobs)
- Tasks where a single agent suffices

## ruflo-swarm dispatch command

```bash
source ~/.claude/ruflo/lib/tags.sh
ruflo swarm dispatch \
  --topology mesh \
  --tags "$(ruflo_key_prefix)|openspec:<change-id>" \
  "<task description>"
```

Use `--topology hierarchical` when one coordinator agent should direct workers (e.g., a planner + two implementers). Use `--topology mesh` for peer agents that must reach consensus.

## After dispatch

The swarm result is written to AgentDB automatically. To retrieve:
```bash
ruflo memory search -q "<task description> swarm result"
```
