import { useProjectBackendStatus } from '../../hooks/useProjectBackendStatus'
import { ProjectBackendStatusView } from './ProjectBackendStatusView'
import { Button } from '../ui/Button'

export function ProjectBackendPanel({ project }: { project: string }) {
  const { status, enable } = useProjectBackendStatus(project)
  const backend = status.data
  return (
    <section aria-label="Beads connection" className="px-5 py-3 border-b border-(--color-border) text-xs space-y-2">
      <h3 className="font-medium text-(--color-fg)">Beads connection</h3>
      {backend ? <ProjectBackendStatusView backend={backend} enabling={enable.isPending} onEnable={() => enable.mutate()} /> : <p>{status.isPending ? 'Checking connection…' : 'Could not load connection status.'}</p>}
      {status.error && <Button variant="secondary" size="xs" onClick={() => void status.refetch()}>Retry connection status</Button>}
      {enable.error && <p role="alert" className="text-red-400">{String(enable.error)}</p>}
    </section>
  )
}
