import { commands, unwrap } from '../../ipc'
import type { TaskDetail } from '../../bindings'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../ui/Toast'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  task: TaskDetail
  project: string
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

const PRIORITIES = [1, 2, 3, 4] as const

export function PrioritySelector({ task, project }: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const select = async (priority: number) => {
    if (priority === task.priority) return

    const previousData = queryClient.getQueryData(['task', project, task.id])
    queryClient.setQueryData(['task', project, task.id], (old: any) => ({
      ...old,
      priority,
    }))

    try {
      await unwrap(commands.updateTaskField(project, task.id, 'priority', String(priority)))
    } catch (err) {
      queryClient.setQueryData(['task', project, task.id], previousData)
      toast(`Failed to update priority: ${String(err)}`)
    }
  }

  return (
    <div className="flex items-center gap-0.5 bg-neutral-800 rounded-full px-1 py-0.5">
      {PRIORITIES.map(p => {
        const active = p === task.priority
        return (
          <Tooltip key={p} label={PRIORITY_LABELS[p]}>
            <button
              onClick={() => select(p)}
              className={[
                'text-xs px-2 py-0.5 rounded-full font-medium transition-colors',
                active
                  ? 'bg-neutral-600 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300',
              ].join(' ')}
            >
              P{p}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
