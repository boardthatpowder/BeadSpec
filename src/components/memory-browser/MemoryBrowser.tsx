import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import { rufloMemoryDelete, rufloMemoryList, rufloMemoryStore } from '../../ipc'
import type { MemoryEntry } from '../../bindings'
import { parseMemoryKey } from './parseMemoryKey'
import { ViewHelpHeader } from '../shared/ViewHelpHeader'
import { WORKFLOW_VIEW_HELP } from '../shared/workflowViewHelp'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'

export function MemoryBrowser() {
  const project = useActiveProject()
  const { state, setState } = useAppState()
  const [namespace, setNamespace] = useState(state.memoryNamespace ?? '')
  const [selected, setSelected] = useState<MemoryEntry | null>(null)
  const [storeOpen, setStoreOpen] = useState(false)
  useEffect(() => {
    setNamespace(state.memoryNamespace ?? '')
  }, [state.memoryNamespace])
  const query = useQuery({
    queryKey: ['ruflo-memory', 'list', namespace],
    queryFn: () => rufloMemoryList(namespace || undefined, 500),
    enabled: !!project,
    retry: false,
  })
  const entries = query.data?.entries ?? []
  const visible = useMemo(() => entries.slice().sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)), [entries])

  if (!project) return (
    <div className="h-full flex flex-col overflow-hidden">
      <ViewHelpHeader help={WORKFLOW_VIEW_HELP.memory} />
      <div className="p-6 text-sm text-neutral-500">Connect a project to browse memory.</div>
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ViewHelpHeader help={WORKFLOW_VIEW_HELP.memory} />
      <div className="min-h-0 flex-1 grid grid-cols-[300px_1fr] overflow-hidden">
        <aside className="border-r border-neutral-800 bg-neutral-950 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-200">Namespaces</div>
            <Button variant="secondary" size="xs" onClick={() => setStoreOpen(true)}>+ Store</Button>
          </div>
          <NamespaceTree entries={entries} selected={namespace} onSelect={(ns) => { setNamespace(ns); setState({ memoryNamespace: ns || undefined }) }} />
        </aside>
        <main className="min-w-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <span className="text-sm text-neutral-300">{namespace || 'All memory'}</span>
            <Button variant="secondary" size="xs" onClick={() => query.refetch()}>Refresh</Button>
          </div>
          <div className="flex-1 overflow-auto">
            {query.error ? (
              <div className="p-4 text-sm text-red-300">Could not load memory: {String(query.error)}</div>
            ) : query.isLoading ? (
              <div className="p-4 text-sm text-neutral-600">Loading…</div>
            ) : visible.length === 0 ? (
              <div className="p-4 text-sm text-neutral-600">No memory entries.</div>
            ) : visible.map(entry => (
              <Button key={entry.key} variant="ghost" size="sm" onClick={() => setSelected(entry)} className="grid h-auto w-full grid-cols-[1fr_80px_140px] gap-3 rounded-none border-0 border-b border-neutral-900 px-4 py-2 text-left hover:bg-neutral-900/50">
                <span className="truncate font-mono text-xs text-neutral-300">{entry.key}</span>
                <span className="text-xs text-neutral-600">{(entry.score ?? 0).toFixed(2)}</span>
                <span className="text-xs text-neutral-500">{entry.ts ? new Date(entry.ts * 1000).toLocaleString() : 'no ts'}</span>
                <span className="col-span-3 truncate text-xs text-neutral-500">{entry.preview}</span>
              </Button>
            ))}
          </div>
        </main>
      </div>
      {selected && <MemoryDrawer entry={selected} onClose={() => setSelected(null)} />}
      {storeOpen && <StoreDialog namespace={namespace} onClose={() => setStoreOpen(false)} />}
    </div>
  )
}

export function buildNamespaceTree(entries: MemoryEntry[]) {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const parts = entry.key.split('|')
    let path = ''
    for (const part of parts) {
      path = path ? `${path}|${part}` : part
      counts.set(path, (counts.get(path) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function NamespaceTree({ entries, selected, onSelect }: { entries: MemoryEntry[]; selected: string; onSelect: (ns: string) => void }) {
  const tree = buildNamespaceTree(entries)
  return (
    <div className="space-y-1 overflow-auto">
      <Button variant="ghost" size="xs" onClick={() => onSelect('')} className={`h-auto w-full justify-start px-2 py-1 text-left ${selected === '' ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-500 hover:bg-neutral-900'}`}>All ({entries.length})</Button>
      {tree.map(([path, count]) => (
        <Button key={path} variant="ghost" size="xs" onClick={() => onSelect(path)} className={`h-auto w-full justify-start px-2 py-1 text-left font-mono text-[10px] ${selected === path ? 'bg-blue-950/40 text-blue-300' : 'text-neutral-500 hover:bg-neutral-900'}`}>
          {path} <span className="text-neutral-700">({count})</span>
        </Button>
      ))}
    </div>
  )
}

function MemoryDrawer({ entry, onClose }: { entry: MemoryEntry; onClose: () => void }) {
  const { setState } = useAppState()
  const queryClient = useQueryClient()
  const facets = parseMemoryKey(entry.key)
  const remove = useMutation({
    mutationFn: () => rufloMemoryDelete(entry.key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ruflo-memory'] })
      onClose()
    },
  })
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Content className="left-auto right-0 top-0 h-full w-96 max-w-full translate-x-0 translate-y-0 overflow-auto rounded-none border-y-0 border-r-0 bg-neutral-950 p-4">
        <Dialog.Header className="sr-only">Memory entry details</Dialog.Header>
        <Button variant="ghost" size="xs" onClick={onClose} className="mb-4 h-auto border-0 text-neutral-500 hover:text-neutral-300">Close</Button>
        <div className="break-all font-mono text-xs text-neutral-300">{entry.key}</div>
        <div className="mt-3 flex flex-wrap gap-1">
          {Object.entries(facets).filter(([k]) => !['raw', 'rest'].includes(k)).map(([k, v]) => v != null && (
            <span key={k} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{k}: {String(v)}</span>
          ))}
        </div>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-neutral-300 select-text">{entry.body}</pre>
        <div className="mt-4 flex gap-2">
          {facets.issue && <Button variant="primary" size="xs" onClick={() => setState({ view: 'all', taskId: facets.issue })}>Open issue</Button>}
          <Button variant="danger" size="xs" onClick={() => remove.mutate()} className="border-red-900/60 text-red-100">Delete</Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function StoreDialog({ namespace, onClose }: { namespace: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [key, setKey] = useState(namespace ? `${namespace}|` : '')
  const [value, setValue] = useState('')
  const store = useMutation({
    mutationFn: () => rufloMemoryStore(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ruflo-memory'] })
      onClose()
    },
  })
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Content className="w-[520px] rounded-lg bg-neutral-950 p-4">
        <Dialog.Header className="border-0 px-0 py-0 mb-3 text-sm">Store memory</Dialog.Header>
        <input value={key} onChange={e => setKey(e.target.value)} className="mb-2 w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs" placeholder="key" />
        <textarea value={value} onChange={e => setValue(e.target.value)} className="h-40 w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" placeholder="value" />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => store.mutate()} disabled={!key || !value}>Store</Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}
