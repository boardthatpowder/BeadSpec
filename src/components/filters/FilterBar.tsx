import { useState, useEffect, useLayoutEffect, useRef, useMemo, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from '../ui/IconButton'
import { Tooltip } from '../ui/Tooltip'
import {
  parseFilterDimensions,
  detectDimensionGroups,
  countsExcludingDim,
  serializeGroupConfig,
  deserializeGroupConfig,
  type GroupConfig,
  type FilterDimension,
} from '../../lib/filterParser'
import { useAppState } from '../../contexts/HashStateContext'
import { useWorkspaceContext } from '../../hooks/useProject'
import { useFeatureFlag } from '../../contexts/SettingsContext'
import type { Task } from '../../bindings'

// ─── Structural label prefixes excluded from grouping sub-menu ────────────────
const STRUCTURAL_PREFIXES = new Set(['worker'])

function Popover({
  anchorRef,
  open,
  onClose,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const reposition = () => {
      const anchor = anchorRef.current
      const popover = popoverRef.current
      if (!anchor || !popover) return
      const rect = anchor.getBoundingClientRect()
      const pw = popover.offsetWidth
      const left = Math.min(rect.left, window.innerWidth - pw - 8)
      popover.style.top = `${rect.bottom + 6}px`
      popover.style.left = `${Math.max(8, left)}px`
    }
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, { capture: true })
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, { capture: true })
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !anchorRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, anchorRef, onClose])

  if (!open) return null
  return createPortal(
    <div ref={popoverRef} style={{ position: 'fixed', zIndex: 9999 }}>
      {children}
    </div>,
    document.body
  )
}

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'closed',      label: 'Closed' },
]
const PRIORITY_OPTIONS = [
  { value: '1', label: 'P1 Critical' },
  { value: '2', label: 'P2 High' },
  { value: '3', label: 'P3 Medium' },
  { value: '4', label: 'P4 Low' },
]

// Colors per cluster name for chips
const CLUSTER_CHIP_COLORS: Record<string, string> = {
  Git:      'bg-violet-900/50 text-violet-300 border-violet-700/50',
  Workflow: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  People:   'bg-teal-900/50 text-teal-300 border-teal-700/50',
  Triage:   'bg-rose-900/50 text-rose-300 border-rose-700/50',
  '':       'bg-neutral-800/80 text-neutral-300 border-neutral-700/50',
}

// Determine which cluster a dimension key belongs to
const SEMANTIC_CLUSTERS: Array<{ name: string; keywords: string[] }> = [
  { name: 'Git',      keywords: ['branch', 'repo', 'worktree', 'remote', 'commit', 'tag'] },
  { name: 'Workflow', keywords: ['openspec', 'area', 'audit', 'sprint', 'milestone', 'phase'] },
  { name: 'People',   keywords: ['worker', 'assignee', 'team', 'owner', 'ruflo'] },
  { name: 'Triage',   keywords: ['duplicate', 'followup', 'wontfix', 'invalid'] },
]

function getClusterForDim(key: string): string {
  const k = key.toLowerCase()
  for (const c of SEMANTIC_CLUSTERS) {
    if (c.keywords.some(kw => k.includes(kw))) return c.name
  }
  return ''
}

// ─── GroupByDropdown ─────────────────────────────────────────────────────────

const GROUP_BY_FIELD_OPTIONS = [
  { value: 'field:status',    label: 'Status' },
  { value: 'field:priority',  label: 'Priority' },
  { value: 'field:assignee',  label: 'Assignee' },
  { value: 'field:task_type', label: 'Type' },
] as const

function getGroupByLabel(config: GroupConfig): string {
  if (config === null) return 'Group'
  if (config.type === 'field') {
    const opt = GROUP_BY_FIELD_OPTIONS.find(o => o.value === `field:${config.field}`)
    return opt?.label ?? 'Group'
  }
  if (config.type === 'label-prefix') return config.prefix
  return 'Group'
}

interface GroupByDropdownProps {
  allTasks: Task[]
  visibleTasks: Task[]
}

