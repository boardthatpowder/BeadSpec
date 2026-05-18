import { useEffect, useState } from 'react'
import { listSessionSnapshots } from '../../ipc'
import type { SessionSnapshot } from '../../bindings'
import { useAppState } from '../../contexts/HashStateContext'

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
        <button onClick={load} disabled={isLoading} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:opacity-40">Refresh</button>
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
            <button key={snapshot.id} onClick={() => setSelected(snapshot)} className="flex w-full items-center justify-between rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-left hover:bg-neutral-900">
              <span className="text-sm text-neutral-300">{snapshot.name}</span>
              <span className="text-xs text-neutral-500">{snapshot.is_auto ? 'auto' : 'manual'} · {snapshot.created_at}</span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelected(null)}>
          <aside className="absolute right-0 top-0 h-full w-96 max-w-full overflow-auto border-l border-neutral-800 bg-neutral-950 p-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="mb-4 text-xs text-neutral-500 hover:text-neutral-300">Close</button>
            <div className="text-sm font-medium text-neutral-200">{selected.name}</div>
            <div className="mt-1 text-xs text-neutral-500">{selected.created_at}</div>
            <pre className="mt-4 whitespace-pre-wrap text-xs text-neutral-400">{selected.metadata ?? '{}'}</pre>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={() => setState({ view: 'memory', memoryNamespace: `session:${selected.id}` })} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">View memory entries from this session</button>
              <button onClick={() => navigator.clipboard.writeText(selected.id).catch(() => {})} className="rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-300">Restore conversation context</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
