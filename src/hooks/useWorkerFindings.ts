import { useQuery } from '@tanstack/react-query'
import type { WorkerFinding } from '../bindings'
import { listWorkerFindings } from '../ipc'

export function useWorkerFindings(projectPath: string | null | undefined) {
  return useQuery<WorkerFinding[]>({
    queryKey: ['worker-findings', projectPath],
    queryFn: () => listWorkerFindings(projectPath!),
    enabled: !!projectPath,
    staleTime: 30_000,
  })
}
