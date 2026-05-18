import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { load } from '@tauri-apps/plugin-store'
import { useHotkeys } from 'react-hotkeys-hook'
import { ProjectSwitcher } from './ProjectSwitcher'
import { ViewSwitcher } from './ViewSwitcher'
import { WorkspaceRoot } from '../workspace/WorkspacePane'
import { useWorkspaceShortcuts } from '../../hooks/useWorkspaceShortcuts'
import { initWorkspacePersistence } from '../../stores/workspacePersist'
import { FilterBar } from '../filters/FilterBar'
import { KpiBar } from '../filters/KpiBar'
import { useTasks } from '../../hooks/useTasks'
import { useAppState } from '../../contexts/HashStateContext'
import { TaskList } from '../task-list/TaskList'
import { BulkActionToolbar } from '../task-list/BulkActionToolbar'
import { BdHealthPanel } from '../health/BdHealthPanel'
import { FormulasBrowser } from '../bd-formulas/FormulasBrowser'
import { BdHumanQueueChip } from '../notifications/BdHumanQueue'
import { ChangesBrowser } from '../changes-browser/ChangesBrowser'
import { ActivityFeed } from '../activity-feed/ActivityFeed'
import { ProcessBrowser } from '../process-browser/ProcessBrowser'
import { MemoryBrowser } from '../memory-browser/MemoryBrowser'
import { GitnexusBadge } from '../gitnexus/GitnexusBadge'
import { SessionsTab } from '../health/SessionsTab'
import { ReviewsHealthTab } from '../health/ReviewsHealthTab'
import { RefreshButton } from './RefreshButton'
import { SettingsButton } from './SettingsButton'
import { HelpButton } from './HelpButton'
import { useFeatureFlag, useSettings } from '../../contexts/SettingsContext'
import { useActiveProject } from '../../hooks/useProject'
import type { Task } from '../../bindings'

export function AppLayout() {
  const [leftWidth, setLeftWidth] = useState(30)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 800)
  const dragging = useRef(false)
  const { state } = useAppState()

  // Task 9.2 — mount workspace shortcuts once at the layout root.
  useWorkspaceShortcuts()

  useEffect(() => {
    // Task 8.1 — init workspace persistence on mount (loads from layout.json + seeds from hash).
    initWorkspacePersistence()
    load('layout.json')
      .then(store => store.get<number>('pane-left-width'))
      .then(val => { if (val != null) setLeftWidth(val) })
      .catch(() => {})
      .finally(() => setIsLoaded(true))
  }, [])

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      setIsNarrow(entries[0].contentRect.width < 800)
    })
    obs.observe(document.documentElement)
    return () => obs.disconnect()
  }, [])

  const saveWidth = useCallback(async (w: number) => {
    const store = await load('layout.json')
    await store.set('pane-left-width', w)
  }, [])

  const onMouseDown = useCallback(() => { dragging.current = true }, [])
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const pct = (e.clientX / window.innerWidth) * 100
    const clamped = Math.max(15, Math.min(60, pct))
    setLeftWidth(clamped)
    saveWidth(clamped)
  }, [saveWidth])
  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  if (!isLoaded) return <div className="h-screen w-screen bg-neutral-950" />

  const openspecEnabled = useFeatureFlag('openspec')
  const isHealthView = state.view === 'health'
  const isChangesView = state.view === 'changes'
  const isActivityView = state.view === 'activity'
  const isProcessesView = state.view === 'processes'
  const isMemoryView = state.view === 'memory'

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 select-none"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
        <TopBar />
        {isHealthView ? (
          <div className="flex-1 overflow-hidden">
            <HealthPanel />
          </div>
        ) : isChangesView && openspecEnabled ? (
          <div className="flex-1 overflow-hidden">
            <ChangesBrowser />
          </div>
        ) : isActivityView ? (
          <div className="flex-1 overflow-hidden">
            <ActivityFeed />
          </div>
        ) : isProcessesView ? (
          <div className="flex-1 overflow-hidden">
            <ProcessBrowser />
          </div>
        ) : isMemoryView ? (
          <div className="flex-1 overflow-hidden">
            <MemoryBrowser />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {isNarrow ? (
              <div className="w-12 flex-shrink-0 border-r border-neutral-800 bg-neutral-900 flex flex-col items-center py-3">
                <span className="text-neutral-400 text-lg">≡</span>
              </div>
            ) : (
              <>
                <div
                  className="flex-shrink-0 overflow-hidden border-r border-neutral-800"
                  style={{ width: `${leftWidth}%` }}
                >
                  <TaskListPanel />
                </div>
                <ResizableDivider onMouseDown={onMouseDown} />
              </>
            )}
            <div className="flex-1 overflow-hidden">
              <DetailPanel />
            </div>
          </div>
        )}
      </div>
  )
}

