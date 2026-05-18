import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import type { SearchResult } from '../../bindings'
import { useActiveProject } from '../../hooks/useProject'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

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
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Content className="w-96 p-0">
        <Dialog.Header className="sr-only">Select a task</Dialog.Header>
        <Dialog.Body className="p-0" autoFocus>
          <div className="flex items-center px-4 border-b border-(--color-border)">
          <Icon name="Link2" size="sm" className="text-(--color-fg-subtle) mr-2" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks to reference…"
            className="flex-1 py-3 bg-transparent text-sm text-(--color-fg) placeholder-neutral-600 outline-none"
          />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!query && <div className="px-4 py-6 text-center text-sm text-(--color-fg-subtle)">Type to search tasks</div>}
            {results.map(t => (
              <Button
                key={t.id}
                variant="ghost"
                size="sm"
                onClick={() => onSelect(t)}
                className="h-auto w-full justify-start text-left px-4 py-2.5 hover:bg-(--color-surface-hi) gap-3 rounded-none border-0"
              >
                <span className="text-xs font-mono text-(--color-fg-subtle) flex-shrink-0">{t.id}</span>
                <span className="text-sm text-(--color-fg) flex-1 truncate">{t.title}</span>
              </Button>
            ))}
          </div>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  )
}
