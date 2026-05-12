## Context

Beads formulas are named project scaffolds managed by the `bd` CLI. `bd formula list --json` returns a JSON array of formula objects; `bd mol pour <name>` applies the formula to the current project. The pour operation is write-destructive (it modifies project structure) and therefore requires explicit user confirmation before execution. The `run_bd_command` IPC bridge introduced by bd-health-panel is already available and sufficient for both operations.

## Goals / Non-Goals

**Goals:**
- List all available formulas as browsable cards (name + description).
- Gate every pour behind a mandatory confirmation dialog.
- Display pour command output (captured, not streamed) with issue ID chips.
- Reuse `run_bd_command` and the issue chip utility from bd-health-panel without duplication.
- Place FormulasBrowser in the Health/Tools area for proximity to related tooling.

**Non-Goals:**
- Creating, editing, or deleting formula definitions from the UI.
- Real-time output streaming (full output captured after command completes, same as health checks).
- Formula search or filtering (formula lists are expected to be short).
- Undo/rollback of a pour operation.
- Windows-specific PATH handling (inherits from bd-health-panel).

## Decisions

### Reuse run_bd_command

**Decision**: Call `run_bd_command(["formula", "list", "--json"])` and `run_bd_command(["mol", "pour", name])` using the existing IPC command.

**Rationale**: No new Rust code is needed. The generic command already handles timeout, PATH resolution, and error reporting. Keeps the Rust layer thin.

### Formula list parsing

**Decision**: Parse the JSON array returned by `bd formula list --json` into a typed `Formula[]` interface `{ name: string; description: string }` on the frontend. Treat parse errors as a "formula list unavailable" state.

**Rationale**: JSON output is stable and machine-readable. Typed parsing gives compile-time safety via TypeScript. Graceful degradation on parse failure avoids unhandled runtime errors.

**Alternative considered**: Plain text parsing of `bd formula list` — rejected because JSON is unambiguous and already supported by the CLI.

### Mandatory confirmation dialog

**Decision**: Clicking "Pour" opens a modal dialog with the formula name displayed, a plain-language warning ("This will modify your project and cannot be undone."), and explicit "Pour" / "Cancel" actions. Pour does not proceed without confirmation.

**Rationale**: Pour is an irreversible write operation. UI convention requires confirmation for destructive actions. The dialog prevents accidental pours triggered by mis-clicks.

**Alternative considered**: Inline confirmation (button becomes "Are you sure? Click again") — rejected as too easy to dismiss accidentally and inconsistent with existing dialog patterns in the app.

### Output display

**Decision**: After a successful pour confirmation, run `run_bd_command(["mol", "pour", name])` and display the full captured output in a scrollable output panel within the dialog (or replacing the card). Issue ID chips are applied using the shared utility from bd-health-panel.

**Rationale**: Output panel keeps context visible and allows the user to see what files/issues were created. Chip rendering helps users navigate directly to newly created issues.

### Issue chip utility extraction

**Decision**: Extract the `BUI-[a-z0-9]+` chip rendering logic from `BdHealthPanel.tsx` into a shared utility `src/components/shared/issueChips.tsx` so both `BdHealthPanel` and `FormulasBrowser` can import it without duplication.

**Rationale**: DRY; ensures consistent chip behavior across both features. Extraction is a small refactor covered by the existing bd-health-panel implementation task.

### Placement

**Decision**: FormulasBrowser is accessible as a tab or section within the same Health/Tools area introduced by bd-health-panel (e.g., a "Formulas" tab alongside "Health").

**Rationale**: Groups CLI-adjacent tooling together, keeping navigation additions minimal. Avoids adding a second top-level nav entry for a feature that is conceptually related to health/tooling.

## Risks / Trade-offs

- **[Risk] `bd formula list --json` format changes** → Mitigation: parse defensively; show "formula list unavailable" state with raw output on parse failure.
- **[Risk] Pour is irreversible** → Mitigation: mandatory confirmation dialog with explicit destructive-action warning; no programmatic workaround available.
- **[Risk] bd-health-panel not yet implemented** → Mitigation: bd-formulas task list declares the `run_bd_command` dependency explicitly; FormulasBrowser cannot be completed without it.
- **[Risk] Long-running pour operation** → Mitigation: 10-second timeout from `run_bd_command`; if exceeded, show timeout error in output panel.
- **[Risk] Empty formula list** → Mitigation: display an empty state ("No formulas available") rather than an error.

## Migration Plan

1. Confirm bd-health-panel is implemented (provides `run_bd_command` and the chip utility, or extract chip utility as part of this change).
2. Implement `FormulasBrowser.tsx` and `PourConfirmDialog.tsx`.
3. Wire into Health/Tools area layout.
4. Manual smoke test: list formulas on a real project, pour one in a safe test environment.
5. No database migrations, no IPC contract changes; rollback is a revert of the two new component files and the layout change.

## Open Questions

- Should the output panel appear inline within the confirmation dialog (expanding on success) or replace the card? (Default assumption: output panel replaces dialog on confirm, displayed in-place within the card or in a dedicated output area.)
- Should a failed pour (non-zero exit) still display the output, or show only an error banner? (Default: always show output for diagnosability.)
