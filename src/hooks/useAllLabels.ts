import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../ipc'
import { useActiveProject } from './useProject'
import type { Task } from '../bindings'

export function useAllLabels(): string[] {
  const project = useActiveProject()
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', project],
    queryFn: async () => {
      const response = await unwrap(commands.listTasks(project!, null, null, null, null, null, null, null))
      return response.tasks
    },
    enabled: !!project,
    staleTime: 30_000,
  })

  // Flatten all labels into one array (deduplication handled by filterParser)
  return tasks.flatMap(t => t.labels)
}
