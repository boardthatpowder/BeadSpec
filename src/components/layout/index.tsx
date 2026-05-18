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
import { useSettings } from '../../contexts/SettingsContext'
import { useActiveProject } from '../../hooks/useProject'
import { useThemeEffect } from '../../lib/theme'
import type { Task } from '../../bindings'
import { Icon } from '../ui/Icon'
import { Tabs } from '../ui/Tabs'

export function AppLayout() {
  const [leftWidth, setLeftWidth] = useState(30)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 800)
  const dragging = useRef(false)
  const { state } = useAppState()
  const { settings } = useSettings()
  useThemeEffect(settings.theme)

  // Task 9.2 — mount workspace shortcuts once at the layout root.
  useWorkspaceShortcuts()

  useEffect(() => {
    // Task 8.1 — init workspace persistence on mount (loads from layout.json + seeds from hash).
    initWorkspacePersistence()
    load('layout.json')
      .then(store => store.get<number>('pane-left-width'))
      .then(val => { if (val != null) setLeftWidth(val) })
      .catch(() => { /* intentionally silent: default layout width is acceptable */ })
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

  const openspecEnabled = settings.features.openspec
  const isHealthView = state.view === 'health'
  const isChangesView = state.view === 'changes'
  const isActivityView = state.view === 'activity'
  const isProcessesView = state.view === 'processes'
  const isMemoryView = state.view === 'memory'

  if (!isLoaded) return <div className="h-screen w-screen bg-[--color-bg]" />

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-[--color-bg] text-[--color-fg]"
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
              <div className="w-12 flex-shrink-0 border-r border-[--color-border] bg-[--color-surface] flex flex-col items-center py-3">
                <span className="text-[--color-fg-muted] text-lg">≡</span>
              </div>
            ) : (
              <>
                <div
                  className="flex-shrink-0 overflow-hidden border-r border-[--color-border]"
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
    <div className="flex-shrink-0 border-b border-[--color-border]/80 bg-[--color-bg]">
      <div className="flex min-h-12 items-center gap-3 px-4 py-2">
        {/* Brand + project */}
        <div className="flex min-w-0 items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <Icon name="Grid2X2" size="sm" className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">BeadSpec</span>
          </div>
          <div className="w-px h-5 bg-[--color-surface-hi]" />
          <ProjectSwitcher />
        </div>

        {/* KpiBar — fills middle */}
        <div className="min-w-0 flex-1">
          <KpiBar />
        </div>

        {/* Human queue chip + refresh + settings */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <BdHumanQueueChip />
          <GitnexusBadge />
          <RefreshButton />
          <HelpButton />
          <SettingsButton />
        </div>
      </div>
      <div className="border-t border-[--color-border] px-4 py-1.5">
        <ViewSwitcher />
      </div>
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
      className="w-1 flex-shrink-0 bg-[--color-surface-hi]/50 hover:bg-blue-500/60 cursor-col-resize transition-colors"
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
      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => setState({ healthTab: value as HealthTab })}
        className="h-full flex flex-col overflow-hidden"
      >
        <Tabs.List className="flex-shrink-0 gap-0 px-5 pt-1">
          {HEALTH_TABS.map(tab => (
            <Tabs.Trigger key={tab.id} value={tab.id} className="px-4 py-2 text-xs font-medium">
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Tab content */}
        <Tabs.Content value="checks" className="flex-1 overflow-hidden">
          <BdHealthPanel />
        </Tabs.Content>
        <Tabs.Content value="formulas" className="flex-1 overflow-hidden">
          <FormulasBrowser />
        </Tabs.Content>
        <Tabs.Content value="sessions" className="flex-1 overflow-hidden">
          {project && <SessionsTab project={project} />}
        </Tabs.Content>
        <Tabs.Content value="reviews" className="flex-1 overflow-hidden">
          {project && <ReviewsHealthTab project={project} />}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
