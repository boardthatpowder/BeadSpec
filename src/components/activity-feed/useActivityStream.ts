import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listRecentEvents } from '../../ipc'
import type { ActivityEvent } from '../../bindings'
import { activityChannel, appendActivityEvent } from './activityCache'

export function useActivityStream(project: string | null | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['activity-feed', project],
    queryFn: () => listRecentEvents(project!, 500),
    enabled: !!project,
    retry: false,
  })

  useEffect(() => {
    if (!project) return
    const pending = [
      listen<ActivityEvent>(activityChannel(project), event => {
        queryClient.setQueryData<ActivityEvent[]>(['activity-feed', project], old => appendActivityEvent(old, event.payload))
      }),
      listen<ActivityEvent>('workflow:activity', event => {
        if (event.payload.source === 'bd' || event.payload.source === 'beads') return
        queryClient.setQueryData<ActivityEvent[]>(['activity-feed', project], old => appendActivityEvent(old, event.payload))
      }),
    ]
    return () => {
      pending.forEach(listener => { void listener.then(unlisten => unlisten()).catch(() => {}) })
    }
  }, [project, queryClient])

  return query
}
