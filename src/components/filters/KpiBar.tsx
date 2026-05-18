import { useMemo } from 'react'
import { useAppState } from '../../contexts/HashStateContext'
import { useTasks } from '../../hooks/useTasks'
import { applyFilters } from '../../lib/filterParser'
import { STATUS_PALETTE } from '../../lib/palettes'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'
import { StatusDot } from '../ui/StatusDot'

const STATUS_KEYS = ['open', 'in_progress', 'blocked', 'closed'] as const

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  closed: 'Closed',
}

export function KpiBar() {
  const { allTasks, filteredTasks, totalCount } = useTasks()
  const { state, setState } = useAppState()
  const activeFilters = state.filters ?? {}

  const whatIfCounts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    STATUS_KEYS.forEach(key => {
      byStatus[key] = applyFilters(allTasks, { ...activeFilters, status: [key] }).length
    })
    return byStatus
  }, [allTasks, activeFilters])

  const total = totalCount ?? filteredTasks.length
  const activeStatusList: string[] = Array.isArray(activeFilters.status) ? activeFilters.status : []
  const activeOpenSpecList: string[] = Array.isArray(activeFilters.openspec) ? activeFilters.openspec : []
  const pausedCount = allTasks.filter(t => t.labels.includes('openspec:paused')).length
  const pausedActive = activeOpenSpecList.includes('paused')

  const toggleStatus = (status: string) => {
    const current: string[] = Array.isArray(activeFilters.status) ? activeFilters.status : []
    const next = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status]
    const updated = { ...activeFilters }
    if (next.length) updated.status = next
    else delete updated.status
    setState({ filters: updated })
  }

  const togglePaused = () => {
    const next = pausedActive
      ? activeOpenSpecList.filter(v => v !== 'paused')
      : [...activeOpenSpecList, 'paused']
    const updated = { ...activeFilters }
    if (next.length) updated.openspec = next
    else delete updated.openspec
    setState({ filters: updated })
  }

  return (
    <div className="flex items-center gap-2 px-1">
      {/* Total issues — click to reset all filters */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setState({ filters: {} })}
        className="h-auto border-0 px-1 py-0.5 text-sm font-semibold tabular-nums text-white hover:text-(--color-fg-muted) flex-shrink-0"
        aria-label="Reset all filters"
      >
        {total} <span className="text-xs font-normal text-(--color-fg-subtle)">issues</span>
      </Button>

      {/* Proportional segmented bar */}
      <div className="flex flex-1 h-1.5 rounded-full overflow-hidden bg-(--color-surface-hi)/60 min-w-[80px]">
        {STATUS_KEYS.map(key => {
          const count = whatIfCounts[key] ?? 0
          if (count === 0) return null
          const pct = total > 0 ? (count / total) * 100 : 0
          const isActive = activeStatusList.includes(key)
          const palette = STATUS_PALETTE[key] ?? STATUS_PALETTE.open
          return (
            <Tooltip key={key} label={`${count} ${STATUS_LABELS[key]}`}>
              <Button
                variant="ghost"
                aria-label={`Filter by ${STATUS_LABELS[key]}: ${count}`}
                style={{ flexBasis: `${pct}%` }}
                onClick={() => toggleStatus(key)}
                className={[
                  'h-full rounded-none border-0 p-0 transition-all duration-150 hover:brightness-125 motion-reduce:transition-none flex-shrink-0',
                  palette.dot,
                  isActive ? 'ring-2 ring-inset ring-white/30' : '',
                ].join(' ')}
              />
            </Tooltip>
          )
        })}
      </div>

      {/* Per-status counts — compact labels */}
      <div className="flex items-center gap-0.5">
        {STATUS_KEYS.map(key => {
          const count = whatIfCounts[key] ?? 0
          if (count === 0 && !activeStatusList.includes(key)) return null
          const isActive = activeStatusList.includes(key)
          return (
            <Tooltip key={key} label={STATUS_LABELS[key]}>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => toggleStatus(key)}
                disabled={count === 0 && !isActive}
                className={[
                  'h-auto gap-1 border-0 px-2 py-1 text-xs tabular-nums transition-colors',
                  count === 0 ? 'opacity-40' : '',
                  isActive
                    ? 'bg-(--color-surface-hi)/80 text-(--color-fg)'
                    : 'text-(--color-fg-subtle) hover:text-(--color-fg-muted) hover:bg-(--color-surface-hi)/40',
                ].join(' ')}
              >
                <StatusDot status={key} size="sm" glow={false} />
                <span className="font-semibold">{count}</span>
              </Button>
            </Tooltip>
          )
        })}
      </div>

      {/* Paused pill — only when paused issues exist */}
      {(pausedCount > 0 || pausedActive) && (
        <Button
          variant="ghost"
          size="xs"
          onClick={togglePaused}
          className={[
            'h-auto gap-1.5 border-0 px-2 py-1 text-xs transition-colors',
            pausedActive
              ? 'bg-violet-950/60 text-violet-300'
              : 'text-violet-400/80 hover:bg-(--color-surface-hi)/40',
          ].join(' ')}
        >
          <Icon name="Pause" size="sm" className="w-3 h-3" />
          <span className="font-semibold tabular-nums">{pausedCount}</span>
        </Button>
      )}
    </div>
  )
}
