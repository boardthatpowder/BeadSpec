import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useHotkeys } from 'react-hotkeys-hook'
import { commands, unwrap } from '../../ipc'
import type { Task } from '../../bindings'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigationHistory } from '../../hooks/useNavigationHistory'
import { useActiveProject } from '../../hooks/useProject'
import { useWorkspaceStore } from '../../stores/workspace'
import { TaskListItem } from './TaskListItem'
import { StatusPill } from '../ui/StatusPill'
import { EmptyState } from '../ui/EmptyState'
import { useAppState } from '../../contexts/HashStateContext'
import { groupTasks, deserializeGroupConfig, type GroupedSection } from '../../lib/filterParser'
import { readGroupBy, writeGroupBy } from '../../stores/layoutStore'
import { useLineageForTask } from '../../hooks/useDependencyLineage'
import { TaskLinkChip } from '../common/TaskLinkChip'
import { useDensity } from '../../contexts/DensityContext'
import type { Density } from '../../contexts/DensityContext'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'

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
    <Button
      variant="ghost"
      size="md"
      onClick={onToggle}
      className="group h-full w-full justify-start gap-2 rounded-none border-0 border-b border-l-2 border-(--color-border)/80 border-l-neutral-700/60 bg-(--color-surface)/60 px-3 font-normal hover:bg-(--color-surface-hi)/60"
    >
      <Icon
        name="ChevronDown"
        size="sm"
        className={`h-3 w-3 text-(--color-fg-subtle) group-hover:text-(--color-fg-muted) flex-shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`}
      />

      {/* Label */}
      <span className="text-xs font-semibold text-(--color-fg-muted) capitalize flex-1 text-left truncate">
        {label}
      </span>

      {/* Count badge */}
      <span className="text-[10px] bg-(--color-surface-hi) text-(--color-fg-subtle) border border-(--color-border-strong)/50 rounded-full px-1.5 leading-4 flex-shrink-0 tabular-nums">
        {count}
      </span>

      {/* Hidden indicator */}
      {collapsed && count > 0 && (
        <span className="text-[10px] text-(--color-fg-subtle) flex-shrink-0">
          ({count} hidden)
        </span>
      )}
    </Button>
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
        <div className="px-3 pb-2 pt-0.5 flex flex-col gap-1 bg-(--color-surface)/30">
          {unblockedBy.length > 0 && (
            <div className="flex items-start gap-1.5 flex-wrap">
              <span className="text-[10px] text-(--color-fg-subtle) flex-shrink-0 leading-4 mt-0.5">
                Unblocked by:
              </span>
              {unblockedBy.map(dep => (
                <TaskLinkChip key={dep.id} id={dep.id} title={dep.title} fromTaskId={taskId} />
              ))}
            </div>
          )}

          {unblocks.length > 0 && (
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={e => { e.stopPropagation(); setUnlocksExpanded(x => !x) }}
                className="h-auto w-fit border-0 bg-transparent px-0 py-0 text-[10px] font-normal text-(--color-fg-subtle) hover:bg-transparent hover:text-(--color-fg-muted)"
              >
                <span>Unblocks: {unblocks.length} task{unblocks.length !== 1 ? 's' : ''}</span>
                <Icon
                  name="ChevronRight"
                  size="sm"
                  className={`h-2.5 w-2.5 transition-transform ${unlocksExpanded ? 'rotate-90' : ''}`}
                />
              </Button>
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

  const sortLabel = (field: SortField) => {
    const labels: Record<SortField, string> = {
      title: 'Title',
      status: 'Status',
      priority: 'Priority',
      updated_at: 'Updated',
    }
    const direction = sortField === field && sortDir === 'asc' ? 'descending' : 'ascending'
    return `Sort ${labels[field]} ${direction}`
  }

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      <Icon
        name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'}
        size="sm"
        className="ml-1 inline h-2.5 w-2.5 text-blue-400"
      />
    ) : (
      <Icon name="ArrowUpDown" size="sm" className="ml-1 inline h-2.5 w-2.5 text-neutral-700" />
    )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sort header */}
      <div className="flex items-center px-3 py-2 border-b border-(--color-border)/60 bg-(--color-surface)/40 flex-shrink-0">
        {groupConfig !== null ? (
          <IconButton
            label={hasCollapsed ? 'Expand all' : 'Collapse all'}
            onClick={toggleExpandCollapseAll}
            className="mr-2 h-auto w-4 flex-shrink-0 border-0 bg-transparent px-0 py-0 text-(--color-fg-subtle) hover:bg-transparent hover:text-(--color-fg-muted)"
          >
            <Icon
              name={hasCollapsed ? 'ChevronsUpDown' : 'ChevronsDownUp'}
              size="sm"
              className="h-3.5 w-3.5"
            />
          </IconButton>
        ) : (
          <div className="w-4 mr-2 flex-shrink-0" />
        )}
        <Button
          variant="ghost"
          size="xs"
          aria-label={sortLabel('title')}
          onClick={() => handleSort('title')}
          className="h-auto flex-1 justify-start rounded-none border-0 bg-transparent px-0 py-0 text-left text-xs font-normal text-(--color-fg-subtle) hover:bg-transparent hover:text-(--color-fg-muted)"
        >
          Title <SortIcon field="title" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          aria-label={sortLabel('status')}
          onClick={() => handleSort('status')}
          className="h-auto w-20 justify-start rounded-none border-0 bg-transparent px-0 py-0 text-left text-xs font-normal text-(--color-fg-subtle) hover:bg-transparent hover:text-(--color-fg-muted)"
        >
          Status <SortIcon field="status" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          aria-label={sortLabel('priority')}
          onClick={() => handleSort('priority')}
          className="h-auto w-8 justify-end rounded-none border-0 bg-transparent px-0 py-0 text-right text-xs font-normal text-(--color-fg-subtle) hover:bg-transparent hover:text-(--color-fg-muted)"
        >
          P <SortIcon field="priority" />
        </Button>
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
                  <div className="relative w-full border-b border-(--color-border)/40">
                    <div style={{ height: 54 }}>
                      <TaskListItem
                        task={item.task}
                        provenance={item.task.worker_provenance
                          ? {
                              worker: item.task.worker_provenance.worker,
                              firstLine: item.task.worker_provenance.notes_first_line,
                            }
                          : null}
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
                      <div className="absolute inset-0 bg-(--color-bg)/96 backdrop-blur-sm flex items-center gap-1.5 px-3 z-10">
                        {STATUSES.map(s => (
                          <Button
                            key={s}
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              if (project) {
                                unwrap(commands.changeTaskStatus(project, item.task.id, s, false))
                                  .then(() => queryClient.invalidateQueries({ queryKey: ['tasks', project] }))
                              }
                              setQuickStatusFlatIdx(null)
                            }}
                            className="h-auto border-0 p-0 hover:opacity-90 transition-opacity"
                          >
                            <StatusPill status={s} />
                          </Button>
                        ))}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setQuickStatusFlatIdx(null)}
                          className="ml-auto h-auto border-0 bg-transparent px-0 py-0 text-[10px] font-normal text-(--color-fg-subtle) hover:bg-transparent hover:text-(--color-fg-muted)"
                        >
                          esc
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {sorted.length === 0 && !isLoading && (
          <EmptyState
            icon={<Icon name="Search" size="sm" />}
            title="No tasks match"
            description="Try adjusting your filters or search query."
          />
        )}
      </div>
    </div>
  )
}