function GroupByDropdown({ allTasks, visibleTasks }: GroupByDropdownProps) {
  const { state, setState } = useAppState()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const config = deserializeGroupConfig(state.groupBy)
  const isActive = config !== null

  // Derive all label-prefix options from allTasks; eligibility from visibleTasks
  const allLabels = useMemo(() => allTasks.flatMap(t => t.labels), [allTasks])
  const { dimensions: allDimensions } = useMemo(() => parseFilterDimensions(allLabels), [allLabels])
  const allLabelPrefixes = useMemo(
    () => allDimensions
      .filter(d => d.isStructured && !STRUCTURAL_PREFIXES.has(d.key))
      .map(d => d.key)
      .sort(),
    [allDimensions],
  )
  const visibleLabels = useMemo(() => visibleTasks.flatMap(t => t.labels), [visibleTasks])
  const { dimensions: visibleDimensions } = useMemo(() => parseFilterDimensions(visibleLabels), [visibleLabels])
  const visibleLabelPrefixSet = useMemo(
    () => new Set(visibleDimensions.filter(d => d.isStructured && !STRUCTURAL_PREFIXES.has(d.key)).map(d => d.key)),
    [visibleDimensions],
  )

  // Per-option eligibility for field groupings
  const fieldEligibility = useMemo(() => {
    const hasAssignee = visibleTasks.some(t => t.assignee != null && t.assignee !== '')
    const taskTypes = new Set(visibleTasks.map(t => t.task_type).filter(Boolean))
    return {
      'field:status':    true,
      'field:priority':  true,
      'field:assignee':  hasAssignee,
      'field:task_type': taskTypes.size > 1,
    } as Record<string, boolean>
  }, [visibleTasks])

  const selectConfig = (next: GroupConfig) => {
    setState({ groupBy: serializeGroupConfig(next) })
    setOpen(false)
  }

  return (
    <div ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
          isActive
            ? 'border-emerald-500/70 text-emerald-300 bg-emerald-900/20'
            : 'border-neutral-700/50 text-neutral-400 hover:border-neutral-500 hover:text-neutral-300 bg-neutral-800/20',
        ].join(' ')}
      >
        {/* Group icon */}
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 4h12M2 8h8M2 12h5" strokeLinecap="round" />
        </svg>
        <span>Group</span>
        {isActive && (
          <span className="bg-emerald-500 text-white rounded-full px-1.5 text-[10px] font-semibold leading-4">
            {getGroupByLabel(config)}
          </span>
        )}
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12" fill="currentColor"
        >
          <path d="M6 8L1 3h10L6 8z" />
        </svg>
      </button>

      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)}>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl py-1.5 min-w-44">
          {/* None option */}
          <button
            onClick={() => selectConfig(null)}
            className={[
              'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
              config === null
                ? 'text-emerald-300 bg-emerald-900/20'
                : 'text-neutral-300 hover:bg-neutral-800/40',
            ].join(' ')}
          >
            <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${config === null ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-600'}`}>
              {config === null && (
                <svg viewBox="0 0 10 10" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span>None</span>
          </button>

          {/* Divider: By field */}
          <div className="mx-3 my-1 border-t border-neutral-800/60" />
          <div className="px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">By field</span>
          </div>
          {[...GROUP_BY_FIELD_OPTIONS].sort((a, b) => {
            const selA = config?.type === 'field' && `field:${config.field}` === a.value
            const selB = config?.type === 'field' && `field:${config.field}` === b.value
            const ea = (fieldEligibility[a.value] || selA) ? 0 : 1
            const eb = (fieldEligibility[b.value] || selB) ? 0 : 1
            return ea - eb
          }).map(opt => {
            const isSelected = config?.type === 'field' && `field:${config.field}` === opt.value
            const eligible = fieldEligibility[opt.value]
            const isDisabled = !eligible && !isSelected
            return (
              <button
                key={opt.value}
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return
                  if (isSelected) selectConfig(null)
                  else selectConfig(deserializeGroupConfig(opt.value) as GroupConfig)
                }}
                className={[
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                  isSelected
                    ? 'text-emerald-300 bg-emerald-900/20'
                    : eligible
                      ? 'text-neutral-300 hover:bg-neutral-800/40'
                      : 'text-neutral-700 cursor-not-allowed opacity-50',
                ].join(' ')}
              >
                <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-600'}`}>
                  {isSelected && (
                    <svg viewBox="0 0 10 10" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span>{opt.label}</span>
              </button>
            )
          })}

          {/* Divider: By label prefix */}
          <div className="mx-3 my-1 border-t border-neutral-800/60" />
          <div className="px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">By label prefix</span>
          </div>
          {allLabelPrefixes.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-neutral-600 cursor-not-allowed opacity-50">
              No label prefixes found
            </div>
          ) : (
            [...allLabelPrefixes].sort((a, b) => {
              const selA = config?.type === 'label-prefix' && config.prefix === a
              const selB = config?.type === 'label-prefix' && config.prefix === b
              const ea = (visibleLabelPrefixSet.has(a) || selA) ? 0 : 1
              const eb = (visibleLabelPrefixSet.has(b) || selB) ? 0 : 1
              return ea - eb || a.localeCompare(b)
            }).map(prefix => {
              const isSelected = config?.type === 'label-prefix' && config.prefix === prefix
              const eligible = visibleLabelPrefixSet.has(prefix)
              const isDisabled = !eligible && !isSelected
              return (
                <button
                  key={prefix}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return
                    if (isSelected) selectConfig(null)
                    else selectConfig({ type: 'label-prefix', prefix })
                  }}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                    isSelected
                      ? 'text-emerald-300 bg-emerald-900/20'
                      : eligible
                        ? 'text-neutral-300 hover:bg-neutral-800/40'
                        : 'text-neutral-700 cursor-not-allowed opacity-50',
                  ].join(' ')}
                >
                  <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-600'}`}>
                    {isSelected && (
                      <svg viewBox="0 0 10 10" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="font-mono">{prefix}</span>
                </button>
              )
            })
          )}
        </div>
      </Popover>
    </div>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  allTasks: Task[]
  visibleTasks: Task[]
}

