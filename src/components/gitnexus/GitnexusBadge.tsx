import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useActiveProject } from '../../hooks/useProject'
import { getGitnexusStatus, runGitnexusAnalyze } from '../../ipc'
import { Button } from '../ui/Button'

export function GitnexusBadge() {
  const project = useActiveProject()
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const status = useQuery({
    queryKey: ['gitnexus-status', project],
    queryFn: () => getGitnexusStatus(project!),
    enabled: !!project,
    refetchInterval: 60_000,
  })
  if (!project || !status.data) return null
  const data = status.data
  const cls = !data.available
    ? 'border-(--color-border) bg-(--color-surface) text-(--color-fg-subtle)'
    : data.stale
      ? 'border-amber-800/50 bg-amber-950/30 text-amber-300'
      : data.age_seconds > 3600
        ? 'border-blue-800/50 bg-blue-950/30 text-blue-300'
        : 'border-green-800/50 bg-green-950/30 text-green-300'
  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="xs"
        onClick={() => setOpen(v => !v)}
        className={`h-auto px-2 py-1 ${cls}`}
      >
        GitNexus {data.available ? (data.stale ? 'stale' : 'fresh') : 'off'}
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded border border-(--color-border-strong) bg-(--color-bg) p-3 shadow-xl">
          <div className="text-sm text-(--color-fg)">{data.message}</div>
          <div className="mt-1 text-xs text-(--color-fg-subtle)">
            {data.last_indexed_at ? `Indexed ${data.last_indexed_at}` : 'No index timestamp available'}
          </div>
          <Button
            variant="primary"
            size="xs"
            disabled={running}
            onClick={async () => {
              setRunning(true)
              try { await runGitnexusAnalyze(project) } finally { setRunning(false) }
            }}
            className="mt-3 bg-blue-600 text-white disabled:opacity-40"
          >
            {running ? 'Analyzing…' : 'Re-analyze'}
          </Button>
        </div>
      )}
    </div>
  )
}
