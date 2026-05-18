## ADDED Requirements

### Requirement: Impact tab presence and visibility

The `TaskDetailPanel` SHALL render an `Impact` tab as the fourth tab, after `Activity`. The tab content SHALL be a dedicated `ImpactPanel` component owning symbol resolution, IPC invocation, and result rendering. The tab SHALL be present for every task regardless of labels, status, or whether a GitNexus index exists.

#### Scenario: Impact tab visible for every task

- **WHEN** any task is opened in `TaskDetailPanel`
- **THEN** the `Impact` tab SHALL appear in the tab row at position four
- **AND** clicking it SHALL render the `ImpactPanel`

#### Scenario: Impact tab shows empty state before any symbol is selected

- **WHEN** the user opens the `Impact` tab and has not yet selected a symbol
- **THEN** the panel SHALL render the candidate-chip list (which may be empty), a manual symbol input, and the hint "Pick a symbol from the issue diff, or type one below"
- **AND** no IPC call SHALL be made

---

### Requirement: Symbol candidate auto-detection from issue diff

The panel SHALL extract candidate symbol names from the issue's diff string (`GitRefs.diff` returned by `getGitRefsForIssue`) and render them as clickable chips, sorted by descending occurrence count, capped at 10. Detection SHALL cover TypeScript/JavaScript, Rust, and Python function/method/class/struct declarations on added or removed lines.

#### Scenario: Issue diff contains a TypeScript function declaration

- **GIVEN** the active issue's branch diff contains `+ function runImpact(symbol: string)` on an added line
- **WHEN** the user opens the `Impact` tab
- **THEN** a chip labelled `runImpact` SHALL appear in the candidate list

#### Scenario: Issue has no associated branch or commits

- **WHEN** the active issue has no associated branch or commits and `GitRefs.diff` is empty or absent
- **THEN** the candidate-chip list SHALL be empty
- **AND** the manual symbol input SHALL remain visible and focusable

#### Scenario: Candidate list is capped at 10 symbols

- **GIVEN** the diff contains 25 distinct symbol declarations
- **WHEN** the user opens the `Impact` tab
- **THEN** at most 10 chips SHALL be rendered, selected by descending occurrence frequency

#### Scenario: Non-declaration lines produce no candidates

- **GIVEN** the diff consists entirely of import statements and string literals
- **WHEN** the user opens the `Impact` tab
- **THEN** the candidate list SHALL be empty (no false-positive chips)

---

### Requirement: Impact analysis IPC contract

A new Tauri command `run_gitnexus_impact(project_path, symbol)` SHALL shell out to `npx gitnexus impact --target <symbol> --json` from `project_path` with a 15-second timeout and return a `GitnexusImpactReport` containing: `symbol` (string), `risk` (`Low | Medium | High | Critical | Unknown`), `upstream_by_process` (list of `{ process: string, callers: [{ name, location }] }`), `downstream` (flat `[{ name, location }]` list), `affected_processes` (list of process slugs), and `index_status` (`Fresh | Stale | Unknown`). On any error the command SHALL return a descriptive error string classifiable as `MissingCli | NoIndex | SymbolNotFound | Timeout | Other`.

#### Scenario: Successful impact call returns full report

- **GIVEN** `npx gitnexus` is on PATH and the project has a fresh index
- **WHEN** the user selects a symbol and the panel calls `runGitnexusImpact`
- **THEN** the returned report SHALL contain a non-empty `risk` field, at least one `upstream_by_process` entry or an empty list, and an `index_status` of `Fresh`

#### Scenario: GitNexus CLI is not installed

- **WHEN** `npx gitnexus` cannot be resolved on the shell PATH
- **THEN** the IPC SHALL return a `MissingCli` error string
- **AND** the panel SHALL render an inline callout "GitNexus CLI not found. Run `npm i -g gitnexus` or `npx gitnexus analyze`."

#### Scenario: GitNexus has no index for the project

- **WHEN** `npx gitnexus impact` exits non-zero with a known "no index" message
- **THEN** the IPC SHALL return a `NoIndex` error string
- **AND** the panel SHALL render an inline callout "GitNexus has no index for this project. Run `npx gitnexus analyze` first."

#### Scenario: Symbol not found in the index

- **WHEN** `npx gitnexus impact` exits with a "symbol not found" message
- **THEN** the IPC SHALL return a `SymbolNotFound` error string
- **AND** the panel SHALL render "GitNexus didn't find `<symbol>` in the index. Try a fully-qualified name or re-run analyze."

#### Scenario: Command times out

- **WHEN** `npx gitnexus impact` does not return within 15 seconds
- **THEN** the IPC SHALL return a `Timeout` error string
- **AND** the panel SHALL render "GitNexus impact timed out after 15s. Try a smaller symbol or re-run."

---

### Requirement: Risk badge rendering

The panel SHALL render the report's `risk` field as a coloured chip using the project's existing `LABEL_CHIP_COLORS` palette from `src/components/task-list/TaskListItem.tsx`. Mapping: `Low → slate/neutral`, `Medium → amber`, `High → orange`, `Critical → red` (same palette as `priority:critical`), `Unknown → muted grey with a dash placeholder`.

#### Scenario: Critical risk displays red chip

- **WHEN** the report's `risk` is `Critical`
- **THEN** the risk badge SHALL render with the same red colour used by `priority:critical` chips elsewhere in the app
- **AND** the chip label SHALL read `CRITICAL`

#### Scenario: Unknown risk shows muted placeholder

- **WHEN** the report's `risk` is `Unknown`
- **THEN** the risk badge SHALL render `—` on a muted grey background

---

### Requirement: Stale-index callout is non-blocking

When the report's `index_status` is `Stale`, the panel SHALL render a yellow informational callout above the result body. The result body SHALL remain fully visible and unmodified.

#### Scenario: Stale index is detected at call time

- **GIVEN** the most recent `.claude/cache/gitnexus-*-ack` file mtime is older than the project `HEAD` commit time
- **WHEN** the panel renders an impact result
- **THEN** a yellow callout "Index may be stale — re-run `npx gitnexus analyze`" SHALL appear above the result
- **AND** the full result body (risk badge, callers, callees) SHALL still be visible

#### Scenario: Fresh index shows no stale callout

- **GIVEN** the most recent ack file mtime is newer than the project `HEAD` commit time
- **WHEN** the panel renders an impact result
- **THEN** no stale-index callout SHALL be shown

---

### Requirement: Results are not cached across panel mounts

The panel SHALL NOT retain `runGitnexusImpact` results across mount cycles. Each time the `Impact` tab is entered, the panel SHALL re-render from the initial empty state. A `Refresh` button SHALL re-fire the most recently submitted symbol without re-typing.

#### Scenario: Result is cleared on tab re-mount

- **GIVEN** the user ran impact for symbol `runImpact` and a report was displayed
- **WHEN** the user switches to another workspace tab and switches back to the same task detail
- **THEN** the `Impact` tab SHALL show the empty state
- **AND** no result from the previous mount SHALL be visible

#### Scenario: Refresh re-runs the most recent symbol

- **GIVEN** the user has previously run impact for symbol `runImpact`
- **WHEN** the user clicks the `Refresh` button (symbol is still displayed in the input)
- **THEN** the panel SHALL re-invoke `runGitnexusImpact(project, "runImpact")`
- **AND** the report SHALL be replaced with the new result on success

#### Scenario: Refresh is disabled before any symbol has been run

- **WHEN** the user opens the `Impact` tab but has not yet submitted any symbol
- **THEN** the `Refresh` button SHALL be disabled (not clickable)