export function FilterBar({ allTasks, visibleTasks }: FilterBarProps) {
  const { state, setState } = useAppState()
  const activeFilters: Record<string, string[] | string> = state.filters ?? {}
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)
  const workspaceContext = useWorkspaceContext()
  const rufloEnabled = useFeatureFlag('ruflo')

  // workspaceScope: 'on' unless explicitly set to 'off' in hash
  const workspaceScope = state.workspaceScope === 'off' ? 'off' : 'on'
  const toggleWorkspaceScope = () => {
    setState({ workspaceScope: workspaceScope === 'on' ? 'off' : undefined })
  }

  // All possible label-prefix dimensions (from all tasks)
  const allLabels = useMemo(() => allTasks.flatMap(t => t.labels), [allTasks])
  const { dimensions: rawDimensions } = useMemo(() => parseFilterDimensions(allLabels), [allLabels])
  const dimensions = useMemo(
    () => rufloEnabled ? rawDimensions : rawDimensions.filter(d => !d.key.toLowerCase().includes('ruflo')),
    [rawDimensions, rufloEnabled],
  )
  const groups = useMemo(() => detectDimensionGroups(dimensions), [dimensions])


  const toggle = (dim: string, value: string) => {
    const raw = activeFilters[dim]
    const current: string[] = Array.isArray(raw) ? raw : []
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    const updated: Record<string, string[] | string> = { ...activeFilters }
    if (next.length) updated[dim] = next
    else delete updated[dim]
    setState({ filters: updated })
  }

  const removeChip = (dim: string, value: string) => toggle(dim, value)
  const clearAll = () => setState({ filters: {}, groupBy: null })
  const groupByConfig = deserializeGroupConfig(state.groupBy)

  const searchValue = typeof activeFilters.search === 'string' ? activeFilters.search : ''

  // Secondary (label) active filters — for chips strip
  const secondaryActive = useMemo(() => {
    const chips: Array<{ dim: string; value: string; cluster: string }> = []
    for (const [dim, vals] of Object.entries(activeFilters)) {
      if (dim === 'search' || dim === 'status' || dim === 'priority') continue
      if (Array.isArray(vals)) {
        for (const v of vals) {
          chips.push({ dim, value: v, cluster: getClusterForDim(dim) })
        }
      }
    }
    return chips
  }, [activeFilters])

  // Count of active secondary filter dimensions (not values)
  const activeSecondaryDimCount = useMemo(() => {
    return Object.keys(activeFilters).filter(
      k => k !== 'search' && k !== 'status' && k !== 'priority' &&
           Array.isArray(activeFilters[k]) && (activeFilters[k] as string[]).length > 0
    ).length
  }, [activeFilters])

  return (
    <div className="flex-shrink-0 border-b border-neutral-800">
      {/* Row A: Scope + Search */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
        {/* Workspace scope chip — leftmost, only shown for git projects */}
        {workspaceContext !== null && (
          <Tooltip
            label="Workspace scope"
            description={workspaceScope === 'on'
              ? `Active: ${workspaceContext.label_branch}, ${workspaceContext.label_worktree}, ${workspaceContext.label_repo}`
              : 'Off — showing all tasks'
            }
          >
            <button
              onClick={toggleWorkspaceScope}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors flex-shrink-0',
                workspaceScope === 'on'
                  ? 'bg-blue-900/30 text-blue-300 border-blue-500/60 hover:bg-blue-900/50'
                  : 'bg-blue-900/10 text-blue-400/50 border-blue-700/30 opacity-50 hover:opacity-70',
              ].join(' ')}
            >
              {/* Scope icon */}
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" />
                <circle cx="8" cy="8" r="2" />
                <path d="M8 2v2M8 12v2M2 8h2M12 8h2" strokeLinecap="round" />
              </svg>
              <span className={workspaceScope === 'off' ? 'line-through' : ''}>
                Workspace scope
              </span>
            </button>
          </Tooltip>
        )}

        {/* Search */}
        <div className="flex flex-1 items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-800/40 border border-neutral-700/50 focus-within:border-neutral-500 transition-colors">
          <svg className="w-3 h-3 text-neutral-500 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l3 3" strokeLinecap="round" />
          </svg>
          <input
            id="filter-search"
            placeholder="Search…"
            value={searchValue}
            onChange={e => {
              const updated: Record<string, string[] | string> = { ...activeFilters }
              if (e.target.value) updated.search = e.target.value
              else delete updated.search
              setState({ filters: updated })
            }}
            className="bg-transparent text-xs text-neutral-300 placeholder-neutral-600 outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      {/* Row B: Dropdowns + Clear */}
      <div className="flex items-center gap-1.5 px-3 py-2">
        {/* Status */}
        <FilterPill
          label="Status"
          options={STATUS_OPTIONS}
          active={Array.isArray(activeFilters.status) ? activeFilters.status as string[] : []}
          onToggle={v => toggle('status', v)}
          counts={countsExcludingDim(allTasks, activeFilters, 'status')}
        />

        {/* Priority */}
        <FilterPill
          label="Priority"
          options={PRIORITY_OPTIONS}
          active={Array.isArray(activeFilters.priority) ? activeFilters.priority as string[] : []}
          onToggle={v => toggle('priority', v)}
          counts={countsExcludingDim(allTasks, activeFilters, 'priority')}
        />

        {/* More filters button */}
        {dimensions.length > 0 && (
          <div ref={filtersRef}>
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                filtersOpen || activeSecondaryDimCount > 0
                  ? 'border-violet-500/70 text-violet-300 bg-violet-900/20'
                  : 'border-neutral-700/50 text-neutral-400 hover:border-neutral-500 hover:text-neutral-300 bg-neutral-800/20',
              ].join(' ')}
            >
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round" />
              </svg>
              <span>Filters</span>
              {activeSecondaryDimCount > 0 && (
                <span className="bg-violet-500 text-white rounded-full px-1.5 text-[10px] font-semibold leading-4">
                  {activeSecondaryDimCount}
                </span>
              )}
              <svg
                className={`w-3 h-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 12 12" fill="currentColor"
              >
                <path d="M6 8L1 3h10L6 8z" />
              </svg>
            </button>

            <Popover
              anchorRef={filtersRef}
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
            >
              <FiltersPopover
                groups={groups}
                activeFilters={activeFilters}
                allTasks={allTasks}
                onToggle={toggle}
              />
            </Popover>
          </div>
        )}

        {/* Group by dropdown */}
        <GroupByDropdown allTasks={allTasks} visibleTasks={visibleTasks} />

        {/* Clear all — shown if any filter or group is active */}
        {(Object.values(activeFilters).some(v => Array.isArray(v) ? v.length > 0 : !!v) || groupByConfig !== null) && (
          <button
            onClick={clearAll}
            className="ml-auto text-xs text-neutral-600 hover:text-neutral-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Row 2: Active chips strip for secondary filters */}
      {secondaryActive.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-none">
          {secondaryActive.map(({ dim, value, cluster }) => (
            <span
              key={`${dim}:${value}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${CLUSTER_CHIP_COLORS[cluster] ?? CLUSTER_CHIP_COLORS['']}`}
            >
              <span className="opacity-60">{dim}:</span>
              <span className="max-w-32 truncate">{value}</span>
              <IconButton
                label={`Remove ${dim}:${value}`}
                onClick={() => removeChip(dim, value)}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
                </svg>
              </IconButton>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Filters Popover ──────────────────────────────────────────────────────────

function dimSortKey(dim: FilterDimension, active: string[], counts: Record<string, number>): number {
  if (active.length > 0) return 0
  if (dim.values.some(v => (counts[v] ?? 0) > 0)) return 1
  return 2
}

function FiltersPopover({
  groups,
  activeFilters,
  allTasks,
  onToggle,
}: {
  groups: ReturnType<typeof detectDimensionGroups>
  activeFilters: Record<string, string[] | string>
  allTasks: Task[]
  onToggle: (dim: string, value: string) => void
}) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl py-2 min-w-64 max-w-80 max-h-[70vh] overflow-y-auto">
      {groups.map((group, gi) => {
        // Enrich dims with counts and active values, then bucket-sort within each group
        const enriched = group.dimensions.map(dim => {
          const counts = countsExcludingDim(allTasks, activeFilters, dim.key)
          const active = Array.isArray(activeFilters[dim.key]) ? (activeFilters[dim.key] as string[]) : []
          return { dim, counts, active }
        }).sort((a, b) => dimSortKey(a.dim, a.active, a.counts) - dimSortKey(b.dim, b.active, b.counts))

        return (
          <div key={group.name || `ungrouped-${gi}`}>
            {group.name && (
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
                  {group.name}
                </span>
              </div>
            )}
            {enriched.map(({ dim, counts, active }) => (
              <DimSection
                key={dim.key}
                dim={dim}
                active={active}
                counts={counts}
                onToggle={v => onToggle(dim.key, v)}
              />
            ))}
            {gi < groups.length - 1 && group.name && (
              <div className="mx-3 my-1.5 border-t border-neutral-800/60" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function DimSection({
  dim,
  active,
  counts,
  onToggle,
}: {
  dim: FilterDimension
  active: string[]
  counts: Record<string, number>
  onToggle: (v: string) => void
}) {
  const [expanded, setExpanded] = useState(active.length > 0)

  useEffect(() => {
    if (active.length > 0) setExpanded(true)
  }, [active.length])

  const totalCount = Object.values(counts).reduce((s, n) => s + n, 0)
  const allDisabled = dim.values.every(v => (counts[v] ?? 0) === 0 && !active.includes(v))

  // Three-bucket sort: active first, then available (count > 0), then disabled
  const sortedValues = [
    ...dim.values.filter(v => active.includes(v)),
    ...dim.values.filter(v => !active.includes(v) && (counts[v] ?? 0) > 0),
    ...dim.values.filter(v => !active.includes(v) && (counts[v] ?? 0) === 0),
  ]

  return (
    <div>
      <button
        onClick={() => !allDisabled && setExpanded(e => !e)}
        disabled={allDisabled}
        className={[
          'w-full flex items-center justify-between px-3 py-1.5 transition-colors group',
          allDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-neutral-800/40',
        ].join(' ')}
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium capitalize ${allDisabled ? 'text-neutral-600' : 'text-neutral-300'}`}>
            {dim.key}
          </span>
          {active.length > 0 && (
            <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full px-1.5 leading-4">
              {active.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-600">{totalCount}</span>
          <svg
            className={`w-3 h-3 transition-all ${allDisabled ? 'text-neutral-700' : 'text-neutral-600 group-hover:text-neutral-400'} ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 12 12" fill="currentColor"
          >
            <path d="M6 8L1 3h10L6 8z" />
          </svg>
        </div>
      </button>

      {expanded && !allDisabled && (
        <div className="pb-1">
          {sortedValues.map(val => {
            const count = counts[val] ?? 0
            const isActive = active.includes(val)
            const disabled = count === 0 && !isActive
            return (
              <button
                key={val}
                onClick={() => !disabled && onToggle(val)}
                disabled={disabled}
                className={[
                  'w-full flex items-center gap-2 px-4 py-1 text-xs transition-colors',
                  disabled
                    ? 'text-neutral-700 cursor-not-allowed opacity-50'
                    : isActive
                      ? 'text-violet-300 hover:bg-violet-900/20'
                      : 'text-neutral-400 hover:bg-neutral-800/40',
                ].join(' ')}
              >
                <span className={[
                  'w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                  isActive ? 'bg-violet-500 border-violet-500' : 'border-neutral-600',
                ].join(' ')}>
                  {isActive && (
                    <svg viewBox="0 0 10 10" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 truncate">{val}</span>
                <span className={`text-[10px] tabular-nums ${count === 0 ? 'text-neutral-800' : 'text-neutral-600'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Core Filter Pill ─────────────────────────────────────────────────────────

interface PillOption { value: string; label: string }

function FilterPill({
  label, options, active, onToggle, counts,
}: {
  label: string
  options: PillOption[]
  active: string[]
  onToggle: (v: string) => void
  counts: Record<string, number>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeCount = active.length
  const allDisabled = options.every(o => (counts[o.value] ?? 0) === 0 && !active.includes(o.value))

  // Three-bucket sort: active first, then available (count > 0), then disabled
  const sortedOptions = [
    ...options.filter(o => active.includes(o.value)),
    ...options.filter(o => !active.includes(o.value) && (counts[o.value] ?? 0) > 0),
    ...options.filter(o => !active.includes(o.value) && (counts[o.value] ?? 0) === 0),
  ]

  return (
    <div ref={ref}>
      <button
        onClick={() => !allDisabled && setOpen(o => !o)}
        disabled={allDisabled}
        className={[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
          allDisabled
            ? 'border-neutral-800 text-neutral-600 bg-neutral-800/20 cursor-not-allowed opacity-50'
            : activeCount
              ? 'border-blue-500/70 text-blue-300 bg-blue-900/20'
              : 'border-neutral-700/50 text-neutral-400 hover:border-neutral-500 hover:text-neutral-300 bg-neutral-800/20',
        ].join(' ')}
      >
        <span>{label}</span>
        {activeCount > 0 && (
          <span className="bg-blue-500 text-white rounded-full px-1.5 text-[10px] font-semibold leading-4">
            {activeCount}
          </span>
        )}
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12" fill="currentColor"
        >
          <path d="M6 8L1 3h10L6 8z" />
        </svg>
      </button>

      <Popover anchorRef={ref} open={open && !allDisabled} onClose={() => setOpen(false)}>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl py-1.5 min-w-40">
          {sortedOptions.map(opt => {
            const count = counts[opt.value] ?? 0
            const isActive = active.includes(opt.value)
            const disabled = count === 0 && !isActive
            return (
              <button
                key={opt.value}
                onClick={() => !disabled && onToggle(opt.value)}
                disabled={disabled}
                className={[
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                  disabled
                    ? 'text-neutral-700 cursor-not-allowed opacity-50'
                    : isActive
                      ? 'text-blue-300 hover:bg-blue-900/20'
                      : 'text-neutral-300 hover:bg-neutral-800/40',
                ].join(' ')}
              >
                <span className={[
                  'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                  isActive ? 'bg-blue-500 border-blue-500' : 'border-neutral-600',
                ].join(' ')}>
                  {isActive && (
                    <svg viewBox="0 0 10 10" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 capitalize">{opt.label}</span>
                <span className={`text-[10px] tabular-nums ${count === 0 ? 'text-neutral-700' : 'text-neutral-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </Popover>
    </div>
  )
}
