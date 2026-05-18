import { Button } from '../ui/Button'

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
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="flex items-center gap-2">
        {SOURCES.map(source => {
          const active = activeKinds.includes(source)
          return (
            <Button
              key={source}
              variant="secondary"
              size="xs"
              onClick={() => onKindsChange(active ? activeKinds.filter(k => k !== source) : [...activeKinds, source])}
              className={active ? 'border-blue-800 bg-blue-950/30 text-blue-300' : 'border-[--color-border] text-[--color-fg-subtle]'}
            >
              {source}
            </Button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        {(['hour', 'today', 'week'] as const).map(r => (
          <Button
            key={r}
            variant="ghost"
            size="xs"
            onClick={() => onRangeChange(r)}
            className={range === r ? 'bg-[--color-surface-hi] text-[--color-fg]' : 'text-[--color-fg-subtle]'}
          >
            {r === 'hour' ? 'Last hour' : r === 'today' ? 'Today' : 'Week'}
          </Button>
        ))}
      </div>
    </div>
  )
}
