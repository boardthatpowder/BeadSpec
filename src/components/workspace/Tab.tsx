// Single workspace tab — preview (italic) or pinned (solid).
import { useWorkspaceStore } from '../../stores/workspace'
import { IconButton } from '../ui/IconButton'

interface TabProps {
  taskId: string
  paneId: string
  label: string
  isPreview: boolean
  isActive: boolean
  onContextMenu: (e: React.MouseEvent) => void
}

export function Tab({ taskId, paneId, label, isPreview, isActive, onContextMenu }: TabProps) {
  const { closeTab, promoteToPinned, setActiveTab } = useWorkspaceStore()
  const isDoc = taskId.startsWith('doc:')

  function handleClick() {
    setActiveTab(paneId, taskId)
  }

  function handleDoubleClick() {
    promoteToPinned(taskId)
  }

  function handleMiddleClick(e: React.MouseEvent) {
    if (e.button === 1) {
      e.preventDefault()
      closeTab(paneId, taskId)
    }
  }

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation()
    closeTab(paneId, taskId)
  }

  return (
    <div
      role="tab"
      aria-selected={isActive}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMiddleClick}
      onContextMenu={onContextMenu}
      className={[
        'group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer select-none shrink-0',
        'border-r border-neutral-800 transition-colors',
        isActive
          ? 'bg-neutral-900/60 text-neutral-100'
          : 'bg-neutral-900/20 text-neutral-400 hover:bg-neutral-900/40 hover:text-neutral-200',
        isPreview && !isDoc ? 'italic' : '',
      ].join(' ')}
    >
      {isDoc && <span className="text-neutral-500 text-xs leading-none">·</span>}
      <span className="max-w-[160px] truncate">{label}</span>
      <IconButton
        label="Close tab"
        onClick={handleClose}
        className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-300 leading-none transition-opacity"
      >
        ×
      </IconButton>
    </div>
  )
}
