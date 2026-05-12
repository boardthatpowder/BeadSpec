// Provides the single root DndContext for cross-pane tab drag.
import { createContext, useContext, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useWorkspaceStore } from '../../stores/workspace'
import { findLeaf } from '../../utils/paneTree'
import type { PaneNode } from '../../utils/paneTree'
import { Tab } from './Tab'

const DragActiveCtx = createContext(false)
export function useDragActive() { return useContext(DragActiveCtx) }

export function WorkspaceDndProvider({ children }: { children: React.ReactNode }) {
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [activeSrcPaneId, setActiveSrcPaneId] = useState<string | null>(null)
  const { root, reorderTab, promoteToPinned, moveTab, splitWithTab } = useWorkspaceStore()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragStart(e: DragStartEvent) {
    const taskId = String(e.active.id)
    setActiveTabId(taskId)
    setActiveSrcPaneId(findPaneForTab(root, taskId))
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    const srcPaneId = activeSrcPaneId
    setActiveTabId(null)
    setActiveSrcPaneId(null)
    if (!over || !srcPaneId) return

    const taskId = String(active.id)
    const overId = String(over.id)

    if (overId.startsWith('edge:')) {
      const parts = overId.split(':')
      const destLeafId = parts[1]
      const edge = parts[2] as 'left' | 'right' | 'top' | 'bottom'
      splitWithTab(srcPaneId, taskId, destLeafId, edge)
    } else if (overId.startsWith('tabbar:')) {
      const destPaneId = overId.slice('tabbar:'.length)
      if (destPaneId !== srcPaneId) moveTab(srcPaneId, taskId, destPaneId)
    } else if (overId.startsWith('tabslot:')) {
      const parts = overId.split(':')
      const destPaneId = parts[1]
      const destIndex = parseInt(parts[2], 10)
      if (destPaneId !== srcPaneId) {
        moveTab(srcPaneId, taskId, destPaneId, destIndex)
      } else {
        const leaf = findLeaf(root, srcPaneId)
        if (!leaf) return
        const from = leaf.tabs.findIndex((t) => t.id === taskId)
        if (from !== -1 && from !== destIndex) {
          if (!leaf.pinned[taskId]) promoteToPinned(taskId)
          reorderTab(srcPaneId, from, destIndex)
        }
      }
    } else {
      // over is a taskId — intra-pane reorder or cross-pane move
      const destPaneId = findPaneForTab(root, overId)
      if (!destPaneId) return
      if (destPaneId === srcPaneId) {
        const leaf = findLeaf(root, srcPaneId)
        if (!leaf) return
        const from = leaf.tabs.findIndex((t) => t.id === taskId)
        const to = leaf.tabs.findIndex((t) => t.id === overId)
        if (from === -1 || to === -1 || from === to) return
        if (!leaf.pinned[taskId]) promoteToPinned(taskId)
        reorderTab(srcPaneId, from, to)
      } else {
        const destLeaf = findLeaf(root, destPaneId)
        if (!destLeaf) return
        const destIndex = destLeaf.tabs.findIndex((t) => t.id === overId)
        moveTab(srcPaneId, taskId, destPaneId, destIndex === -1 ? undefined : destIndex)
      }
    }
  }

  return (
    <DragActiveCtx.Provider value={activeTabId !== null}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay>
          {activeTabId && activeSrcPaneId && (
            <Tab
              taskId={activeTabId}
              paneId={activeSrcPaneId}
              label={getTabLabel(root, activeTabId)}
              isPreview={false}
              isActive={true}
              onContextMenu={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>
    </DragActiveCtx.Provider>
  )
}

function findPaneForTab(root: PaneNode, taskId: string): string | null {
  if (root.kind === 'leaf') return root.tabs.some((t) => t.id === taskId) ? root.id : null
  for (const child of root.children) {
    const found = findPaneForTab(child, taskId)
    if (found) return found
  }
  return null
}

function getTabLabel(root: PaneNode, taskId: string): string {
  // Tab labels are not stored in the tree; fall back to taskId for the overlay
  void root
  return taskId
}
