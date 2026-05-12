import { useQueryClient } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import type { TaskDetail } from '../../bindings'
import { useToast } from '../ui/Toast'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  task: TaskDetail
  project: string
}

export function HumanQueueToggle({ task, project }: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isHuman = (task.labels ?? []).includes('human')

  const toggle = async () => {
    const previous = queryClient.getQueryData(['task', project, task.id])
    queryClient.setQueryData(['task', project, task.id], (old: any) => ({
      ...old,
      labels: isHuman
        ? (old.labels ?? []).filter((l: string) => l !== 'human')
        : [...(old.labels ?? []), 'human'],
    }))

    try {
      if (isHuman) {
        await unwrap(commands.removeLabel(project, task.id, 'human'))
      } else {
        await unwrap(commands.addLabel(project, task.id, 'human'))
      }
    } catch (err) {
      queryClient.setQueryData(['task', project, task.id], previous)
      toast(`Failed to ${isHuman ? 'remove' : 'add'} human flag: ${String(err)}`)
    }
  }

  if (isHuman) {
    return (
      <Tooltip label="Remove human decision flag">
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Needs decision
        </button>
      </Tooltip>
    )
  }

  return (
    <Tooltip label="Flag for human decision" description="Mark this task as requiring a human decision">
      <button
        onClick={toggle}
        className="text-xs text-neutral-600 hover:text-amber-400 transition-colors"
      >
        Flag for decision
      </button>
    </Tooltip>
  )
}
