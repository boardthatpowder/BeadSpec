import { useState, useRef, useEffect } from 'react'
import { commands, unwrap } from '../../ipc'
import type { TaskDetail } from '../../bindings'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../ui/Toast'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  task: TaskDetail
  project: string
}

export function InlineTitle({ task, project }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    setValue(task.title)
  }, [task.title])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const save = async () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === task.title) {
      setValue(task.title)
      setEditing(false)
      return
    }

    // Optimistic update
    const previousData = queryClient.getQueryData(['task', project, task.id])
    queryClient.setQueryData(['task', project, task.id], (old: any) => ({
      ...old,
      title: trimmed,
    }))
    setEditing(false)

    try {
      await unwrap(commands.updateTaskField(project, task.id, 'title', trimmed))
    } catch (err) {
      // Revert on error
      queryClient.setQueryData(['task', project, task.id], previousData)
      setValue(task.title)
      toast(`Failed to update title: ${String(err)}`)
    }
  }

  const cancel = () => {
    setValue(task.title)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); save() }
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        className="flex-1 bg-neutral-800 text-base font-semibold text-neutral-100 leading-snug
                   px-2 py-0.5 rounded border border-blue-500 outline-none w-full"
      />
    )
  }

  return (
    <Tooltip label="Click to edit title">
      <h1
        onClick={() => setEditing(true)}
        className="text-base font-semibold text-neutral-100 leading-snug flex-1
                   cursor-text hover:bg-neutral-800/60 rounded px-1 -mx-1 transition-colors"
      >
        {task.title}
      </h1>
    </Tooltip>
  )
}
