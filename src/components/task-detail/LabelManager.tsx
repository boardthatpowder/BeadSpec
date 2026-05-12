import { useState, useRef, useEffect } from 'react'
import { commands, unwrap } from '../../ipc'
import type { TaskDetail } from '../../bindings'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../ui/Toast'
import { IconButton } from '../ui/IconButton'

interface Props {
  task: TaskDetail
  project: string
}

export function LabelManager({ task, project }: Props) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    if (adding) {
      inputRef.current?.focus()
    }
  }, [adding])

  const removeLabel = async (label: string) => {
    const previousData = queryClient.getQueryData(['task', project, task.id])
    queryClient.setQueryData(['task', project, task.id], (old: any) => ({
      ...old,
      labels: (old.labels ?? []).filter((l: string) => l !== label),
    }))

    try {
      await unwrap(commands.removeLabel(project, task.id, label))
    } catch (err) {
      queryClient.setQueryData(['task', project, task.id], previousData)
      toast(`Failed to remove label: ${String(err)}`)
    }
  }

  const addLabel = async () => {
    const trimmed = newLabel.trim()
    if (!trimmed) {
      setAdding(false)
      setNewLabel('')
      return
    }
    if ((task.labels ?? []).includes(trimmed)) {
      setAdding(false)
      setNewLabel('')
      return
    }

    const previousData = queryClient.getQueryData(['task', project, task.id])
    queryClient.setQueryData(['task', project, task.id], (old: any) => ({
      ...old,
      labels: [...(old.labels ?? []), trimmed],
    }))
    setAdding(false)
    setNewLabel('')

    try {
      await unwrap(commands.addLabel(project, task.id, trimmed))
    } catch (err) {
      queryClient.setQueryData(['task', project, task.id], previousData)
      toast(`Failed to add label: ${String(err)}`)
    }
  }

  const cancelAdd = () => {
    setNewLabel('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 items-center">
      {(task.labels ?? []).map(l => (
        <span
          key={l}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded
                     bg-neutral-800 text-neutral-400 font-mono group"
        >
          {l}
          <IconButton
            label={`Remove ${l}`}
            onClick={() => removeLabel(l)}
            className="text-neutral-600 hover:text-neutral-300 transition-colors
                       leading-none -mr-0.5 opacity-0 group-hover:opacity-100"
          >
            ×
          </IconButton>
        </span>
      ))}

      {adding ? (
        <input
          ref={inputRef}
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onBlur={cancelAdd}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addLabel() }
            if (e.key === 'Escape') { e.preventDefault(); cancelAdd() }
          }}
          placeholder="label…"
          className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded
                     border border-blue-500 outline-none font-mono w-24"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          + Add label
        </button>
      )}
    </div>
  )
}
