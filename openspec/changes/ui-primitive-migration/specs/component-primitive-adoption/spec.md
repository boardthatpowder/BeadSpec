## ADDED Requirements

### Requirement: All modal overlays use Dialog primitive
Every modal overlay in the app SHALL use `<Dialog>` from `src/components/ui/Dialog.tsx`. No component SHALL implement its own `fixed inset-0 bg-black/*` overlay. Each modal SHALL support Esc-to-close, backdrop-click-to-close, and focus trapping provided by the Radix Dialog primitive.

#### Scenario: Esc closes any modal
- **WHEN** any modal (CommandPalette, SettingsDialog, ShortcutModal, RecoveryDialog, TaskPickerModal, MemoryDrawer, StoreDialog, ImportModal, PourConfirmDialog, BlockerConfirmDialog, SessionsTab snapshot drawer) is open and the user presses Escape
- **THEN** the modal closes and focus returns to the triggering element

#### Scenario: Backdrop click closes any modal
- **WHEN** any of the above modals is open and the user clicks outside the modal content area
- **THEN** the modal closes

#### Scenario: Focus is trapped inside open modals
- **WHEN** any modal is open and the user presses Tab repeatedly
- **THEN** focus cycles only among interactive elements inside the modal

### Requirement: All action buttons use Button primitive
Every `<button>` element that triggers an action (submit, cancel, delete, refresh, open, close, toggle) SHALL use `<Button>` from `src/components/ui/Button.tsx` with an explicit `variant` and `size` prop. No component SHALL apply ad-hoc Tailwind color/padding classes directly to a `<button>` element.

#### Scenario: Primary actions use primary variant
- **WHEN** a button represents the primary/confirm action in a context (e.g., "Import", "Save", "Create", "Pour")
- **THEN** it renders with `variant="primary"` (accent background, white text)

#### Scenario: Destructive actions use danger variant
- **WHEN** a button triggers a destructive operation (delete, remove)
- **THEN** it renders with `variant="danger"`

#### Scenario: Cancel/dismiss actions use ghost or secondary variant
- **WHEN** a button cancels or dismisses without performing an action
- **THEN** it renders with `variant="ghost"` or `variant="secondary"`

### Requirement: All icons use Icon primitive
Every icon in the app SHALL use `<Icon>` from `src/components/ui/Icon.tsx` with a named lucide-react icon. No component SHALL use inline `<svg>` blocks, unicode glyphs (`↗`, `✓`, `✗`, `⚠`, `↑`, `↓`, `🔗`, `✕`), or emoji as functional icons.

#### Scenario: Icons render at consistent size
- **WHEN** an `<Icon>` is rendered with `size="sm"` / `size="md"` / `size="lg"`
- **THEN** it renders at exactly 14 / 16 / 20 pixels respectively with strokeWidth 1.5

#### Scenario: No inline SVG in component files
- **WHEN** any component file in `src/components/` is inspected
- **THEN** it contains no inline `<svg viewBox=` elements (only `<Icon>` usage and the Icon.tsx wrapper itself)

### Requirement: Tab bars use Tabs primitive
Every tab bar in the app SHALL use `<Tabs.Root>/<Tabs.List>/<Tabs.Trigger>/<Tabs.Content>` from `src/components/ui/Tabs.tsx`. No component SHALL implement its own tab indicator with `border-b-2` applied to individual `<button>` elements.

#### Scenario: Arrow key navigation works in all tab bars
- **WHEN** focus is on a tab trigger and the user presses ArrowRight or ArrowLeft
- **THEN** focus moves to the adjacent tab trigger (Radix behavior)

#### Scenario: Active tab shows consistent blue underline indicator
- **WHEN** a tab trigger is the currently active tab in any tab bar (TaskDetailPanel, BdHealthPanel, HealthPanel)
- **THEN** the same blue `border-b-2 border-[--color-accent]` indicator appears beneath it

### Requirement: Dropdown/filter popovers use Popover primitive
Every dropdown or filter popover in the app SHALL use `<Popover.Root>/<Popover.Trigger>/<Popover.Content>` from `src/components/ui/Popover.tsx`. No component SHALL implement its own portal, outside-click listener, or manual positioning logic for popover content.

#### Scenario: Popovers render above clipping containers
- **WHEN** a Popover (FilterBar, StatusFilterPill, IssueMatchesPopover, TabContextMenu) opens inside a scrollable or overflow-hidden container
- **THEN** the popover content renders above the clip boundary via Radix portal

#### Scenario: Esc closes any open popover
- **WHEN** a Popover is open and the user presses Escape
- **THEN** the popover closes and focus returns to the trigger
