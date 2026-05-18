import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useHotkeys } from 'react-hotkeys-hook'
import { commands, unwrap } from '../../ipc'
import type { Task } from '../../bindings'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigationHistory } from '../../hooks/useNavigationHistory'
import { useActiveProject } from '../../hooks/useProject'
import { useWorkspaceStore } from '../../stores/workspace'
import { TaskListItem, STATUS_BADGE } from './TaskListItem'
import { useAppState } from '../../contexts/HashStateContext'
import { groupTasks, deserializeGroupConfig, type GroupedSection } from '../../lib/filterParser'
import { readGroupBy, writeGroupBy } from '../../stores/layoutStore'
import { useLineageForTask } from '../../hooks/useDependencyLineage'
import { useWorkerFindings } from '../../hooks/useWorkerFindings'
import { TaskLinkChip } from '../common/TaskLinkChip'
import { useDensity } from '../../contexts/DensityContext'
import type { Density } from '../../contexts/DensityContext'
import type { WorkerProvenance } from '../../lib/worker-findings'

const DENSITY_ROW_HEIGHT: Record<Density, number> = {
  compact:     42,
  default:     54,
  comfortable: 66,
}
const DENSITY_LINEAGE_HEIGHT: Record<Density, number> = {
  compact:     78,
  default:     92,
  comfortable: 108,
}

type SortField = 'priority' | 'status' | 'title' | 'updated_at'
type SortDir = 'asc' | 'desc'

// ─── VirtualListItem discriminated union ─────────────────────────────────────

export type VirtualListItem =
  | { type: 'header'; sectionKey: string; label: string; count: number; collapsed: boolean }
  | { type: 'task'; task: Task; flatIndex: number }

export function buildVirtualItems(
  sections: GroupedSection[],
  collapsed: Set<string>,
): VirtualListItem[] {
  const items: VirtualListItem[] = []
  let flatIdx = 0
  for (const section of sections) {
    // Only emit header when there are multiple sections (i.e., grouping is active — label != '')
    // For the flat __all__ section, skip the header entirely.
    if (section.key !== '__all__') {
      items.push({
        type: 'header',
        sectionKey: section.key,
        label: section.label,
        count: section.tasks.length,
        collapsed: collapsed.has(section.key),
      })
    }
    if (!collapsed.has(section.key)) {
      for (const task of section.tasks) {
        items.push({ type: 'task', task, flatIndex: flatIdx++ })
      }
    }
  }
  // For the flat __all__ case (no headers pushed), flatIdx is just linear
  return items
}

// ─── GroupHeaderRow component ─────────────────────────────────────────────────

interface GroupHeaderRowProps {
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
}

