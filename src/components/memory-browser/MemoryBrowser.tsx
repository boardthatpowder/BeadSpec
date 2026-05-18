import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import { rufloMemoryDelete, rufloMemoryList, rufloMemoryStore } from '../../ipc'
import type { MemoryEntry, MemoryListResponse } from '../../bindings'
import { formatAbsolute } from '../../lib/format/date'
import { buildNamespaceTree } from './namespaceTree'
import { parseMemoryKey } from './parseMemoryKey'
import { PanelHeader } from '../shared/PanelHeader'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { TaskRowSkeleton } from '../ui/Skeleton'
import { useToast } from '../ui/useToast'

const iconButtonClass = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[--color-border] bg-[--color-surface-hi] text-[--color-fg-muted] hover:bg-[--color-surface-hi] hover:text-[--color-fg]'

function messageFromError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}

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
      <PanelHeader title="Memory" description="Browse Ruflo memory entries by namespace" />
      <EmptyState
        icon={<Icon name="FolderOpen" size="lg" />}
        title="No project connected"
        description="Connect a project to browse memory."
      />
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader
        title="Memory"
        description="Browse Ruflo memory entries by namespace"
        actions={(
          <>
            <IconButton label="Refresh memory" onClick={() => query.refetch()} className={iconButtonClass}>
              <Icon name="RefreshCw" size="sm" />
            </IconButton>
            <IconButton label="Store memory entry" onClick={() => setStoreOpen(true)} className={iconButtonClass}>
              <Icon name="Plus" size="sm" />
            </IconButton>
          </>
        )}
      />
      <div className="min-h-0 flex-1 grid grid-cols-[300px_1fr] overflow-hidden">
        <aside className="border-r border-[--color-border] bg-[--color-bg] p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-[--color-fg]">Namespaces</div>
          </div>
          <NamespaceTree entries={entries} selected={namespace} onSelect={(ns) => { setNamespace(ns); setState({ memoryNamespace: ns || undefined }) }} />
        </aside>
        <main className="min-w-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-[--color-border] px-4 py-3">
            <span className="text-sm text-[--color-fg-muted]">{namespace || 'All memory'}</span>
          </div>
          <div className="flex-1 overflow-auto">
            {query.error ? (
              <ErrorState
                title="Could not load memory"
                description={messageFromError(query.error, 'Memory entries could not be loaded.')}
                retry={() => query.refetch()}
              />
            ) : query.isLoading ? (
              <div className="divide-y divide-neutral-800/50">
                <TaskRowSkeleton />
                <TaskRowSkeleton />
                <TaskRowSkeleton />
              </div>
            ) : !namespace ? (
              <EmptyState
                icon={<Icon name="Database" size="lg" />}
                title="Select a namespace"
                description="Choose a namespace from the sidebar to browse entries."
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<Icon name="Inbox" size="lg" />}
                title="No entries"
                description="This namespace has no memory entries yet."
              />
            ) : visible.map(entry => (
              <Button key={entry.key} variant="ghost" size="sm" onClick={() => setSelected(entry)} className="grid h-auto w-full grid-cols-[1fr_80px_140px] gap-3 rounded-none border-0 border-b border-[--color-border] px-4 py-2 text-left hover:bg-[--color-surface]/50">
                <span className="truncate font-mono text-xs text-[--color-fg-muted]">{entry.key}</span>
                <span className="text-xs text-[--color-fg-subtle]">{(entry.score ?? 0).toFixed(2)}</span>
                <span className="text-xs text-[--color-fg-subtle]">{entry.ts ? formatAbsolute(entry.ts * 1000, { includeTime: true }) : 'no ts'}</span>
                <span className="col-span-3 truncate text-xs text-[--color-fg-subtle]">{entry.preview}</span>
              </Button>
            ))}
          </div>
        </main>
      </div>
      {selected && <MemoryDrawer entry={selected} namespace={namespace} onClose={() => setSelected(null)} />}
      {storeOpen && <StoreDialog namespace={namespace} onClose={() => setStoreOpen(false)} />}
    </div>
  )
}

