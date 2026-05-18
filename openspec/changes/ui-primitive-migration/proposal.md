## Why

`ui-design-foundation` landed nine shared primitives (`Button`, `Dialog`, `Card`, `Badge`, `EmptyState`, `ErrorState`, `Tabs`, `Popover`, `Icon`) but no existing component was migrated. The app still ships five button styles, eight parallel modal overlays, ~80 inline SVGs, three duplicate tab implementations, and four hand-rolled popovers. This change does the mechanical migration: every existing component adopts the primitives, retiring the duplicated boilerplate and giving every modal proper focus-trapping and keyboard accessibility as a side-effect.

## What Changes

- **Dialogs** — replace all `fixed inset-0 z-50 bg-black/*` overlay implementations with `<Dialog>` from `src/components/ui/Dialog.tsx` (Radix-backed, focus-trapped, Esc-dismissable, aria-modal). Affected: `CommandPalette`, `SettingsDialog`, `ShortcutModal`, `RecoveryDialog`, `TaskPickerModal`, `MemoryBrowser` (drawer + store dialog), `ImportModal`, `PourConfirmDialog`, `BlockerConfirmDialog`, `SessionsTab` (snapshot drawer).
- **Buttons** — replace all ad-hoc `<button className="bg-blue-* …">` patterns with `<Button variant="…" size="…">` from `src/components/ui/Button.tsx`. Affected: `BulkActionToolbar`, `TaskDetailPanel`, `StatusDropdown`, `EpicDashboard`, `ChangesBrowser`, `ChangeCard`, `ImportModal`, `ActivityFeed`, `MemoryBrowser`, `ProcessBrowser`, `BdHealthPanel`, `SessionsTab`, `WorkerFindingsPanel`, `ReviewsHealthTab`, `TrayPopover`, `QuickCaptureApp`.
- **Icons** — replace all inline `<svg>` blocks and stray unicode glyphs (`↗`, `✓`, `✗`, `⚠`, `↑`, `↓`, `↕`, `🔗`, `✕`) with `<Icon name="…">` from `src/components/ui/Icon.tsx` (lucide-react). ~80 inline SVG occurrences across `src/`.
- **Tabs** — replace the three independent underline-tab implementations with `<Tabs.Root>/<Tabs.List>/<Tabs.Trigger>/<Tabs.Content>` from `src/components/ui/Tabs.tsx`. Affected: `TaskDetailPanel`, `BdHealthPanel`, `HealthPanel`.
- **Popovers** — replace hand-rolled portal/outside-click logic with `<Popover.Root>/<Popover.Trigger>/<Popover.Content>` from `src/components/ui/Popover.tsx`. Affected: `StatusFilterPill`, `FilterBar`, `IssueMatchesPopover`, `TabContextMenu`.

No new functionality. No API changes. No Rust/Tauri IPC changes. Pure implementation migration.

## Capabilities

### New Capabilities

<!-- None — this change only migrates implementations; it introduces no new user-facing capabilities. -->

### Modified Capabilities

- `app-settings`: SettingsDialog now uses `<Dialog>` — Esc-to-close is spec'd behavior that remains unchanged; implementation now uses Radix focus trap and aria-modal.
- `task-detail`: TaskDetailPanel tabs now use `<Tabs>` primitive; `TaskPickerModal` and `BlockerConfirmDialog` now use `<Dialog>` with focus trap.
- `task-list`: BulkActionToolbar and FilterBar now use `<Button>` and `<Popover>` primitives. No functional change.
- `bd-health-panel`: BdHealthPanel tabs now use `<Tabs>` primitive. Session snapshot drawer uses `<Dialog>`.
- `bd-formulas`: PourConfirmDialog now uses `<Dialog>` with focus trap and Esc-to-close.
- `quick-capture`: QuickCaptureApp buttons now use `<Button>` primitive.
- `notifications`: CommandPalette now uses `<Dialog>` primitive with proper focus trap.

## Impact

**Files modified**: `src/components/CommandPalette.tsx`, `src/components/settings/SettingsDialog.tsx`, `src/components/shortcuts/ShortcutModal.tsx`, `src/components/recovery/RecoveryDialog.tsx`, `src/components/task-detail/{TaskDetailPanel,TaskPickerModal,BlockerConfirmDialog,StatusDropdown,OpenSpecPanel,ImpactPanel}.tsx`, `src/components/task-list/{TaskList,TaskListItem,BulkActionToolbar,FilterBar}.tsx`, `src/components/memory-browser/MemoryBrowser.tsx`, `src/components/changes-browser/{ChangesBrowser,ChangeCard,ImportModal,StatusFilterPill}.tsx`, `src/components/activity-feed/ActivityFeed.tsx`, `src/components/process-browser/ProcessBrowser.tsx`, `src/components/epic-dashboard/EpicDashboard.tsx`, `src/components/health/{BdHealthPanel,HealthPanel,SessionsTab,WorkerFindingsPanel,ReviewsHealthTab}.tsx`, `src/components/bd-formulas/PourConfirmDialog.tsx`, `src/components/workspace/TabContextMenu.tsx`, `src/components/process-browser/IssueMatchesPopover.tsx`, `src/components/tray/TrayPopover.tsx`, `src/components/ui/Toast.tsx`, `src/QuickCaptureApp.tsx`.

**No new dependencies** — all primitives are from `ui-design-foundation` already installed.

**Prerequisite**: `ui-design-foundation` must be merged (it is — ✅ complete).
