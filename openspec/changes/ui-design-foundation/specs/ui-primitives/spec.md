## ADDED Requirements

### Requirement: Button primitive
The app SHALL provide a `Button` component in `src/components/ui/Button.tsx` with variants (`primary`, `secondary`, `ghost`, `danger`, `link`) and sizes (`xs`, `sm`, `md`). It SHALL accept optional `leadingIcon`, `trailingIcon`, and `loading` props. When `loading` is true it SHALL show a spinner and disable interaction. When `disabled` it SHALL reduce opacity and block pointer events. All interactive states SHALL be styled with `focus-visible:ring-2` for keyboard accessibility.

#### Scenario: Renders primary variant
- **WHEN** a `<Button variant="primary">Save</Button>` is rendered
- **THEN** it displays with the accent background color and white text

#### Scenario: Renders loading state
- **WHEN** `loading={true}` is passed
- **THEN** a spinner icon replaces or joins the label and the button is non-interactive

#### Scenario: Renders disabled state
- **WHEN** `disabled={true}` is passed
- **THEN** the button renders with reduced opacity and `pointer-events-none`

#### Scenario: Shows focus ring on keyboard focus
- **WHEN** the button receives focus via keyboard (Tab key)
- **THEN** a visible `focus-visible:ring-2` ring appears around the button

### Requirement: Dialog primitive
The app SHALL provide a `Dialog` component in `src/components/ui/Dialog.tsx` built on `@radix-ui/react-dialog`. It SHALL trap focus within the dialog when open, close on Escape key press, close on backdrop click, and expose subcomponents `Dialog.Header`, `Dialog.Body`, and `Dialog.Footer`. The backdrop SHALL have `aria-modal="true"` and `role="dialog"` applied by Radix automatically.

#### Scenario: Closes on Escape
- **WHEN** a Dialog is open and the user presses Escape
- **THEN** the dialog closes and focus returns to the trigger element

#### Scenario: Closes on backdrop click
- **WHEN** a Dialog is open and the user clicks outside the dialog content
- **THEN** the dialog closes

#### Scenario: Traps focus
- **WHEN** a Dialog is open and the user presses Tab repeatedly
- **THEN** focus cycles only within the dialog's interactive elements

#### Scenario: Exposes Header/Body/Footer subcomponents
- **WHEN** `<Dialog.Header>`, `<Dialog.Body>`, and `<Dialog.Footer>` are used
- **THEN** they render with appropriate padding and border separators

### Requirement: Card primitive
The app SHALL provide a `Card` component in `src/components/ui/Card.tsx` that renders a container with `rounded-lg`, `border border-[--color-border]`, and `bg-[--color-surface]` as its base. It SHALL accept an optional `interactive` prop that adds hover and focus-visible styles for use as a clickable card.

#### Scenario: Renders with base token styles
- **WHEN** a `<Card>` is rendered
- **THEN** it uses `--color-border` and `--color-surface` tokens for border and background

#### Scenario: Interactive card gets hover styles
- **WHEN** `interactive={true}` is set
- **THEN** the card shows a subtle hover background shift on mouse-over

### Requirement: Badge primitive
The app SHALL provide a `Badge` component in `src/components/ui/Badge.tsx` that accepts a `variant` prop mapping to a semantic color (`default`, `success`, `warning`, `danger`, `info`, `muted`). It SHALL render as an inline pill with appropriate background, text, and border from the design token set — never from ad-hoc Tailwind classes.

#### Scenario: Renders success variant
- **WHEN** `<Badge variant="success">Done</Badge>` is rendered
- **THEN** it shows green background, text, and border from the success color token

#### Scenario: Variant drives color, not className
- **WHEN** a consumer passes only `variant="danger"`
- **THEN** the danger palette is applied without any caller-side color classes

### Requirement: EmptyState primitive
The app SHALL provide an `EmptyState` component in `src/components/ui/EmptyState.tsx` that accepts `icon` (a React node), `title` (string), `description` (optional string), and `action` (optional React node). It SHALL render centered content matching the visual style of the existing polished empty state in `ChangesBrowser`.

#### Scenario: Renders with icon, title, and description
- **WHEN** `icon`, `title`, and `description` are provided
- **THEN** all three are rendered in a vertically centered layout

#### Scenario: Renders without description or action
- **WHEN** only `icon` and `title` are provided
- **THEN** the component renders without description or action slots, with no empty space gaps

#### Scenario: Renders action slot
- **WHEN** an `action` node is provided (e.g., a Button)
- **THEN** the action is rendered below the description

### Requirement: ErrorState primitive
The app SHALL provide an `ErrorState` component in `src/components/ui/ErrorState.tsx` that accepts `title` (string), `description` (optional string), and `retry` (optional `() => void` callback). It SHALL render an error indicator with optionally a "Try again" button when `retry` is provided. It SHALL never render raw `String(error)` output.

#### Scenario: Renders with title only
- **WHEN** only `title` is provided
- **THEN** an error icon and title are shown

#### Scenario: Renders retry button when callback provided
- **WHEN** `retry` function is passed
- **THEN** a "Try again" button is shown; clicking it calls the `retry` callback

### Requirement: Tabs primitive
The app SHALL provide a `Tabs` component in `src/components/ui/Tabs.tsx` built on `@radix-ui/react-tabs`. It SHALL expose `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, and `Tabs.Content`. The active trigger SHALL use a blue bottom-border indicator. All triggers SHALL be keyboard-navigable (arrow keys) per Radix defaults.

#### Scenario: Renders active tab with blue underline
- **WHEN** a tab trigger is the active/selected tab
- **THEN** a `border-b-2 border-[--color-accent]` indicator appears below it

#### Scenario: Arrow key navigation
- **WHEN** a tab trigger is focused and the user presses ArrowRight
- **THEN** focus moves to the next tab trigger and that tab becomes active

### Requirement: Popover primitive
The app SHALL provide a `Popover` component in `src/components/ui/Popover.tsx` built on `@radix-ui/react-popover`. It SHALL expose `Popover.Root`, `Popover.Trigger`, and `Popover.Content`. The content SHALL appear in a portal (no z-index collisions), close on Escape, and close on click outside.

#### Scenario: Content renders in a portal
- **WHEN** a Popover is opened inside a clipping container
- **THEN** the content renders above the clip boundary (portal to body)

#### Scenario: Closes on Escape
- **WHEN** a Popover is open and the user presses Escape
- **THEN** the popover closes and focus returns to the trigger

#### Scenario: Closes on outside click
- **WHEN** a Popover is open and the user clicks outside the content
- **THEN** the popover closes

### Requirement: Icon primitive
The app SHALL provide an `Icon` component in `src/components/ui/Icon.tsx` that wraps a named lucide-react icon. It SHALL accept `name` (keyof LucideIcons), `size` (`sm` | `md` | `lg` mapping to 14/16/20px), and `strokeWidth` (default 1.5). It SHALL forward `className` for color overrides.

#### Scenario: Renders correct icon by name
- **WHEN** `<Icon name="Check" />` is rendered
- **THEN** the lucide Check SVG is output

#### Scenario: Size variants map to correct pixel dimensions
- **WHEN** `size="lg"` is passed
- **THEN** the SVG renders at 20×20px

#### Scenario: Default stroke width is 1.5
- **WHEN** no `strokeWidth` is specified
- **THEN** the rendered SVG uses `strokeWidth={1.5}`
