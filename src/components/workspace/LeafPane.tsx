// LeafPane — composes TabBar + TaskDetailPanel for a single pane slot.
import { useWorkspaceStore } from '../../stores/workspace'
import { useActiveProject } from '../../hooks/useProject'
import { TabBar } from './TabBar'
import { TaskDetailPanel } from '../task-detail/TaskDetailPanel'
import { OpenSpecDocPanel } from './OpenSpecDocPanel'
import { EpicDashboard } from '../epic-dashboard/EpicDashboard'
import { useFeatureFlag } from '../../contexts/SettingsContext'
import type { LeafPane as LeafPaneType, TabId } from '../../utils/paneTree'
import { useDroppable } from '@dnd-kit/core'
import { useDragActive } from './WorkspaceDndProvider'

interface LeafPaneProps {
  node: LeafPaneType
  isRoot?: boolean
}

export function LeafPane({ node, isRoot = false }: LeafPaneProps) {
  const { activePaneId, setActivePane } = useWorkspaceStore()
  const isActive = activePaneId === node.id
  const project = useActiveProject()

  // Resolve task titles for the tab bar labels via query cache.
  const tabMeta = useTabTitles(node.tabs, project)

  return (
    <div
      onClick={() => setActivePane(node.id)}
      className={[
        'relative h-full flex flex-col overflow-hidden',
        // 2px accent border on the active pane.
        isActive ? 'ring-2 ring-inset ring-blue-600/50' : '',
      ].join(' ')}
    >
      <EdgeDropZone paneId={node.id} edge="left" />
      <EdgeDropZone paneId={node.id} edge="right" />
      <EdgeDropZone paneId={node.id} edge="top" />
      <EdgeDropZone paneId={node.id} edge="bottom" />
      {node.tabs.length > 0 && (
        <TabBar paneId={node.id} tasks={tabMeta} />
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        {node.activeTabId && node.tabs.some((t) => t.id === node.activeTabId) ? (
          <ActiveTab tab={node.tabs.find((t) => t.id === node.activeTabId)!} paneId={node.id} />
        ) : (
          <EmptyPlaceholder paneId={node.id} isRoot={isRoot} />
        )}
      </div>
    </div>
  )
}

function parseDocTabId(id: string): { change: string; artifact: string } | null {
  if (!id.startsWith('doc:')) return null
  const rest = id.slice(4)
  const colonIdx = rest.indexOf(':')
  if (colonIdx === -1) return null
  return { change: rest.slice(0, colonIdx), artifact: rest.slice(colonIdx + 1) }
}

function ActiveTab({ tab, paneId }: { tab: TabId; paneId: string }) {
  const openspecEnabled = useFeatureFlag('openspec')
  if (tab.kind === 'doc') return openspecEnabled ? <OpenSpecDocPanel change={tab.change} artifact={tab.artifact} /> : null
  if (tab.kind === 'epic') return openspecEnabled ? <EpicDashboard change={tab.change} epicId={tab.epicId} /> : null
  const doc = parseDocTabId(tab.id)
  if (doc) return openspecEnabled ? <OpenSpecDocPanel change={doc.change} artifact={doc.artifact} /> : null
  return <TaskDetailPanel taskId={tab.id} paneId={paneId} />
}

type EdgeSide = 'left' | 'right' | 'top' | 'bottom'

function EdgeDropZone({ paneId, edge }: { paneId: string; edge: EdgeSide }) {
  const { setNodeRef, isOver } = useDroppable({ id: `edge:${paneId}:${edge}` })
  const isDragging = useDragActive()
  const arrow: Record<EdgeSide, string> = { left: '←', right: '→', top: '↑', bottom: '↓' }
  const posClass: Record<EdgeSide, string> = {
    left: 'top-0 left-0 h-full w-1/5',
    right: 'top-0 right-0 h-full w-1/5',
    top: 'top-0 left-0 w-full h-1/5',
    bottom: 'bottom-0 left-0 w-full h-1/5',
  }

  return (
    <div
      ref={setNodeRef}
      className={[
        'absolute z-10 flex items-center justify-center transition-all duration-150',
        posClass[edge],
        isDragging ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        isOver
          ? 'bg-blue-600/30 border border-blue-400'
          : 'bg-blue-900/20 border border-dashed border-blue-700/40',
      ].join(' ')}
    >
      {isDragging && <span className="text-blue-300 text-xs select-none">{arrow[edge]}</span>}
    </div>
  )
}

export function EmptyPlaceholder({ paneId, isRoot }: { paneId: string; isRoot: boolean }) {
  const { closePane } = useWorkspaceStore()
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-neutral-600">
      <span className="text-sm">Select a task to open</span>
      {!isRoot && (
        <button
          onClick={(e) => { e.stopPropagation(); closePane(paneId) }}
          className="text-xs text-neutral-500 hover:text-neutral-300 border border-neutral-800 px-3 py-1 rounded transition-colors"
        >
          Close pane
        </button>
      )}
    </div>
  )
}

function useTabTitles(tabs: TabId[], project: string | null): { taskId: string; title: string }[] {
  // Read task titles from the TanStack Query cache — no extra fetches.
  // The task list populates these entries; worst case we show the tab id.
  const { getQueryData } = (window as unknown as { __REACT_QUERY_CLIENT__?: { getQueryData: <T>(key: unknown[]) => T | undefined } }).__REACT_QUERY_CLIENT__ ?? {}
  return tabs.map((tab) => {
    const tabId = tab.id
    let title = tabId
    try {
      if (getQueryData && tab.kind === 'task') {
        const cached = getQueryData<{ title: string }>(['task', project, tabId])
        if (cached?.title) title = cached.title
      } else if (tab.kind === 'doc') {
        title = `${tab.change}/${tab.artifact.split('/').pop() ?? tab.artifact}`
      } else if (tab.kind === 'epic') {
        title = `${tab.change} · dashboard`
      }
    } catch { /* ignore */ }
    return { taskId: tabId, title }
  })
}
