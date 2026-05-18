import { useState } from 'react'
import { commands, unwrap } from '../../ipc'
import type { TaskDetail } from '../../bindings'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../ui/useToast'
import { Popover } from '../ui/Popover'
import { Button } from '../ui/Button'
import { PriorityChip } from '../ui/PriorityChip'

interface Props {
  task: TaskDetail
  project: string
}

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Critical',
  1: 'High',
  2: 'Medium',
  3: 'Low',
  4: 'Backlog',
}

const PRIORITIES = [0, 1, 2, 3, 4] as const

export function PrioritySelector({ task, project }: Props) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const select = async (priority: number) => {
    setOpen(false)
    if (priority === task.priority) return
    const previousData = queryClient.getQueryData(['task', project, task.id])
    queryClient.setQueryData(['task', project, task.id], (old: TaskDetail | undefined) =>
      old ? { ...old, priority } : old,
    )
    try {
      await unwrap(commands.updateTaskField(project, task.id, 'priority', String(priority)))
    } catch (err) {
      queryClient.setQueryData(['task', project, task.id], previousData)
      toast(`Failed to update priority: ${String(err)}`)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="xs"
          aria-label={`Priority: ${PRIORITY_LABELS[task.priority] ?? `P${task.priority}`}`}
          className="h-auto gap-1.5 border-0 rounded px-1.5 py-1 text-(--color-fg-subtle) hover:text-(--color-fg) hover:bg-(--color-surface-hi)/60"
        >
          <PriorityChip value={task.priority} size="md" />
          <span className="text-xs text-(--color-fg-muted)">{PRIORITY_LABELS[task.priority] ?? `P${task.priority}`}</span>
        </Button>
      </Popover.Trigger>

      <Popover.Content align="start" className="py-1 min-w-[140px]">
        {PRIORITIES.map(p => (
          <Button
            key={p}
            variant="ghost"
            size="xs"
            onClick={() => select(p)}
            className={[
              'h-auto w-full justify-start gap-2 rounded-none border-0 px-3 py-1.5',
              p === task.priority ? 'bg-(--color-surface-hi)/60 text-(--color-fg)' : 'text-(--color-fg-muted)',
            ].join(' ')}
          >
            <PriorityChip value={p} size="sm" />
            <span className="text-xs">{PRIORITY_LABELS[p]}</span>
          </Button>
        ))}
      </Popover.Content>
    </Popover.Root>
  )
}
