import { useEffect, useState } from 'react'
import { listSessionSnapshots } from '../../ipc'
import type { SessionSnapshot } from '../../bindings'
import { formatAbsolute } from '../../lib/format/date'
import { useAppState } from '../../contexts/HashStateContext'
import { PanelHeader } from '../shared/PanelHeader'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { TaskRowSkeleton } from '../ui/Skeleton'
import { useToast } from '../ui/Toast'

const iconButtonClass = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[--color-border] bg-[--color-surface-hi] text-[--color-fg-muted] hover:bg-neutral-700 hover:text-[--color-fg] disabled:opacity-50'

export function SessionsTab({ project }: { project: string }) {
  const [snapshots, setSnapshots] = useState<SessionSnapshot[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SessionSnapshot | null>(null)
  const { setState } = useAppState()
  const { toast } = useToast()

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

  function formattedSnapshotDate(value: string) {
    return formatAbsolute(value, { includeTime: true }) || value
  }

  function copySessionId(id: string) {
    navigator.clipboard.writeText(id)
      .then(() => toast('Copied!'))
      .catch(error => toast(`Copy failed: ${error instanceof Error ? error.message : 'Clipboard write failed.'}`))
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <PanelHeader
        title="Sessions"
        description="Session snapshots from recent agent runs"
        actions={(
          <IconButton label="Refresh sessions" onClick={load} disabled={isLoading} className={iconButtonClass}>
            <Icon name="RefreshCw" size="sm" />
          </IconButton>
        )}
      />
      <div className="flex-1 overflow-auto p-5">
      {error?.includes('ruflo CLI not found') ? (
        <ErrorState
          title="Ruflo CLI not configured"
          description="Install Ruflo and ensure it is available on PATH, then try again."
          retry={load}
        />
      ) : error ? (
        <ErrorState title="Could not load sessions" description={error} retry={load} />
      ) : isLoading ? (
        <div className="overflow-hidden rounded border border-neutral-800/60">
          <TaskRowSkeleton />
          <TaskRowSkeleton />
          <TaskRowSkeleton />
        </div>
      ) : snapshots?.length === 0 ? (
        <EmptyState
          icon={<Icon name="Clock" size="lg" />}
          title="No sessions yet"
          description="Sessions appear after your first agent run."
        />
      ) : (
        <div className="space-y-2">
          {snapshots?.map(snapshot => (
            <Button key={snapshot.id} variant="secondary" size="sm" onClick={() => setSelected(snapshot)} className="h-auto w-full justify-between border-neutral-800 bg-neutral-900/40 px-3 py-2 text-left hover:bg-neutral-900">
              <span className="text-sm text-neutral-300">{snapshot.name}</span>
              <span className="text-xs text-neutral-500">{snapshot.is_auto ? 'auto' : 'manual'} · {formattedSnapshotDate(snapshot.created_at)}</span>
            </Button>
          ))}
        </div>
      )}
      </div>
      {selected && (
        <Dialog.Root open onOpenChange={(open) => { if (!open) setSelected(null) }}>
          <Dialog.Content className="left-auto right-0 top-0 h-full w-96 max-w-full translate-x-0 translate-y-0 overflow-auto rounded-none border-y-0 border-r-0 bg-neutral-950 p-4">
            <Dialog.Header className="sr-only">Session snapshot details</Dialog.Header>
            <Button variant="ghost" size="xs" onClick={() => setSelected(null)} className="mb-4 h-auto border-0 text-neutral-500 hover:text-neutral-300">Close</Button>
            <div className="text-sm font-medium text-neutral-200">{selected.name}</div>
            <div className="mt-1 text-xs text-neutral-500">{formattedSnapshotDate(selected.created_at)}</div>
            <pre className="mt-4 whitespace-pre-wrap text-xs text-neutral-400">{selected.metadata ?? '{}'}</pre>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" size="sm" onClick={() => setState({ view: 'memory', memoryNamespace: `session:${selected.id}` })}>View memory entries from this session</Button>
              <IconButton
                label="Copy session ID"
                description="Copy this session identifier to the clipboard."
                onClick={() => copySessionId(selected.id)}
                className={iconButtonClass}
              >
                <Icon name="Copy" size="sm" />
              </IconButton>
            </div>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </div>
  )
}
