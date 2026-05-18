import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import type { ActivityEvent } from '../../bindings'
import { useActivityStream } from './useActivityStream'
import { useAutoFollow } from './useAutoFollow'
import { ActivityFilters } from './ActivityFilters'
import { ActivityRow } from './ActivityRow'

export function ActivityFeed() {
  const project = useActiveProject()
  const { state, setState } = useAppState()
  const [autoFollow, setAutoFollow] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const query = useActivityStream(project)

  const activeKinds = state.activityKinds ? state.activityKinds.split(',').filter(Boolean) : []
  const range = state.activityRange ?? 'today'
  const filtered = filterEvents(query.data ?? [], activeKinds, range)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 58,
    overscan: 8,
  })
  const { onScroll, scrollToBottom } = useAutoFollow(scrollRef, autoFollow, filtered.length, () => setAutoFollow(false))

  if (!project) return <div className="p-6 text-sm text-neutral-500">Connect a project to see workflow activity.</div>

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ActivityFilters
        activeKinds={activeKinds}
        range={range}
        onKindsChange={next => setState({ activityKinds: next.join(',') })}
        onRangeChange={next => setState({ activityRange: next })}
      />
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-auto p-4"
      >
        {query.error ? (
          <div className="rounded border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">Could not load activity: {String(query.error)}</div>
        ) : query.isLoading ? (
          <div className="text-sm text-neutral-600">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-neutral-600">No activity yet</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(item => (
              <div
                key={filtered[item.index].id}
                ref={virtualizer.measureElement}
                data-index={item.index}
                className="absolute left-0 right-0 pb-2"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <ActivityRow event={filtered[item.index]} />
              </div>
            ))}
          </div>
        )}
        {!autoFollow && (
          <button
            onClick={() => { setAutoFollow(true); scrollToBottom() }}
            className="absolute right-4 bottom-4 rounded bg-blue-600 px-2 py-1 text-xs text-white shadow-lg"
          >
            Jump to latest
          </button>
        )}
      </div>
    </div>
  )
}

function filterEvents(events: ActivityEvent[], activeKinds: string[], range: 'hour' | 'today' | 'week') {
  const now = Date.now()
  const min = range === 'hour'
    ? now - 60 * 60 * 1000
    : range === 'week'
      ? now - 7 * 24 * 60 * 60 * 1000
      : new Date().setHours(0, 0, 0, 0)
  return events.filter(event => {
    if (activeKinds.length && !activeKinds.includes(event.source)) return false
    return Date.parse(event.ts) >= min
  })
}
