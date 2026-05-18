import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useActiveProject } from '../../hooks/useProject'
import { getGitnexusStatus, runGitnexusAnalyze } from '../../ipc'

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
    ? 'border-neutral-800 bg-neutral-900 text-neutral-500'
    : data.stale
      ? 'border-amber-800/50 bg-amber-950/30 text-amber-300'
      : data.age_seconds > 3600
        ? 'border-blue-800/50 bg-blue-950/30 text-blue-300'
        : 'border-green-800/50 bg-green-950/30 text-green-300'
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className={`rounded border px-2 py-1 text-xs ${cls}`}>
        GitNexus {data.available ? (data.stale ? 'stale' : 'fresh') : 'off'}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded border border-neutral-700 bg-neutral-950 p-3 shadow-xl">
          <div className="text-sm text-neutral-200">{data.message}</div>
          <div className="mt-1 text-xs text-neutral-500">
            {data.last_indexed_at ? `Indexed ${data.last_indexed_at}` : 'No index timestamp available'}
          </div>
          <button
            disabled={running}
            onClick={async () => {
              setRunning(true)
              try { await runGitnexusAnalyze(project) } finally { setRunning(false) }
            }}
            className="mt-3 rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-40"
          >
            {running ? 'Analyzing…' : 'Re-analyze'}
          </button>
        </div>
      )}
    </div>
  )
}
