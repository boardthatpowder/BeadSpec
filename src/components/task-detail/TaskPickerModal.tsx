import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import type { SearchResult } from '../../bindings'
import { useActiveProject } from '../../hooks/useProject'

type Task = Pick<SearchResult, 'id' | 'title' | 'status'>

interface Props {
  onSelect: (task: Task) => void
  onClose: () => void
}

export function TaskPickerModal({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const project = useActiveProject()

  const { data: results = [] } = useQuery<Task[]>({
    queryKey: ['search', project, query],
    queryFn: () => unwrap(commands.searchTasks(project!, query)),
    enabled: !!project && query.length > 0,
    staleTime: 5_000,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center px-4 border-b border-neutral-800">
          <span className="text-neutral-500 mr-2 text-sm">🔗</span>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
            placeholder="Search tasks to reference…"
            className="flex-1 py-3 bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {!query && <div className="px-4 py-6 text-center text-sm text-neutral-600">Type to search tasks</div>}
          {results.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="w-full text-left px-4 py-2.5 hover:bg-neutral-800 transition-colors flex items-center gap-3"
            >
              <span className="text-xs font-mono text-neutral-500 flex-shrink-0">{t.id}</span>
              <span className="text-sm text-neutral-200 flex-1 truncate">{t.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
