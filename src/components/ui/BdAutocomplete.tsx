import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import type { Task } from '../../bindings'
import { useActiveProject } from '../../hooks/useProject'

interface Props {
  /** The input or textarea ref to watch for `bd-` patterns */
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>
  onSelect: (task: Task) => void
}

export function BdAutocomplete({ inputRef, onSelect }: Props) {
  const project = useActiveProject()
  const [query, setQuery] = useState<string | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', project],
    queryFn: async () => {
      const response = await unwrap(commands.listTasks(project!, null, null, null, null, null))
      return response.tasks
    },
    enabled: !!project && query !== null,
    staleTime: 60_000,
  })

  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const handler = () => {
      const val = el.value
      const cursor = (el as HTMLInputElement).selectionStart ?? 0
      const textUpToCursor = val.slice(0, cursor)
      const match = textUpToCursor.match(/bd-([a-z0-9]*)$/i)
      if (match) {
        setQuery(match[1])
        const rect = el.getBoundingClientRect()
        setPosition({ top: rect.bottom + 4, left: rect.left })
      } else {
        setQuery(null)
      }
    }

    el.addEventListener('input', handler)
    el.addEventListener('keyup', handler)
    return () => {
      el.removeEventListener('input', handler)
      el.removeEventListener('keyup', handler)
    }
  }, [inputRef])

  if (query === null) return null

  const filtered = tasks
    .filter(t =>
      t.id.toLowerCase().includes(query.toLowerCase()) ||
      t.title.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 6)

  if (!filtered.length) return null

  return (
    <div
      className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 w-64"
      style={{ top: position.top, left: position.left }}
    >
      {filtered.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => { onSelect(t); setQuery(null) }}
          className="w-full text-left px-3 py-2 hover:bg-neutral-800 transition-colors flex items-center gap-2"
        >
          <span className="text-xs font-mono text-neutral-500 flex-shrink-0">{t.id}</span>
          <span className="text-sm text-neutral-300 truncate">{t.title}</span>
        </button>
      ))}
    </div>
  )
}
