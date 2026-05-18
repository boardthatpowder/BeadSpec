import { IconButton } from '../ui/IconButton'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Popover } from '../ui/Popover'
import { Tooltip } from '../ui/Tooltip'
import { useState, useEffect, useMemo } from 'react'
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
  '':       'bg-(--color-surface-hi)/80 text-(--color-fg-muted) border-(--color-border-strong)/50',
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
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="secondary"
          size="xs"
          className={[
            'rounded-lg px-2.5 py-1.5',
            isActive
              ? 'border-emerald-500/70 text-emerald-300 bg-emerald-900/20'
              : 'border-(--color-border-strong)/50 text-(--color-fg-muted) hover:border-neutral-500 hover:text-(--color-fg-muted) bg-(--color-surface-hi)/60',
          ].join(' ')}
        >
          <Icon name="Group" size="sm" className="h-3 w-3" />
          <span>Group</span>
          {isActive && (
            <span className="bg-emerald-500 text-white rounded-full px-1.5 text-[10px] font-semibold leading-4">
              {getGroupByLabel(config)}
            </span>
          )}
          <Icon
            name="ChevronDown"
            size="sm"
            className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </Button>
      </Popover.Trigger>

      <Popover.Content align="start" className="min-w-44 rounded-xl border-(--color-border) bg-(--color-bg) p-0 shadow-2xl">
        <div className="py-1.5">
          {/* None option */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => selectConfig(null)}
            className={[
              'h-auto w-full justify-start gap-2 rounded-none border-0 px-3 py-1.5 font-normal',
              config === null
                ? 'text-emerald-300 bg-emerald-900/20'
                : 'text-(--color-fg-muted) hover:bg-(--color-surface-hi)/40',
            ].join(' ')}
          >
            <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${config === null ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-600'}`}>
              {config === null && (
                <Icon name="Check" size="sm" className="h-2 w-2 text-white" />
              )}
            </span>
            <span>None</span>
          </Button>

          {/* Divider: By field */}
          <div className="mx-3 my-1 border-t border-(--color-border)/60" />
          <div className="px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-(--color-fg-subtle)">By field</span>
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
              <Button
                key={opt.value}
                variant="ghost"
                size="xs"
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return
                  if (isSelected) selectConfig(null)
                  else selectConfig(deserializeGroupConfig(opt.value) as GroupConfig)
                }}
                className={[
                  'h-auto w-full justify-start gap-2 rounded-none border-0 px-3 py-1.5 font-normal',
                  isSelected
                    ? 'text-emerald-300 bg-emerald-900/20'
                    : eligible
                      ? 'text-(--color-fg-muted) hover:bg-(--color-surface-hi)/40'
                      : 'text-neutral-700 cursor-not-allowed opacity-50',
                ].join(' ')}
              >
                <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-600'}`}>
                  {isSelected && (
                    <Icon name="Check" size="sm" className="h-2 w-2 text-white" />
                  )}
                </span>
                <span>{opt.label}</span>
              </Button>
            )
          })}

          {/* Divider: By label prefix */}
          <div className="mx-3 my-1 border-t border-(--color-border)/60" />
          <div className="px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-(--color-fg-subtle)">By label prefix</span>
          </div>
          {allLabelPrefixes.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-(--color-fg-subtle) cursor-not-allowed opacity-50">
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
                <Button
                  key={prefix}
                  variant="ghost"
                  size="xs"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return
                    if (isSelected) selectConfig(null)
                    else selectConfig({ type: 'label-prefix', prefix })
                  }}
                  className={[
                    'h-auto w-full justify-start gap-2 rounded-none border-0 px-3 py-1.5 font-normal',
                    isSelected
                      ? 'text-emerald-300 bg-emerald-900/20'
                      : eligible
                        ? 'text-(--color-fg-muted) hover:bg-(--color-surface-hi)/40'
                        : 'text-neutral-700 cursor-not-allowed opacity-50',
                  ].join(' ')}
                >
                  <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-600'}`}>
                    {isSelected && (
                      <Icon name="Check" size="sm" className="h-2 w-2 text-white" />
                    )}
                  </span>
                  <span className="font-mono">{prefix}</span>
                </Button>
              )
            })
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
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
    <div className="flex-shrink-0 border-b border-(--color-border)">
      {/* Row A: Scope + Search */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
        {/* Workspace scope chip — leftmost, only shown for git projects */}
        {workspaceContext !== null && (
          <Tooltip
            label="Workspace scope"
            description={workspaceScope === 'on'
              ? `Active: ${workspaceContext.label_worktree}, ${workspaceContext.label_repo}`
              : 'Off — showing all tasks'
            }
          >
            <Button
              variant="secondary"
              size="xs"
              onClick={toggleWorkspaceScope}
              className={[
                'flex-shrink-0 rounded-lg px-2.5 py-1.5',
                workspaceScope === 'on'
                  ? 'bg-blue-900/30 text-blue-300 border-blue-500/60 hover:bg-blue-900/50'
                  : 'bg-blue-900/10 text-blue-400/50 border-blue-700/30 opacity-50 hover:opacity-70',
              ].join(' ')}
            >
              <Icon name="Crosshair" size="sm" className="h-3 w-3 flex-shrink-0" />
              <span className={workspaceScope === 'off' ? 'line-through' : ''}>
                Workspace scope
              </span>
            </Button>
          </Tooltip>
        )}

        {/* Search */}
        <div className="flex flex-1 items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-(--color-surface-hi)/40 border border-(--color-border-strong)/50 focus-within:border-neutral-500 transition-colors">
          <Icon name="Search" size="sm" className="h-3 w-3 text-(--color-fg-subtle) flex-shrink-0" />
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
            className="bg-transparent text-xs text-(--color-fg-muted) placeholder-neutral-600 outline-none flex-1 min-w-0"
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
          <Popover.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
            <Popover.Trigger asChild>
              <Button
                variant="secondary"
                size="xs"
                className={[
                  'rounded-lg px-2.5 py-1.5',
                  filtersOpen || activeSecondaryDimCount > 0
                    ? 'border-violet-500/70 text-violet-300 bg-violet-900/20'
                    : 'border-(--color-border-strong)/50 text-(--color-fg-muted) hover:border-neutral-500 hover:text-(--color-fg-muted) bg-(--color-surface-hi)/60',
                ].join(' ')}
              >
                <Icon name="ListFilter" size="sm" className="h-3 w-3" />
                <span>Filters</span>
                {activeSecondaryDimCount > 0 && (
                  <span className="bg-violet-500 text-white rounded-full px-1.5 text-[10px] font-semibold leading-4">
                    {activeSecondaryDimCount}
                  </span>
                )}
                <Icon
                  name="ChevronDown"
                  size="sm"
                  className={`h-3 w-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
                />
              </Button>
            </Popover.Trigger>

            <Popover.Content align="start" className="rounded-xl border-(--color-border) bg-(--color-bg) p-0 shadow-2xl">
              <FiltersPopover
                groups={groups}
                activeFilters={activeFilters}
                allTasks={allTasks}
                onToggle={toggle}
              />
            </Popover.Content>
          </Popover.Root>
        )}

        {/* Group by dropdown */}
        <GroupByDropdown allTasks={allTasks} visibleTasks={visibleTasks} />

        {/* Clear all — shown if any filter or group is active */}
        {(Object.values(activeFilters).some(v => Array.isArray(v) ? v.length > 0 : !!v) || groupByConfig !== null) && (
          <Button
            variant="ghost"
            size="xs"
            onClick={clearAll}
            className="ml-auto h-auto border-0 bg-transparent px-0 py-0 font-normal text-(--color-fg-subtle) hover:bg-transparent hover:text-(--color-fg-muted)"
          >
            <Icon name="X" size="sm" className="h-3 w-3" />
            Clear
          </Button>
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
                <Icon name="X" size="sm" className="h-2.5 w-2.5" />
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
    <div className="py-2 min-w-64 max-w-80 max-h-[70vh] overflow-y-auto">
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
                <span className="text-[10px] font-semibold uppercase tracking-widest text-(--color-fg-subtle)">
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
              <div className="mx-3 my-1.5 border-t border-(--color-border)/60" />
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
      <Button
        variant="ghost"
        size="xs"
        onClick={() => !allDisabled && setExpanded(e => !e)}
        disabled={allDisabled}
        className={[
          'group h-auto w-full justify-between rounded-none border-0 px-3 py-1.5 font-normal',
          allDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-(--color-surface-hi)/40',
        ].join(' ')}
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium capitalize ${allDisabled ? 'text-(--color-fg-subtle)' : 'text-(--color-fg-muted)'}`}>
            {dim.key}
          </span>
          {active.length > 0 && (
            <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full px-1.5 leading-4">
              {active.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-(--color-fg-subtle)">{totalCount}</span>
          <Icon
            name="ChevronDown"
            size="sm"
            className={`h-3 w-3 transition-all ${allDisabled ? 'text-neutral-700' : 'text-(--color-fg-subtle) group-hover:text-(--color-fg-muted)'} ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </Button>

      {expanded && !allDisabled && (
        <div className="pb-1">
          {sortedValues.map(val => {
            const count = counts[val] ?? 0
            const isActive = active.includes(val)
            const disabled = count === 0 && !isActive
            return (
              <Button
                key={val}
                variant="ghost"
                size="xs"
                onClick={() => !disabled && onToggle(val)}
                disabled={disabled}
                className={[
                  'h-auto w-full justify-start gap-2 rounded-none border-0 px-4 py-1 font-normal',
                  disabled
                    ? 'text-neutral-700 cursor-not-allowed opacity-50'
                    : isActive
                      ? 'text-violet-300 hover:bg-violet-900/20'
                      : 'text-(--color-fg-muted) hover:bg-(--color-surface-hi)/40',
                ].join(' ')}
              >
                <span className={[
                  'w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                  isActive ? 'bg-violet-500 border-violet-500' : 'border-neutral-600',
                ].join(' ')}>
                  {isActive && (
                    <Icon name="Check" size="sm" className="h-2 w-2 text-white" />
                  )}
                </span>
                <span className="flex-1 truncate">{val}</span>
                <span className={`text-[10px] tabular-nums ${count === 0 ? 'text-neutral-800' : 'text-(--color-fg-subtle)'}`}>
                  {count}
                </span>
              </Button>
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

  const activeCount = active.length
  const allDisabled = options.every(o => (counts[o.value] ?? 0) === 0 && !active.includes(o.value))

  // Three-bucket sort: active first, then available (count > 0), then disabled
  const sortedOptions = [
    ...options.filter(o => active.includes(o.value)),
    ...options.filter(o => !active.includes(o.value) && (counts[o.value] ?? 0) > 0),
    ...options.filter(o => !active.includes(o.value) && (counts[o.value] ?? 0) === 0),
  ]

  return (
    <Popover.Root open={open && !allDisabled} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="secondary"
          size="xs"
          disabled={allDisabled}
          className={[
            'rounded-lg px-2.5 py-1.5',
            allDisabled
              ? 'border-(--color-border) text-(--color-fg-subtle) bg-(--color-surface-hi)/60 cursor-not-allowed opacity-50'
              : activeCount
                ? 'border-blue-500/70 text-blue-300 bg-blue-900/20'
                : 'border-(--color-border-strong)/50 text-(--color-fg-muted) hover:border-neutral-500 hover:text-(--color-fg-muted) bg-(--color-surface-hi)/60',
          ].join(' ')}
        >
          <span>{label}</span>
          {activeCount > 0 && (
            <span className="bg-blue-500 text-white rounded-full px-1.5 text-[10px] font-semibold leading-4">
              {activeCount}
            </span>
          )}
          <Icon
            name="ChevronDown"
            size="sm"
            className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </Button>
      </Popover.Trigger>

      <Popover.Content align="start" className="min-w-40 rounded-xl border-(--color-border) bg-(--color-bg) p-0 shadow-2xl">
        <div className="py-1.5">
          {sortedOptions.map(opt => {
            const count = counts[opt.value] ?? 0
            const isActive = active.includes(opt.value)
            const disabled = count === 0 && !isActive
            return (
              <Button
                key={opt.value}
                variant="ghost"
                size="xs"
                onClick={() => !disabled && onToggle(opt.value)}
                disabled={disabled}
                className={[
                  'h-auto w-full justify-start gap-2 rounded-none border-0 px-3 py-1.5 font-normal',
                  disabled
                    ? 'text-neutral-700 cursor-not-allowed opacity-50'
                    : isActive
                      ? 'text-blue-300 hover:bg-blue-900/20'
                      : 'text-(--color-fg-muted) hover:bg-(--color-surface-hi)/40',
                ].join(' ')}
              >
                <span className={[
                  'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                  isActive ? 'bg-blue-500 border-blue-500' : 'border-neutral-600',
                ].join(' ')}>
                  {isActive && (
                    <Icon name="Check" size="sm" className="h-2 w-2 text-white" />
                  )}
                </span>
                <span className="flex-1 capitalize">{opt.label}</span>
                <span className={`text-[10px] tabular-nums ${count === 0 ? 'text-neutral-700' : 'text-(--color-fg-subtle)'}`}>
                  {count}
                </span>
              </Button>
            )
          })}
        </div>
      </Popover.Content>
    </Popover.Root>
  )
}
