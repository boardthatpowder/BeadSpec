## MODIFIED Requirements

### Requirement: Task detail panel tabs respect feature flags
The task detail panel SHALL conditionally render the OpenSpec panel section and the Ruflo memory panel section based on the corresponding feature flags. When a feature is disabled, its panel SHALL be entirely absent — not rendered, not hidden with CSS, and no Tauri IPC calls made for it. The tab bar SHALL use `<Tabs>` from `src/components/ui/Tabs.tsx`.

#### Scenario: OpenSpec panel absent when OpenSpec disabled
- **WHEN** OpenSpec is disabled in Settings
- **THEN** the OpenSpec panel section does not appear in the task detail panel

#### Scenario: OpenSpec panel present when OpenSpec enabled
- **WHEN** OpenSpec is enabled in Settings and the task has an `openspec:*` label
- **THEN** the OpenSpec panel section appears in the task detail panel in its normal position

#### Scenario: Tab bar uses arrow-key navigation
- **WHEN** a tab trigger in the task detail panel has focus
- **THEN** ArrowLeft/ArrowRight moves focus to adjacent tabs (Radix Tabs behavior)

### Requirement: Task picker modal uses Dialog primitive
The task picker modal (for selecting blockers/dependencies) SHALL use `<Dialog>` from `src/components/ui/Dialog.tsx`, providing focus trapping, Esc-to-close, and backdrop-click-to-close.

#### Scenario: Esc closes task picker
- **WHEN** the task picker modal is open and the user presses Escape
- **THEN** the modal closes and focus returns to the trigger

#### Scenario: Focus trapped inside task picker
- **WHEN** the task picker modal is open
- **THEN** Tab key cycles only among elements inside the modal

### Requirement: Blocker confirm dialog uses Dialog primitive
The blocker confirmation dialog SHALL use `<Dialog>` from `src/components/ui/Dialog.tsx`.

#### Scenario: Esc closes blocker confirm dialog
- **WHEN** the blocker confirmation dialog is open and the user presses Escape
- **THEN** the dialog closes without confirming the action