export function GroupHeaderRow({ label, count, collapsed, onToggle }: GroupHeaderRowProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full h-full flex items-center gap-2 px-3 bg-neutral-900/60 border-b border-neutral-800/80 border-l-2 border-l-neutral-700/60 hover:bg-neutral-800/60 transition-colors group"
    >
      {/* Chevron */}
      <svg
        className={`w-3 h-3 text-neutral-500 group-hover:text-neutral-400 flex-shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        viewBox="0 0 12 12" fill="currentColor"
      >
        <path d="M6 8L1 3h10L6 8z" />
      </svg>

      {/* Label */}
      <span className="text-xs font-semibold text-neutral-400 capitalize flex-1 text-left truncate">
        {label}
      </span>

      {/* Count badge */}
      <span className="text-[10px] bg-neutral-800 text-neutral-500 border border-neutral-700/50 rounded-full px-1.5 leading-4 flex-shrink-0 tabular-nums">
        {count}
      </span>

      {/* Hidden indicator */}
      {collapsed && count > 0 && (
        <span className="text-[10px] text-neutral-600 flex-shrink-0">
          ({count} hidden)
        </span>
      )}
    </button>
  )
}

// ─── TaskRowLineage ───────────────────────────────────────────────────────────

function TaskRowLineage({ taskId }: { taskId: string }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [unlocksExpanded, setUnlocksExpanded] = useState(false)

  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { unblockedBy, unblocks } = useLineageForTask(taskId, { enabled: inView })
  const hasLineage = unblockedBy.length > 0 || unblocks.length > 0

  return (
    <div ref={rowRef}>
      {hasLineage && (
        <div className="px-3 pb-2 pt-0.5 flex flex-col gap-1 bg-neutral-900/30">
          {unblockedBy.length > 0 && (
            <div className="flex items-start gap-1.5 flex-wrap">
              <span className="text-[10px] text-neutral-600 flex-shrink-0 leading-4 mt-0.5">
                Unblocked by:
              </span>
              {unblockedBy.map(dep => (
                <TaskLinkChip key={dep.id} id={dep.id} title={dep.title} fromTaskId={taskId} />
              ))}
            </div>
          )}

          {unblocks.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                onClick={e => { e.stopPropagation(); setUnlocksExpanded(x => !x) }}
                className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors w-fit"
              >
                <span>Unblocks: {unblocks.length} task{unblocks.length !== 1 ? 's' : ''}</span>
                <svg
                  className={`w-2.5 h-2.5 transition-transform ${unlocksExpanded ? 'rotate-90' : ''}`}
                  viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                >
                  <path d="M3 2l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {unlocksExpanded && (
                <div className="flex items-start gap-1.5 flex-wrap pl-1">
                  {unblocks.map(dep => (
                    <TaskLinkChip key={dep.id} id={dep.id} title={dep.title} fromTaskId={taskId} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TaskList component ───────────────────────────────────────────────────────

interface TaskListProps {
  tasks: Task[]
  isLoading?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  showLineage?: boolean
}

const STATUSES = ['open', 'in_progress', 'blocked', 'closed']

export function TaskList({ tasks, isLoading, selectedIds = [], onSelectionChange, showLineage = false }: TaskListProps) {
  const { openPreview, openPinned } = useWorkspaceStore()
  const { clearHistory } = useNavigationHistory()
  const project = useActiveProject()
  const queryClient = useQueryClient()
  const { state, setState } = useAppState()
  const { density } = useDensity()
  const { data: workerFindings = [] } = useWorkerFindings(project)

  const [sortField, setSortField] = useState<SortField>('priority')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [lastClickedFlatIdx, setLastClickedFlatIdx] = useState<number | null>(null)
  const [focusedFlatIdx, setFocusedFlatIdx] = useState<number | null>(null)
  const [quickStatusFlatIdx, setQuickStatusFlatIdx] = useState<number | null>(null)

  // Collapse state: Set of collapsed section keys (local, not persisted to URL)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const parentRef = useRef<HTMLDivElement>(null)

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => [...tasks].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortField === 'priority') return (a.priority - b.priority) * dir
    if (sortField === 'title') return a.title.localeCompare(b.title) * dir
    if (sortField === 'status') return a.status.localeCompare(b.status) * dir
    return a.updated_at.localeCompare(b.updated_at) * dir
  }), [tasks, sortField, sortDir])

  // ── Grouping ─────────────────────────────────────────────────────────────────
  const groupConfig = useMemo(
    () => deserializeGroupConfig(state.groupBy),
    [state.groupBy],
  )

  const sections = useMemo(
    () => groupTasks(sorted, groupConfig),
    [sorted, groupConfig],
  )

  // Apply sort within each section independently (sections already have tasks from sorted array
  // so they're already sorted — groupTasks preserves input order)
  const virtualItems = useMemo(
    () => buildVirtualItems(sections, collapsed),
    [sections, collapsed],
  )

  // Flat task list from visible items only (used for keyboard navigation bounds)
  const visibleTasks = useMemo(
    () => virtualItems.filter((vi): vi is Extract<VirtualListItem, { type: 'task' }> => vi.type === 'task'),
    [virtualItems],
  )

  const workerProvenanceByIssue = useMemo(() => {
    const map = new Map<string, WorkerProvenance>()
    for (const finding of workerFindings) {
      map.set(finding.issue_id, {
        worker: finding.worker,
        firstLine: finding.notes_first_line,
      })
    }
    return map
  }, [workerFindings])

  // ── Tauri store persistence: task 3.3 (on mount, read stored groupBy) ───────
  useEffect(() => {
    if (state.groupBy != null) return  // hash wins
    readGroupBy().then(stored => {
      if (stored) setState({ groupBy: stored })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tauri store persistence: task 3.4 (write on groupBy change) ─────────────
  const prevGroupByRef = useRef(state.groupBy)
  useEffect(() => {
    if (prevGroupByRef.current === state.groupBy) return
    prevGroupByRef.current = state.groupBy
    writeGroupBy(state.groupBy ?? null)  // fire-and-forget
  }, [state.groupBy])

  // ── Collapse toggle ───────────────────────────────────────────────────────────
  const toggleCollapse = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const sectionKeys = useMemo(
    () => sections.filter(s => s.key !== '__all__').map(s => s.key),
    [sections],
  )
  const hasCollapsed = sectionKeys.some(k => collapsed.has(k))

  const toggleExpandCollapseAll = useCallback(() => {
    if (hasCollapsed) {
      setCollapsed(new Set())
    } else {
      setCollapsed(new Set(sectionKeys))
    }
  }, [hasCollapsed, sectionKeys])

  // ── Virtualizer ───────────────────────────────────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = virtualItems[index]
      if (item?.type === 'header') return 36
      return showLineage ? DENSITY_LINEAGE_HEIGHT[density] : DENSITY_ROW_HEIGHT[density]
    },
    measureElement: showLineage ? (el) => el.getBoundingClientRect().height : undefined,
    overscan: 5,
  })

  useEffect(() => { rowVirtualizer.measure() }, [density, showLineage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard navigation (operates on flatIndex, skips headers) ───────────────
  useHotkeys('j', () => {
    setFocusedFlatIdx(i => {
      const next = i === null ? 0 : Math.min(i + 1, visibleTasks.length - 1)
      // Find the virtual index for this flat index to scroll to it
      const vIdx = virtualItems.findIndex(vi => vi.type === 'task' && vi.flatIndex === next)
      if (vIdx >= 0) rowVirtualizer.scrollToIndex(vIdx)
      return next
    })
  }, { enableOnFormTags: false })

  useHotkeys('k', () => {
    setFocusedFlatIdx(i => {
      const next = i === null ? 0 : Math.max(i - 1, 0)
      const vIdx = virtualItems.findIndex(vi => vi.type === 'task' && vi.flatIndex === next)
      if (vIdx >= 0) rowVirtualizer.scrollToIndex(vIdx)
      return next
    })
  }, { enableOnFormTags: false })

  useHotkeys('down', (e) => {
    e.preventDefault()
    setFocusedFlatIdx(i => {
      const next = i === null ? 0 : Math.min(i + 1, visibleTasks.length - 1)
      const vIdx = virtualItems.findIndex(vi => vi.type === 'task' && vi.flatIndex === next)
      if (vIdx >= 0) rowVirtualizer.scrollToIndex(vIdx)
      const taskItem = visibleTasks[next]
      if (taskItem) { clearHistory(); openPreview(taskItem.task.id) }
      return next
    })
  }, { enableOnFormTags: false })

  useHotkeys('up', (e) => {
    e.preventDefault()
    setFocusedFlatIdx(i => {
      const next = i === null ? 0 : Math.max(i - 1, 0)
      const vIdx = virtualItems.findIndex(vi => vi.type === 'task' && vi.flatIndex === next)
      if (vIdx >= 0) rowVirtualizer.scrollToIndex(vIdx)
      const taskItem = visibleTasks[next]
      if (taskItem) { clearHistory(); openPreview(taskItem.task.id) }
      return next
    })
  }, { enableOnFormTags: false })

  useHotkeys('enter', () => {
    if (focusedFlatIdx === null) return
    const taskItem = visibleTasks[focusedFlatIdx]
    if (taskItem) { clearHistory(); openPinned(taskItem.task.id) }
  }, { enableOnFormTags: false, enabled: focusedFlatIdx !== null })

  useHotkeys('space', (e) => {
    e.preventDefault()
    setQuickStatusFlatIdx(focusedFlatIdx)
  }, { enableOnFormTags: false, enabled: focusedFlatIdx !== null })

  useHotkeys('escape', () => setQuickStatusFlatIdx(null), { enabled: quickStatusFlatIdx !== null })

  useHotkeys('/', (e) => {
    e.preventDefault()
    document.getElementById('filter-search')?.focus()
  }, { enableOnFormTags: false })

  // ── Sort handler ──────────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // ── Row click: uses flatIndex for shift-click (task 4.6) ──────────────────────
  const handleRowClick = useCallback((task: Task, flatIndex: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedFlatIdx !== null && onSelectionChange) {
      const lo = Math.min(flatIndex, lastClickedFlatIdx)
      const hi = Math.max(flatIndex, lastClickedFlatIdx)
      const rangeIds = visibleTasks
        .filter(vi => vi.flatIndex >= lo && vi.flatIndex <= hi)
        .map(vi => vi.task.id)
      onSelectionChange([...new Set([...selectedIds, ...rangeIds])])
    } else {
      clearHistory()
      openPreview(task.id)
      setLastClickedFlatIdx(flatIndex)
      setFocusedFlatIdx(flatIndex)
    }
  }, [lastClickedFlatIdx, visibleTasks, selectedIds, onSelectionChange, openPreview, clearHistory])

  const handleRowDoubleClick = useCallback((task: Task) => {
    clearHistory()
    openPinned(task.id)
  }, [openPinned, clearHistory])

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      <span className="ml-1 text-blue-400 text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
    ) : <span className="ml-1 text-neutral-700 text-[10px]">↕</span>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sort header */}
      <div className="flex items-center px-3 py-2 border-b border-neutral-800/60 bg-neutral-900/40 flex-shrink-0">
        {groupConfig !== null ? (
          <button
            onClick={toggleExpandCollapseAll}
            title={hasCollapsed ? 'Expand all' : 'Collapse all'}
            className="w-4 mr-2 flex-shrink-0 flex items-center justify-center text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor">
              {/* upper chevron — points up (expand) or down (collapse) */}
              <path d={hasCollapsed ? 'M7 1L2 6h10L7 1z' : 'M7 6L2 2h10L7 6z'} />
              {/* lower chevron — points down (expand) or up (collapse) */}
              <path d={hasCollapsed ? 'M7 13L2 8h10L7 13z' : 'M7 8L2 12h10L7 8z'} />
            </svg>
          </button>
        ) : (
          <div className="w-4 mr-2 flex-shrink-0" />
        )}
        <button onClick={() => handleSort('title')} className="flex-1 text-left text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
          Title <SortIcon field="title" />
        </button>
        <button onClick={() => handleSort('status')} className="w-20 text-left text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
          Status <SortIcon field="status" />
        </button>
        <button onClick={() => handleSort('priority')} className="w-8 text-right text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
          P <SortIcon field="priority" />
        </button>
      </div>

      {/* Virtualized list */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const item = virtualItems[virtualRow.index]

            return (
              <div
                key={item.type === 'header' ? `header-${item.sectionKey}` : item.task.id}
                data-index={virtualRow.index}
                ref={showLineage ? rowVirtualizer.measureElement : undefined}
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  left: 0, right: 0,
                  ...(showLineage ? {} : { height: virtualRow.size }),
                }}
              >
                {item.type === 'header' ? (
                  <GroupHeaderRow
                    label={item.label}
                    count={item.count}
                    collapsed={item.collapsed}
                    onToggle={() => toggleCollapse(item.sectionKey)}
                  />
                ) : (
                  <div className="relative w-full border-b border-neutral-800/40">
                    <div style={{ height: 54 }}>
                      <TaskListItem
                        task={item.task}
                        provenance={workerProvenanceByIssue.get(item.task.id) ?? null}
                        isActive={(() => {
                          const { root: r, activePaneId: ap } = useWorkspaceStore.getState()
                          return r.kind === 'leaf' && r.activeTabId === item.task.id && r.id === ap
                        })()}
                        isFocused={focusedFlatIdx === item.flatIndex}
                        isSelected={selectedIds.includes(item.task.id)}
                        onClick={e => handleRowClick(item.task, item.flatIndex, e)}
                        onDoubleClick={() => handleRowDoubleClick(item.task)}
                      />
                    </div>

                    {showLineage && <TaskRowLineage taskId={item.task.id} />}

                    {/* Quick status picker (Space) */}
                    {quickStatusFlatIdx === item.flatIndex && (
                      <div className="absolute inset-0 bg-neutral-950/96 backdrop-blur-sm flex items-center gap-1.5 px-3 z-10 border-l-2 border-l-blue-500">
                        {STATUSES.map(s => (
                          <button
                            key={s}
                            onClick={() => {
                              if (project) {
                                unwrap(commands.changeTaskStatus(project, item.task.id, s, false))
                                  .then(() => queryClient.invalidateQueries({ queryKey: ['tasks', project] }))
                              }
                              setQuickStatusFlatIdx(null)
                            }}
                            className={`text-xs px-2 py-1 rounded-md font-medium ${STATUS_BADGE[s]} hover:opacity-90 transition-opacity`}
                          >
                            {s.replace('_', ' ')}
                          </button>
                        ))}
                        <button
                          onClick={() => setQuickStatusFlatIdx(null)}
                          className="ml-auto text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
                        >
                          esc
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {sorted.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <svg className="w-8 h-8 text-neutral-800" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="6" width="24" height="4" rx="2" />
              <rect x="4" y="14" width="16" height="4" rx="2" />
              <rect x="4" y="22" width="20" height="4" rx="2" />
            </svg>
            <span className="text-neutral-600 text-sm">No tasks match the current filters</span>
          </div>
        )}
      </div>
    </div>
  )
}
