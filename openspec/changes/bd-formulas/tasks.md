## 1. Shared Issue Chip Utility

- [ ] 1.1 Extract the `BUI-[a-z0-9]+` chip rendering logic from `BdHealthPanel.tsx` into `src/components/shared/issueChips.tsx` exporting a `renderWithChips(text: string, onNavigate: (id: string) => void): React.ReactNode` utility
- [ ] 1.2 Update `BdHealthPanel.tsx` to import from the shared utility instead of its own inline implementation
- [ ] 1.3 Verify `bun run typecheck` passes after the extraction refactor

## 2. Formula List Parsing

- [ ] 2.1 Define a TypeScript interface `Formula { name: string; description: string }` in `src/components/bd-formulas/types.ts`
- [ ] 2.2 Implement `parseFormulaList(output: string): Formula[]` that parses the JSON array from `bd formula list --json`; returns an empty array on parse error and sets a parse-error flag
- [ ] 2.3 Write unit tests for `parseFormulaList` covering: valid array, empty array, malformed JSON, JSON with missing fields

## 3. FormulasBrowser Component

- [ ] 3.1 Create `src/components/bd-formulas/FormulasBrowser.tsx` with state for: formula list, loading flag, error flag, pouring flag, and pour output per formula
- [ ] 3.2 Implement formula list fetch on mount: call `runBdCommand(["formula", "list", "--json"])`, parse result with `parseFormulaList`, handle empty and error states
- [ ] 3.3 Render formula cards: one card per formula showing name, description, and a "Pour" button (disabled when `isPouring`)
- [ ] 3.4 Implement "No formulas available" empty state
- [ ] 3.5 Implement "Formula list unavailable" error state showing raw command output
- [ ] 3.6 Implement "bd not found" empty state (reuse pattern from BdHealthPanel)

## 4. Pour Confirmation Dialog

- [ ] 4.1 Create `src/components/bd-formulas/PourConfirmDialog.tsx` accepting `formulaName`, `onConfirm`, and `onCancel` props; renders modal with formula name, irreversibility warning, and "Pour" / "Cancel" actions
- [ ] 4.2 Wire "Pour" button in FormulasBrowser to open `PourConfirmDialog` with the selected formula name
- [ ] 4.3 Implement pour execution on confirm: call `runBdCommand(["mol", "pour", name])`, set `isPouring` flag, disable all Pour buttons during execution
- [ ] 4.4 Display pour output in a scrollable output panel after completion using `renderWithChips` from the shared utility
- [ ] 4.5 Show error indicator on non-zero exit code while still displaying output

## 5. Health/Tools Area Integration

- [ ] 5.1 Add a "Formulas" tab or section within the Health/Tools area in `src/components/layout/index.tsx` so FormulasBrowser is reachable from the same area as BdHealthPanel
- [ ] 5.2 Verify the Formulas entry is reachable in ≤ 2 clicks from any view

## 6. Manual Testing

- [ ] 6.1 Run Formulas browser on a project with available formulas: verify cards render with correct name and description
- [ ] 6.2 Click "Pour" on a formula in a safe test project: verify confirmation dialog appears, shows correct name and warning, and pour executes on confirm
- [ ] 6.3 Verify issue ID chips in pour output are clickable and navigate to the correct task detail
- [ ] 6.4 Verify all Pour buttons are disabled during an active pour and re-enabled after completion
- [ ] 6.5 Verify cancel button closes dialog without executing pour

## 7. Validate and Close

- [ ] 7.1 Run `openspec validate bd-formulas` and resolve any reported issues
- [ ] 7.2 Run `bun run build` (or `cargo tauri build`) to confirm no build regressions
- [ ] 7.3 Close BEADSPEC-5vli with `bd close BEADSPEC-5vli`
