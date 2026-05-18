import { useMemo } from 'react'
import { useAppState } from '../../contexts/HashStateContext'
import { useTasks } from '../../hooks/useTasks'
import { applyFilters } from '../../lib/filterParser'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

const STATUS_CONFIG = [
  { key: 'open',        label: 'Open',        color: 'text-[--color-fg-muted]',  activeColor: 'text-[--color-fg]',  dot: 'bg-neutral-500' },
  { key: 'in_progress', label: 'In Progress', color: 'text-blue-400',     activeColor: 'text-blue-300',     dot: 'bg-blue-500'    },
  { key: 'blocked',     label: 'Blocked',     color: 'text-amber-400',    activeColor: 'text-amber-300',    dot: 'bg-amber-500'   },
  { key: 'closed',      label: 'Closed',      color: 'text-green-400',    activeColor: 'text-green-300',    dot: 'bg-green-500'   },
]

export function KpiBar() {
  const { allTasks, filteredTasks, totalCount } = useTasks()
  const { state, setState } = useAppState()
  const activeFilters = state.filters ?? {}

  const whatIfCounts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    STATUS_CONFIG.forEach(s => {
      byStatus[s.key] = applyFilters(allTasks, { ...activeFilters, status: [s.key] }).length
    })
    return byStatus
  }, [allTasks, activeFilters])

  // Use totalCount from server response when available; fall back to local array length
  const total = totalCount ?? filteredTasks.length
  const activeStatusList: string[] = Array.isArray(activeFilters.status) ? activeFilters.status : []
  const activeOpenSpecList: string[] = Array.isArray(activeFilters.openspec) ? activeFilters.openspec : []
  const pausedCount = allTasks.filter(t => t.labels.includes('openspec:paused')).length
  const pausedActive = activeOpenSpecList.includes('paused')

  const toggleStatus = (status: string) => {
    const raw = activeFilters.status
    const current: string[] = Array.isArray(raw) ? raw : []
    const next = current.includes(status)
      ? current.filter((s: string) => s !== status)
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
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setState({ filters: {} })}
        className="h-auto gap-2 border-0 px-3 py-1.5 group"
      >
        <span className="text-base font-semibold tabular-nums text-white">{total}</span>
        <span className="text-xs text-[--color-fg-subtle] group-hover:text-[--color-fg-muted] transition-colors">Total</span>
      </Button>

      <div className="w-px h-5 bg-[--color-surface-hi]/80" />

      {STATUS_CONFIG.map(s => {
        const isActive = activeStatusList.includes(s.key)
        const count = whatIfCounts[s.key] ?? 0
        const disabled = count === 0 && !isActive
        return (
          <Button
            variant="ghost"
            size="sm"
            key={s.key}
            onClick={() => !disabled && toggleStatus(s.key)}
            disabled={disabled}
            className={[
              'h-auto gap-1.5 border-0 px-3 py-1.5',
              disabled
                ? 'opacity-40 cursor-not-allowed'
                : isActive
                  ? 'bg-[--color-surface-hi]/80 ring-1 ring-neutral-700/60'
                  : 'hover:bg-[--color-surface-hi]/40',
            ].join(' ')}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} ${isActive ? 'opacity-100' : 'opacity-60'}`} />
            <span className={`text-sm font-semibold tabular-nums ${isActive ? s.activeColor : s.color}`}>
              {count}
            </span>
            <span className={`text-xs transition-colors ${isActive ? 'text-[--color-fg-muted]' : 'text-[--color-fg-subtle]'}`}>
              {s.label}
            </span>
          </Button>
        )
      })}

      {(pausedCount > 0 || pausedActive) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePaused}
          className={[
            'h-auto gap-1.5 border-0 px-3 py-1.5',
            pausedActive ? 'bg-violet-950/60 ring-1 ring-violet-800/60' : 'hover:bg-[--color-surface-hi]/40',
          ].join(' ')}
        >
          <Icon name="Pause" size="sm" className="text-violet-300" />
          <span className="text-sm font-semibold tabular-nums text-violet-300">{pausedCount}</span>
          <span className="text-xs text-violet-400/80">Paused</span>
        </Button>
      )}
    </div>
  )
}
