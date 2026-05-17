# OpenSpec Task Completion Gate

A task in `tasks.md` is marked `[x]` only when **all applicable criteria below are satisfied**. This gate exists to prevent silent under-delivery — the common failure mode where a task is closed with checkboxes ticked but the implementation is incomplete because integration wiring was skipped.

## The Anti-Pattern This Gate Prevents

Tasks get marked done when the core logic is written, but the integration wiring is missing:
- A new component is built but never registered in the DI container or service registry
- A new module is written but never exported from the barrel file
- A new handler is implemented but never wired into the dispatch table
- A new test exists but uses a stub that doesn't verify the actual contract

Each of these passes unit tests in isolation and looks complete but fails in production.

---

## Criterion 1 — Integration wiring (applies when the task introduces a new component)

For every new component (service, handler, module, plugin, route, etc.) the task introduces, verify the component is:

1. **Registered** — added to the service registry, DI container, plugin manifest, or equivalent bootstrapping mechanism.
2. **Exported** — added to any barrel `index` file used by consumers of this module.
3. **Dispatched** — added to any dispatch table, router, or executor that invokes it at runtime.

If any wire-up is missing, mark criterion 1 failed. The feature cannot be invoked in production.

> **Customize:** replace this section with the actual file paths in your project. For example:
> - "Registered in `src/container.ts`"
> - "Exported from `src/handlers/index.ts`"
> - "Dispatched in `src/router.ts`"

---

## Criterion 2 — Contract test (applies when the task introduces an integration point)

The integration behavior must be exercised by a test that uses the **real integration harness** — not a stub that only validates internal logic.

The test MUST:
- Call the component through the same entry point that production uses.
- Assert at least one side effect or observable output that would only occur if the full integration path ran (not just the component in isolation).

A test that replaces the downstream with a plain stub without verifying the integration contract does NOT satisfy this criterion.

> **Customize:** replace this section with your project's testing pattern. For example:
> - "Uses `createIntegrationTestContainer(...)` rather than per-test stubs"
> - "Asserts at least one database write was recorded by the recording adapter"

---

## Criterion 3 — Smoke test (applies when the task introduces new dependency injection)

If the task wires a new dependency into a runtime container (DI container, IoC container, module system), verify:

1. The dependency key exists in the container configuration.
2. The container resolves the dependency to a non-null/non-undefined value at startup.
3. The wiring is exercised by the smoke test — a handler that works in tests because the test injects the dep manually but fails in production because the container never wires it is a gate failure.

> **Customize:** replace with your project's DI pattern and smoke test location.

---

## Applicability

| Task type | Criterion 1 | Criterion 2 | Criterion 3 |
|-----------|-------------|-------------|-------------|
| Introduces a new component | Required | Required | Required if new dep injection |
| Modifies an existing component | N/A | Required | Required if new dep added |
| Infrastructure or docs only | N/A | N/A | N/A |

---

## Corrective Pattern

Before marking any task `[x]` that introduces a new component:

1. Search for all registration/export/dispatch points in the codebase and confirm the new component appears in each.
2. Open the contract test file and confirm the test calls the component via the real integration harness.
3. If a DI container is involved, confirm the container configuration resolves the new key to a non-null value.

If any check fails, the task is not complete. Open a follow-up Beads issue for the gap rather than silently checking the box.

---

## References

- `docs/developers/openspec-beads-runbook.md` — full workflow runbook
- `.claude/skills/openspec-beads-work/SKILL.md` — per-task execution loop (includes gate check at closure)
- `.claude/skills/openspec-beads-complete/SKILL.md` — change-wide completion gate
