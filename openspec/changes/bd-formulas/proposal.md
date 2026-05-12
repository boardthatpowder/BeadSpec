## Why

Beads formulas are pre-configured project templates accessible via `bd formula list` and applied via `bd mol pour <name>`, but they are only discoverable and usable from the terminal. Users working in the Beads UI have no way to browse available formulas or apply them without switching contexts.

## What Changes

- **New React component** `FormulasBrowser.tsx` that fetches the formula list via `bd formula list --json`, renders one card per formula (name + description), and provides a "Pour" button per card.
- **Pour flow**: Clicking "Pour" opens a mandatory confirmation dialog (pour is irreversible); confirming runs `bd mol pour <name>` via the existing `run_bd_command` IPC command (reused from bd-health-panel) and streams the captured output into an output panel.
- **Issue ID chips**: any `BUI-[a-z0-9]+` token in pour output renders as a clickable chip navigating to task detail — same logic reused from bd-health-panel.
- **Integration**: FormulasBrowser is accessible from the Health/Tools area alongside the health panel.
- **Reuse**: `run_bd_command` Tauri command introduced in bd-health-panel; no new Rust code required.

## Capabilities

### New Capabilities

- `bd-formulas`: Formulas browser that lists available bd formulas as cards and allows pouring a selected formula with a mandatory confirmation dialog and captured output display.

### Modified Capabilities

_(none — `run_bd_command` is reused as-is; layout-shell already gains a Health/Tools area from bd-health-panel)_

## Impact

- **No new Rust files**: reuses `run_bd_command` from `src-tauri/src/commands/external.rs` (introduced by bd-health-panel).
- **New file**: `src/components/bd-formulas/FormulasBrowser.tsx`.
- **New file**: `src/components/bd-formulas/PourConfirmDialog.tsx`.
- **New shared utility**: `src/components/bd-health/issueChips.tsx` (or equivalent) — issue chip rendering extracted from BdHealthPanel for reuse by FormulasBrowser.
- **Modified file**: `src/components/layout/index.tsx` or the Health/Tools area — add Formulas entry.
- **No new npm dependencies** required; no breaking changes to existing IPC contract.
- **Dependency**: bd-health-panel change must be implemented first (provides `run_bd_command`).
