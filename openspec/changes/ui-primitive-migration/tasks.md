## 1. Dialog Migrations

- [x] 1.1 Migrate `CommandPalette.tsx` — replace `fixed inset-0` overlay with `<Dialog.Root open={isOpen} onOpenChange={…}>`, keep existing Zustand store for open state, remove manual Esc handler
- [x] 1.2 Migrate `SettingsDialog.tsx` — replace `fixed inset-0` overlay with `<Dialog.Root>`, remove manual `useEffect` Escape listener (Radix handles it)
- [x] 1.3 Migrate `ShortcutModal.tsx` — replace overlay with `<Dialog.Root>` + `<Dialog.Header>` / `<Dialog.Body>`
- [x] 1.4 Migrate `RecoveryDialog.tsx` — replace overlay with `<Dialog.Root>`
- [x] 1.5 Migrate `TaskPickerModal.tsx` — replace overlay with `<Dialog.Root>`, keep existing search input focus on open via `<Dialog.Body>` autoFocus
- [x] 1.6 Migrate `MemoryBrowser.tsx` MemoryDrawer + StoreDialog — replace both `fixed inset-0` overlays with `<Dialog.Root>` each
- [x] 1.7 Migrate `ImportModal.tsx` — replace overlay with `<Dialog.Root>` + `<Dialog.Header>` / `<Dialog.Body>` / `<Dialog.Footer>`
- [x] 1.8 Migrate `PourConfirmDialog.tsx` — replace overlay with `<Dialog.Root>`
- [x] 1.9 Migrate `BlockerConfirmDialog.tsx` — replace overlay with `<Dialog.Root>`
- [x] 1.10 Migrate `SessionsTab.tsx` snapshot detail drawer — replace overlay with `<Dialog.Root>`
- [x] 1.11 Run `bun run typecheck` — zero errors after dialog migrations

## 2. Button Migrations

- [x] 2.1 Migrate `BulkActionToolbar.tsx` — replace all `<button>` elements with `<Button variant size>`
- [x] 2.2 Migrate `TaskDetailPanel.tsx` header actions and footer buttons — replace with `<Button>`
- [x] 2.3 Migrate `StatusDropdown.tsx` trigger button — replace with `<Button variant="ghost">`
- [x] 2.4 Migrate `EpicDashboard.tsx` action buttons — replace with `<Button>`
- [x] 2.5 Migrate `ChangesBrowser.tsx` and `ChangeCard.tsx` action buttons — replace with `<Button>`
- [x] 2.6 Migrate `ActivityFeed.tsx` filter/action buttons — replace with `<Button>`
- [x] 2.7 Migrate `MemoryBrowser.tsx` delete/store/refresh buttons — replace with `<Button>`
- [x] 2.8 Migrate `ProcessBrowser.tsx` re-analyze/open/find buttons — replace with `<Button>`
- [x] 2.9 Migrate `BdHealthPanel.tsx`, `SessionsTab.tsx`, `WorkerFindingsPanel.tsx`, `ReviewsHealthTab.tsx` buttons — replace with `<Button>`
- [x] 2.10 Migrate `TrayPopover.tsx` and `QuickCaptureApp.tsx` buttons — replace with `<Button>`
- [x] 2.11 Run `bun run typecheck` — zero errors after button migrations

## 3. Icon Migrations