function NamespaceTree({ entries, selected, onSelect }: { entries: MemoryEntry[]; selected: string; onSelect: (ns: string) => void }) {
  const tree = buildNamespaceTree(entries)
  return (
    <div className="space-y-1 overflow-auto">
      <Button variant="ghost" size="xs" onClick={() => onSelect('')} className={`h-auto w-full justify-start px-2 py-1 text-left ${selected === '' ? 'bg-[--color-surface-hi] text-[--color-fg]' : 'text-[--color-fg-subtle] hover:bg-[--color-surface]'}`}>All ({entries.length})</Button>
      {tree.map(([path, count]) => (
        <Button key={path} variant="ghost" size="xs" onClick={() => onSelect(path)} className={`h-auto w-full justify-start px-2 py-1 text-left font-mono text-[10px] ${selected === path ? 'bg-blue-950/40 text-blue-300' : 'text-[--color-fg-subtle] hover:bg-[--color-surface]'}`}>
          {path} <span className="text-neutral-700">({count})</span>
        </Button>
      ))}
    </div>
  )
}

function MemoryDrawer({ entry, namespace, onClose }: { entry: MemoryEntry; namespace: string; onClose: () => void }) {
  const { setState } = useAppState()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const facets = parseMemoryKey(entry.key)
  const listKey = ['ruflo-memory', 'list', namespace] as const
  const remove = useMutation({
    mutationFn: () => rufloMemoryDelete(entry.key),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData<MemoryListResponse>(listKey)
      queryClient.setQueryData<MemoryListResponse>(listKey, (old) =>
        old
          ? {
              ...old,
              entries: old.entries.filter((item) => item.key !== entry.key),
              total: Math.max(0, old.total - 1),
            }
          : old,
      )
      onClose()
      return { previous }
    },
    onSuccess: () => {
      toast('Entry deleted')
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous)
      toast(`Delete failed: ${messageFromError(error, 'Could not delete memory entry.')}`)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ruflo-memory'] })
    },
  })
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Content className="left-auto right-0 top-0 h-full w-96 max-w-full translate-x-0 translate-y-0 overflow-auto rounded-none border-y-0 border-r-0 bg-[--color-bg] p-4">
        <Dialog.Header className="sr-only">Memory entry details</Dialog.Header>
        <Button variant="ghost" size="xs" onClick={onClose} className="mb-4 h-auto border-0 text-[--color-fg-subtle] hover:text-[--color-fg-muted]">Close</Button>
        <div className="break-all font-mono text-xs text-[--color-fg-muted]">{entry.key}</div>
        <div className="mt-3 flex flex-wrap gap-1">
          {Object.entries(facets).filter(([k]) => !['raw', 'rest'].includes(k)).map(([k, v]) => v != null && (
            <span key={k} className="rounded bg-[--color-surface-hi] px-1.5 py-0.5 text-[10px] text-[--color-fg-muted]">{k}: {String(v)}</span>
          ))}
        </div>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-[--color-fg-muted] select-text">{entry.body}</pre>
        <div className="mt-4 flex gap-2">
          {facets.issue && <Button variant="primary" size="xs" onClick={() => setState({ view: 'all', taskId: facets.issue })}>Open issue</Button>}
          <IconButton
            label="Delete entry"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-900/60 bg-red-950/50 text-red-100 hover:bg-red-900/60"
          >
            <Icon name="Trash2" size="sm" />
          </IconButton>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function StoreDialog({ namespace, onClose }: { namespace: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [key, setKey] = useState(namespace ? `${namespace}|` : '')
  const [value, setValue] = useState('')
  const store = useMutation({
    mutationFn: () => rufloMemoryStore(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ruflo-memory'] })
      toast('Entry stored')
      onClose()
    },
    onError: (error) => toast(`Store failed: ${messageFromError(error, 'Could not store memory entry.')}`),
  })
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Content className="w-[520px] rounded-lg bg-[--color-bg] p-4">
        <Dialog.Header className="border-0 px-0 py-0 mb-3 text-sm">Store memory</Dialog.Header>
        <label className="sr-only" htmlFor="memory-key">Key</label>
        <input id="memory-key" value={key} onChange={e => setKey(e.target.value)} className="mb-2 w-full rounded border border-[--color-border] bg-[--color-surface] px-3 py-2 font-mono text-xs" placeholder="key" />
        <label className="sr-only" htmlFor="memory-value">Value</label>
        <textarea id="memory-value" value={value} onChange={e => setValue(e.target.value)} className="h-40 w-full rounded border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm" placeholder="value" />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => store.mutate()} disabled={!key || !value}>Store</Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}