function TopBar() {
  return (
    <div className="h-16 flex items-center px-4 gap-4 border-b border-neutral-800/80 bg-neutral-950 flex-shrink-0">
      {/* Brand + project */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="4" cy="4" r="2" />
              <circle cx="10" cy="4" r="2" />
              <circle cx="4" cy="10" r="2" />
              <circle cx="10" cy="10" r="2" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">BeadSpec</span>
        </div>
        <div className="w-px h-5 bg-neutral-800" />
        <ProjectSwitcher />
      </div>

      {/* KpiBar — fills middle */}
      <div className="flex-1 flex justify-center">
        <KpiBar />
      </div>

      {/* View switcher + human queue chip + refresh + settings */}
      <ViewSwitcher />
      <BdHumanQueueChip />
      <GitnexusBadge />
      <RefreshButton />
      <HelpButton />
      <SettingsButton />
    </div>
  )
}

function TaskListPanel() {
  const { allTasks, filteredTasks, isLoading } = useTasks()
  const { state } = useAppState()
  const { settings } = useSettings()

  // Focus view: additionally filter to actor's assigned tasks on top of hash filters
  const displayTasks = useMemo(() => {
    if (state.view !== 'focus') return filteredTasks
    const actor = settings.actor?.toLowerCase() ?? ''
    if (!actor) return filteredTasks
    return filteredTasks.filter(t =>
      t.assignee?.toLowerCase() === actor ||
      t.labels.some(l => l === `assignee:${actor}`)
    )
  }, [state.view, filteredTasks, settings.actor])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <FilterBar allTasks={allTasks} visibleTasks={displayTasks} />
      <TaskListItems
        tasks={displayTasks}
        isLoading={isLoading}
        showLineage={state.view === 'ready'}
      />
    </div>
  )
}

function TaskListItems({ tasks, isLoading, showLineage = false }: { tasks: Task[]; isLoading: boolean; showLineage?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useHotkeys('escape', () => setSelectedIds([]), { enabled: selectedIds.length > 0 })

  return (
    <>
      <BulkActionToolbar selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
      <TaskList
        tasks={tasks}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        showLineage={showLineage}
      />
    </>
  )
}

function DetailPanel() {
  return (
    <div className="h-full overflow-hidden">
      <WorkspaceRoot />
    </div>
  )
}

function ResizableDivider({ onMouseDown }: { onMouseDown: () => void }) {
  return (
    <div
      className="w-1 flex-shrink-0 bg-neutral-800/50 hover:bg-blue-500/60 cursor-col-resize transition-colors"
      onMouseDown={onMouseDown}
    />
  )
}

type HealthTab = 'checks' | 'formulas' | 'sessions' | 'reviews'

const HEALTH_TABS: { id: HealthTab; label: string }[] = [
  { id: 'checks',   label: 'Checks' },
  { id: 'formulas', label: 'Formulas' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'reviews',  label: 'Reviews' },
]

function HealthPanel() {
  const { state, setState } = useAppState()
  const project = useActiveProject()
  const activeTab = (state.healthTab ?? 'checks') as HealthTab

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 px-5 border-b border-neutral-800 flex-shrink-0 pt-1">
        {HEALTH_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setState({ healthTab: tab.id })}
            className={[
              'px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'checks'   && <BdHealthPanel />}
        {activeTab === 'formulas' && <FormulasBrowser />}
        {activeTab === 'sessions' && project && <SessionsTab project={project} />}
        {activeTab === 'reviews' && project && <ReviewsHealthTab project={project} />}
      </div>
    </div>
  )
}
