import { useEffect, useState } from 'react'
import { listSessionSnapshots } from '../../ipc'
import type { SessionSnapshot } from '../../bindings'
import { useAppState } from '../../contexts/HashStateContext'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'

export function SessionsTab({ project }: { project: string }) {
  const [snapshots, setSnapshots] = useState<SessionSnapshot[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SessionSnapshot | null>(null)
  const { setState } = useAppState()

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      setSnapshots(await listSessionSnapshots(project))
    } catch (e) {
      setError(String(e))
      setSnapshots([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [project])

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-200">Session snapshots</div>
        <Button variant="secondary" size="xs" onClick={load} disabled={isLoading}>Refresh</Button>
      </div>
      {error?.includes('ruflo CLI not found') ? (
        <div className="rounded border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-500">Ruflo CLI not configured</div>
      ) : error ? (
        <div className="rounded border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">{error}</div>
      ) : isLoading ? (
        <div className="text-sm text-neutral-600">Loading…</div>
      ) : snapshots?.length === 0 ? (
        <div className="text-sm text-neutral-600">No session snapshots yet. Snapshots are created automatically when a session ends.</div>
      ) : (
        <div className="space-y-2">
          {snapshots?.map(snapshot => (
            <Button key={snapshot.id} variant="secondary" size="sm" onClick={() => setSelected(snapshot)} className="h-auto w-full justify-between border-neutral-800 bg-neutral-900/40 px-3 py-2 text-left hover:bg-neutral-900">
              <span className="text-sm text-neutral-300">{snapshot.name}</span>
              <span className="text-xs text-neutral-500">{snapshot.is_auto ? 'auto' : 'manual'} · {snapshot.created_at}</span>
            </Button>
          ))}
        </div>
      )}
      {selected && (
        <Dialog.Root open onOpenChange={(open) => { if (!open) setSelected(null) }}>
          <Dialog.Content className="left-auto right-0 top-0 h-full w-96 max-w-full translate-x-0 translate-y-0 overflow-auto rounded-none border-y-0 border-r-0 bg-neutral-950 p-4">
            <Dialog.Header className="sr-only">Session snapshot details</Dialog.Header>
            <Button variant="ghost" size="xs" onClick={() => setSelected(null)} className="mb-4 h-auto border-0 text-neutral-500 hover:text-neutral-300">Close</Button>
            <div className="text-sm font-medium text-neutral-200">{selected.name}</div>
            <div className="mt-1 text-xs text-neutral-500">{selected.created_at}</div>
            <pre className="mt-4 whitespace-pre-wrap text-xs text-neutral-400">{selected.metadata ?? '{}'}</pre>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" size="sm" onClick={() => setState({ view: 'memory', memoryNamespace: `session:${selected.id}` })}>View memory entries from this session</Button>
              <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(selected.id).catch(() => {})}>Restore conversation context</Button>
            </div>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </div>
  )
}
