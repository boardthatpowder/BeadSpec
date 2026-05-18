import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import type { ActivityEvent } from '../../bindings'
import { useActivityStream } from './useActivityStream'
import { useAutoFollow } from './useAutoFollow'
import { ActivityFilters } from './ActivityFilters'
import { ActivityRow } from './ActivityRow'
import { PanelHeader } from '../shared/PanelHeader'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Icon } from '../ui/Icon'
import { TaskRowSkeleton } from '../ui/Skeleton'

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

  if (!project) return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader title="Activity Feed" description="Recent workflow events" />
      <EmptyState
        icon={<Icon name="FolderOpen" size="lg" />}
        title="No project connected"
        description="Connect a project to see workflow activity."
      />
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader
        title="Activity Feed"
        description="Recent workflow events"
        filters={(
          <ActivityFilters
            activeKinds={activeKinds}
            range={range}
            onKindsChange={next => setState({ activityKinds: next.join(',') })}
            onRangeChange={next => setState({ activityRange: next })}
          />
        )}
      />
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-auto p-4"
      >
        {query.error ? (
          <ErrorState
            title="Could not load activity"
            description={query.error instanceof Error ? query.error.message : 'The activity feed could not be loaded.'}
            retry={() => query.refetch()}
          />
        ) : query.isLoading ? (
          <div className="overflow-hidden rounded border border-neutral-800/60">
            <TaskRowSkeleton />
            <TaskRowSkeleton />
            <TaskRowSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Icon name={query.data?.length ? 'Filter' : 'Activity'} size="lg" />}
            title={query.data?.length ? 'No matching events' : 'No activity yet'}
            description={query.data?.length ? 'Try adjusting your filters.' : 'Events appear here as your team works.'}
          />
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
          <Button
            variant="primary"
            size="xs"
            onClick={() => { setAutoFollow(true); scrollToBottom() }}
            className="absolute right-4 bottom-4 shadow-lg"
          >
            Jump to latest
          </Button>
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
