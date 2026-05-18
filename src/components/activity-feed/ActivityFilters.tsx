const SOURCES = ['bd', 'hook', 'gitnexus'] as const

export function ActivityFilters({
  activeKinds,
  range,
  onKindsChange,
  onRangeChange,
}: {
  activeKinds: string[]
  range: 'hour' | 'today' | 'week'
  onKindsChange: (next: string[]) => void
  onRangeChange: (next: 'hour' | 'today' | 'week') => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-5 py-3">
      <div className="flex items-center gap-2">
        {SOURCES.map(source => {
          const active = activeKinds.includes(source)
          return (
            <button
              key={source}
              onClick={() => onKindsChange(active ? activeKinds.filter(k => k !== source) : [...activeKinds, source])}
              className={`rounded border px-2 py-1 text-xs ${active ? 'border-blue-800 bg-blue-950/30 text-blue-300' : 'border-neutral-800 text-neutral-500'}`}
            >
              {source}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        {(['hour', 'today', 'week'] as const).map(r => (
          <button key={r} onClick={() => onRangeChange(r)} className={`rounded px-2 py-1 text-xs ${range === r ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-500'}`}>
            {r === 'hour' ? 'Last hour' : r === 'today' ? 'Today' : 'Week'}
          </button>
        ))}
      </div>
    </div>
  )
}