- [x] 3.1 Replace inline SVGs in `TaskList.tsx` (sort chevrons, expand/collapse, check icons) with `<Icon>`; replace `↑ / ↓ / ↕` unicode with `<Icon name="ArrowUp/ArrowDown/ArrowUpDown">`
- [x] 3.2 Replace inline SVGs in `TaskListItem.tsx` (status dots, priority indicators) with `<Icon>`
- [x] 3.3 Replace inline SVGs in `TaskDetailPanel.tsx` (tab icons, action icons) with `<Icon>`
- [x] 3.4 Replace inline SVGs + unicode glyphs in `OpenSpecPanel.tsx` (`↗` → `ExternalLink`, `✓` → `Check`, `✗` → `X`, `⚠` → `AlertTriangle`) with `<Icon>`
- [x] 3.5 Replace inline SVGs in `ChangesBrowser.tsx`, `ChangeCard.tsx`, `ImportModal.tsx` with `<Icon>`
- [x] 3.6 Replace inline SVGs in `ActivityFeed.tsx`, `ActivityRow.tsx` with `<Icon>`
- [x] 3.7 Replace inline SVGs in `ProcessBrowser.tsx`, `MemoryBrowser.tsx` with `<Icon>`
- [x] 3.8 Replace inline SVGs in `BdHealthPanel.tsx`, `SessionsTab.tsx`, `WorkerFindingsPanel.tsx` with `<Icon>`
- [x] 3.9 Replace inline SVGs in `EpicDashboard.tsx`, `ImpactPanel.tsx` with `<Icon>`
- [x] 3.10 Replace `✕` unicode in `Toast.tsx`, `TrayPopover.tsx`, `BulkActionToolbar.tsx` with `<Icon name="X">`; replace `🔗` in `TaskPickerModal.tsx` with `<Icon name="Link2">`
- [x] 3.11 Replace remaining inline SVGs in `CommandPalette.tsx`, `TopBar.tsx`, `ViewSwitcher.tsx`, `FilterBar.tsx`, `KpiBar.tsx` with `<Icon>`
- [x] 3.12 Run `bun run typecheck` — zero errors after icon migrations

## 4. Tabs Migrations

- [x] 4.1 Migrate `TaskDetailPanel.tsx` tab bar — replace `<button className="border-b-2 …">` pattern with `<Tabs.Root value={activeTab} onValueChange={setActiveTab}><Tabs.List>…<Tabs.Trigger>…</Tabs.List><Tabs.Content>`
- [x] 4.2 Migrate `BdHealthPanel.tsx` tab bar — same pattern as 4.1
- [x] 4.3 Migrate `HealthPanel.tsx` tab bar — same pattern as 4.1
- [x] 4.4 Run `bun run typecheck` — zero errors after tabs migrations

## 5. Popover Migrations

- [x] 5.1 Migrate `FilterBar.tsx` filter dropdown — replace hand-rolled portal/outside-click with `<Popover.Root><Popover.Trigger asChild><Popover.Content>`
- [x] 5.2 Migrate `StatusFilterPill.tsx` in `ChangesBrowser.tsx` — same Popover pattern
- [x] 5.3 Migrate `IssueMatchesPopover.tsx` in `ProcessBrowser.tsx` — same Popover pattern
- [x] 5.4 Migrate `TabContextMenu.tsx` in `workspace/` — same Popover pattern
- [x] 5.5 Run `bun run typecheck` — zero errors after popover migrations

## 6. Quality Gates

- [x] 6.1 Run `bun run typecheck` — zero errors across all migrations
- [x] 6.2 Run `bun test` — all existing tests pass
- [x] 6.3 Run `bun run lint` — zero errors
- [ ] 6.4 Manual smoke: open each migrated modal (Cmd+K palette, ⚙ settings, ?/shortcuts, recovery, task picker, memory store, import, pour confirm, blocker confirm, snapshot) — verify Esc closes, backdrop click closes, Tab stays inside
- [ ] 6.5 Manual smoke: walk every view and confirm button/icon visual consistency (no raw `<button>` or inline SVG remaining)
- [ ] 6.6 Manual smoke: verify all three tab bars (TaskDetail, BdHealth, Health) use arrow-key navigation
- [ ] 6.7 Manual smoke: verify all four popovers (FilterBar, StatusFilterPill, IssueMatchesPopover, TabContextMenu) close on Esc and outside-click
- [x] 6.8 Run `openspec validate ui-primitive-migration` — passes
