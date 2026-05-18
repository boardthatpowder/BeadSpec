import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listRecentEvents } from '../../ipc'
import type { ActivityEvent } from '../../bindings'

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
    let unlisten: (() => void) | null = null
    listen<ActivityEvent>('workflow:activity', event => {
      queryClient.setQueryData<ActivityEvent[]>(['activity-feed', project], old => [event.payload, ...(old ?? [])])
    }).then(fn => { unlisten = fn }).catch(() => {})
    return () => unlisten?.()
  }, [project, queryClient])

  return query
}
