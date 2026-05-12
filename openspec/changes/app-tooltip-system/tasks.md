## 1. Foundation

- [x] 1.1 Install `@radix-ui/react-tooltip` via `bun add @radix-ui/react-tooltip`
- [x] 1.2 Create `src/components/ui/Tooltip.tsx` — export `AppTooltipProvider` (reads `useSettings().settings.tooltips`, mounts Radix `<TooltipProvider delayDuration={delayMs}>`), `TooltipConfigContext`, and `<Tooltip label shortcut? description?>` wrapper that short-circuits when `enabled=false`
- [x] 1.3 Create `src/components/ui/IconButton.tsx` — `<button aria-label={label} ...rest>` wrapped in `<Tooltip>`; required `label: string`, optional `shortcut`, `description`; forwards all `HTMLButtonElement` props

## 2. Settings Integration

- [x] 2.1 Add `TooltipPrefs` interface and `tooltips` field to `AppSettings` in `src/stores/settingsStore.ts`; set defaults `enabled: true, delayMs: 500`; add deep-merge line in `loadSettings()`
- [x] 2.2 Mount `<AppTooltipProvider>` in `src/App.tsx` between `<SettingsProvider>` and `<TauriSyncProvider>`
- [x] 2.3 Add "Tooltips" section to `src/components/settings/SettingsDialog.tsx` — enable toggle + delay preset selector (0 / 250 / 500 / 1000 ms options)

## 3. Layout Shell Migration

- [x] 3.1 Migrate `src/components/layout/RefreshButton.tsx` — replace `<button title="Refresh (⌘R)">` with `<IconButton label="Refresh" shortcut="⌘R">`
- [x] 3.2 Migrate `src/components/layout/SettingsButton.tsx` — replace `<button title="Settings">` with `<IconButton label="Settings" shortcut="⌘,">`
- [x] 3.3 Migrate `src/components/layout/ProjectSwitcher.tsx` — wrap project switcher trigger and any icon actions with `<IconButton>` or `<Tooltip>`
- [x] 3.4 Migrate `src/components/layout/ViewSwitcher.tsx` — wrap each view tab/icon button with `<IconButton label="…">`

## 4. FilterBar Migration

- [x] 4.1 Migrate all icon buttons in `src/components/filters/FilterBar.tsx` (~12 buttons: group toggle, dimension toggles, chip removers, menu openers) to `<IconButton>` or `<Tooltip>`-wrapped; remove bare `title=` attrs
- [x] 4.2 Migrate icon buttons in `src/components/filters/KpiBar.tsx` to `<IconButton>`

## 5. Task Detail Strip Migration

- [x] 5.1 Migrate `src/components/task-detail/BreadcrumbBar.tsx` — replace `title="Go back"` arrow with `<IconButton label="Go back">`
- [x] 5.2 Migrate `src/components/task-detail/HumanQueueToggle.tsx` — replace `title="Flag for human decision"` / `title="Remove human decision flag"` with `<IconButton label="…">`
- [x] 5.3 Migrate `src/components/task-detail/InlineTitle.tsx` — replace `title="Click to edit"` with `<IconButton>` or `<Tooltip>` on the edit trigger
- [x] 5.4 Migrate `src/components/task-detail/AssigneePicker.tsx` — replace `title="Click to edit assignee"` trigger with `<Tooltip label="Edit assignee">`
- [x] 5.5 Migrate `src/components/task-detail/DependencyGraphTab.tsx` — replace `title="Open in new tab"` with `<IconButton label="Open in new tab">`
- [x] 5.6 Migrate icon buttons in `src/components/task-detail/OpenSpecPanel.tsx` (3 buttons) to `<IconButton>`
- [x] 5.7 Migrate icon buttons in `src/components/task-detail/StatusDropdown.tsx`, `PrioritySelector.tsx`, `LabelManager.tsx` to `<IconButton>` or `<Tooltip>`-wrapped triggers
- [x] 5.8 Migrate icon buttons in `src/components/task-detail/CommentsSection.tsx`, `ActivityTimeline.tsx`, `RufloMemoryPanel.tsx`, `GitHistoryPanel.tsx`, `DoltRevisionEntry.tsx` to `<IconButton>`
- [x] 5.9 Migrate remaining task-detail icon buttons: `TaskPickerModal.tsx`, `SlashMenu.tsx`, `TaskDetailPanel.tsx`

## 6. Changes Browser Migration

- [x] 6.1 Migrate icon buttons in `src/components/changes-browser/ChangeCard.tsx` (4 buttons) to `<IconButton>`
- [x] 6.2 Migrate icon buttons in `src/components/changes-browser/ChangesBrowser.tsx` (5 buttons) to `<IconButton>`
- [x] 6.3 Migrate icon buttons in `src/components/changes-browser/ImportModal.tsx` (6 buttons) to `<IconButton>`

## 7. Workspace, Smart Views, and Remaining Sites

- [x] 7.1 Migrate icon buttons in `src/components/workspace/` (`LeafPane.tsx`, `Tab.tsx`, `TabContextMenu.tsx`, `OpenSpecDocPanel.tsx`) to `<IconButton>`
- [x] 7.2 Migrate icon buttons in `src/components/smart-views/ReadyToStartView.tsx` and `FocusView.tsx` to `<IconButton>`
- [x] 7.3 Migrate icon buttons in `src/QuickCaptureApp.tsx`, `src/components/notifications/BdHumanQueue.tsx`, and `src/components/tray/` to `<IconButton>`
- [x] 7.4 Migrate icon buttons in `src/components/CommandPalette.tsx` and `src/components/shortcuts/` to `<IconButton>`

## 8. Cleanup and Verification

- [x] 8.1 Grep for remaining bare `title=` attributes on `<button>` and `<a>` elements; remove or migrate any found (`grep -r 'title="' src/components --include="*.tsx" -l`)
- [x] 8.2 Run `bun run typecheck` — confirm zero type errors
- [x] 8.3 Run `bun run lint` — confirm zero lint errors
- [ ] 8.4 Start dev server (`bun run dev`) and manually hover-test each migrated area: layout shell, FilterBar, task-detail strip, changes browser, workspace tabs
- [ ] 8.5 Verify tooltip settings: toggle enabled off → confirm no tooltips render; change delay preset → confirm responsiveness changes live
- [ ] 8.6 Keyboard accessibility check: Tab through RefreshButton, FilterBar group menu, and a ChangeCard action — confirm tooltip appears on focus
