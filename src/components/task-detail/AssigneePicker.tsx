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

export function AssigneePicker({ task, project }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(task.assignee ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    setValue(task.assignee ?? '')
  }, [task.assignee])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const save = async () => {
    const trimmed = value.trim()
    const newAssignee = trimmed || null
    if (newAssignee === task.assignee) {
      setEditing(false)
      return
    }

    const previousData = queryClient.getQueryData(['task', project, task.id])
    queryClient.setQueryData(['task', project, task.id], (old: any) => ({
      ...old,
      assignee: newAssignee,
    }))
    setEditing(false)

    try {
      await unwrap(commands.updateTaskField(project, task.id, 'assignee', trimmed))
    } catch (err) {
      queryClient.setQueryData(['task', project, task.id], previousData)
      setValue(task.assignee ?? '')
      toast(`Failed to update assignee: ${String(err)}`)
    }
  }

  const cancel = () => {
    setValue(task.assignee ?? '')
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
        placeholder="Assignee…"
        className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded
                   border border-blue-500 outline-none w-32"
      />
    )
  }

  return (
    <Tooltip label="Edit assignee">
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        {task.assignee ? `→ ${task.assignee}` : '+ assignee'}
      </button>
    </Tooltip>
  )
}
