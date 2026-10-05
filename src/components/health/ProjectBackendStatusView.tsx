import type { ProjectBackendStatus } from '../../ipc'
import { Button } from '../ui/Button'

export function ProjectBackendStatusView({ backend, enabling, onEnable }: { backend: ProjectBackendStatus; enabling: boolean; onEnable: () => void }) {
  return (
    <>
      <p>Reads: {backend.read_transport.toUpperCase()} · Writes: {backend.write_transport.toUpperCase()} · Live updates: {backend.live_update_mode}</p>
      {backend.reason && <p className="text-(--color-fg-subtle)">{backend.reason}</p>}
      {!backend.journal_enabled && <>
        <p className="text-(--color-fg-subtle)">Enable the Beads journal for faster updates in this project. This changes the project’s journal configuration and restarts its Beads connection. Full refreshes continue every 30 seconds.</p>
        <Button variant="secondary" size="xs" disabled={enabling} onClick={onEnable}>
          {enabling ? 'Enabling…' : 'Enable live updates'}
        </Button>
      </>}
      <p className="text-(--color-fg-subtle)">{backend.historical_coverage}</p>
    </>
  )
}
