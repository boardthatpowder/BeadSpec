import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enableProjectJournal, getProjectBackendStatus } from '../ipc'
import { invalidateProjectData } from './projectInvalidation'

export function useProjectBackendStatus(project: string) {
  const client = useQueryClient()
  const status = useQuery({
    queryKey: ['project-backend-status', project],
    queryFn: () => getProjectBackendStatus(project),
    retry: false,
  })
  const enable = useMutation({
    mutationFn: () => enableProjectJournal(project),
    onSuccess: data => {
      client.setQueryData(['project-backend-status', project], data)
      void invalidateProjectData(client, project)
    },
  })
  return { status, enable }
}
