// Right-click context menu for a workspace tab.
import { useWorkspaceStore } from '../../stores/workspace'
import { Button } from '../ui/Button'
import { Popover } from '../ui/Popover'

interface TabContextMenuProps {
  taskId: string
  paneId: string
  x: number
  y: number
  onDismiss: () => void
}

export function TabContextMenu({ taskId, paneId, x, y, onDismiss }: TabContextMenuProps) {
  const { closeTab, closeOthers, closeToRight, closeAll, splitPane } = useWorkspaceStore()

  function item(label: string, action: () => void) {
    return (
      <Button
        key={label}
        variant="ghost"
        size="xs"
        onClick={() => { action(); onDismiss() }}
        className="h-auto w-full justify-start rounded-none border-0 px-3 py-1.5 text-left text-sm font-normal text-(--color-fg-muted) hover:bg-(--color-surface-hi) hover:text-(--color-fg)"
      >
        {label}
      </Button>
    )
  }

  return (
    <Popover.Root open onOpenChange={(open) => { if (!open) onDismiss() }}>
      <Popover.Trigger asChild>
        <span
          aria-hidden
          style={{ position: 'fixed', top: y, left: x, width: 1, height: 1 }}
        />
      </Popover.Trigger>
      <Popover.Content
        align="start"
        side="bottom"
        sideOffset={0}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="min-w-[180px] rounded border-(--color-border-strong) bg-(--color-surface-hi) py-1 shadow-lg"
      >
        {item('Close', () => closeTab(paneId, taskId))}
        {item('Close Others', () => closeOthers(paneId, taskId))}
        {item('Close to the Right', () => closeToRight(paneId, taskId))}
        {item('Close All', () => closeAll(paneId))}
        <div className="my-1 border-t border-(--color-border-strong)" />
        {item('Split Right', () => splitPane(paneId, 'horizontal'))}
        {item('Split Down', () => splitPane(paneId, 'vertical'))}
      </Popover.Content>
    </Popover.Root>
  )
}
