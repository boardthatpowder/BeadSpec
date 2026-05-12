import { useMemo } from 'react'
import { useAppState } from '../../contexts/HashStateContext'
import { useTasks } from '../../hooks/useTasks'
import { applyFilters } from '../../lib/filterParser'

const STATUS_CONFIG = [
  { key: 'open',        label: 'Open',        color: 'text-neutral-300',  activeColor: 'text-neutral-100',  dot: 'bg-neutral-500' },
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

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setState({ filters: {} })}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-800/60 transition-colors group"
      >
        <span className="text-base font-semibold tabular-nums text-white">{total}</span>
        <span className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors">Total</span>
      </button>

      <div className="w-px h-5 bg-neutral-800/80" />

      {STATUS_CONFIG.map(s => {
        const isActive = activeStatusList.includes(s.key)
        const count = whatIfCounts[s.key] ?? 0
        const disabled = count === 0 && !isActive
        return (
          <button
            key={s.key}
            onClick={() => !disabled && toggleStatus(s.key)}
            disabled={disabled}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
              disabled
                ? 'opacity-40 cursor-not-allowed'
                : isActive
                  ? 'bg-neutral-800/80 ring-1 ring-neutral-700/60'
                  : 'hover:bg-neutral-800/40',
            ].join(' ')}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} ${isActive ? 'opacity-100' : 'opacity-60'}`} />
            <span className={`text-sm font-semibold tabular-nums ${isActive ? s.activeColor : s.color}`}>
              {count}
            </span>
            <span className={`text-xs transition-colors ${isActive ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {s.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
