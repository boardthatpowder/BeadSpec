// Right-click context menu for a workspace tab.
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useWorkspaceStore } from '../../stores/workspace'
import { useDismissable } from '../../hooks/useDismissable'

interface TabContextMenuProps {
  taskId: string
  paneId: string
  x: number
  y: number
  onDismiss: () => void
}

export function TabContextMenu({ taskId, paneId, x, y, onDismiss }: TabContextMenuProps) {
  const { closeTab, closeOthers, closeToRight, closeAll, splitPane } = useWorkspaceStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useDismissable(menuRef, onDismiss)

  function item(label: string, action: () => void) {
    return (
      <button
        key={label}
        onClick={() => { action(); onDismiss() }}
        className="w-full px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
      >
        {label}
      </button>
    )
  }

  const menu = (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: y, left: x, zIndex: 9000 }}
      className="bg-neutral-800 border border-neutral-700 rounded shadow-lg py-1 min-w-[180px]"
    >
      {item('Close', () => closeTab(paneId, taskId))}
      {item('Close Others', () => closeOthers(paneId, taskId))}
      {item('Close to the Right', () => closeToRight(paneId, taskId))}
      {item('Close All', () => closeAll(paneId))}
      <div className="my-1 border-t border-neutral-700" />
      {item('Split Right', () => splitPane(paneId, 'horizontal'))}
      {item('Split Down', () => splitPane(paneId, 'vertical'))}
    </div>
  )

  return createPortal(menu, document.body)
}
