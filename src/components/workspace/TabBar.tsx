// Horizontal tab bar with dnd-kit drag-to-reorder.
// DndContext lives in WorkspaceDndProvider (parent); SortableContext is per-pane.
import { useState } from 'react'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Tab } from './Tab'
import { TabContextMenu } from './TabContextMenu'
import { useWorkspaceStore } from '../../stores/workspace'
import { findLeaf } from '../../utils/paneTree'

interface TabBarProps {
  paneId: string
  tasks: { taskId: string; title: string }[]
}

interface ContextMenuState {
  taskId: string
  x: number
  y: number
}

interface TabSlotDropzoneProps {
  paneId: string
  index: number
}

function TabSlotDropzone({ paneId, index }: TabSlotDropzoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `tabslot:${paneId}:${index}` })
  return (
    <div
      ref={setNodeRef}
      className={`w-2 self-stretch flex-shrink-0 transition-colors
        ${isOver ? 'bg-blue-500' : 'bg-transparent'}`}
      style={{ pointerEvents: 'none' }}
    />
  )
}

export function TabBar({ paneId, tasks }: TabBarProps) {
  const { root, activePaneId } = useWorkspaceStore()
  const leaf = findLeaf(root, paneId)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const { setNodeRef: setBarRef, isOver: isBarOver } = useDroppable({ id: `tabbar:${paneId}` })

  function handleContextMenu(e: React.MouseEvent, taskId: string) {
    e.preventDefault()
    setContextMenu({ taskId, x: e.clientX, y: e.clientY })
  }

  if (!leaf) return null

  return (
    <div
      ref={setBarRef}
      className={`flex overflow-x-auto border-b border-neutral-800 bg-neutral-950 shrink-0 relative transition-colors
        ${isBarOver ? 'ring-1 ring-blue-500/40 bg-blue-900/10' : ''}`}
    >
      <SortableContext items={leaf.tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
        {leaf.tabs.map((tab, index) => {
          const tabId = tab.id
          return (
            <>
              <TabSlotDropzone key={`slot-${index}`} paneId={paneId} index={index} />
              <SortableTab
                key={tabId}
                taskId={tabId}
                paneId={paneId}
                label={getTabLabel(tabId, tasks)}
                isPreview={!leaf.pinned[tabId]}
                isActive={leaf.activeTabId === tabId && activePaneId === paneId}
                onContextMenu={(e) => handleContextMenu(e, tabId)}
              />
            </>
          )
        })}
        <TabSlotDropzone paneId={paneId} index={leaf.tabs.length} />
      </SortableContext>

      {contextMenu && (
        <TabContextMenu
          taskId={contextMenu.taskId}
          paneId={paneId}
          x={contextMenu.x}
          y={contextMenu.y}
          onDismiss={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

function getTabLabel(taskId: string, tasks: { taskId: string; title: string }[]): string {
  if (taskId.startsWith('doc:')) {
    const rest = taskId.slice(4)
    const colonIdx = rest.indexOf(':')
    if (colonIdx !== -1) {
      const change = rest.slice(0, colonIdx)
      const artifact = rest.slice(colonIdx + 1)
      const basename = artifact.split('/').pop()?.replace('.md', '') ?? artifact
      return `${change}/${basename}`
    }
  }
  if (taskId.startsWith('epic:')) {
    return `${taskId.slice(5)} dashboard`
  }
  return tasks.find((t) => t.taskId === taskId)?.title ?? taskId
}

function SortableTab(props: React.ComponentProps<typeof Tab>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.taskId,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
    >
      <Tab {...props} />
    </div>
  )
}
