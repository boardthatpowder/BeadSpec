import { useEffect, useMemo, useState } from 'react'
import { commands, unwrap } from '../../ipc'

interface Memory {
  key: string
  preview: string
  namespace?: string
}

export function parseTrajectoryKey(key: string) {
  const parts = Object.fromEntries(key.split('|').map(segment => {
    const idx = segment.indexOf(':')
    return idx > 0 ? [segment.slice(0, idx), segment.slice(idx + 1)] : ['', '']
  }).filter(([k]) => k))
  if (parts.type !== 'trajectory') return null
  return {
    issue: parts.issue,
    openspec: parts.openspec,
    outcome: parts.outcome,
    ts: parts.ts ? Number(parts.ts) : undefined,
  }
}

export function outcomeChipClass(outcome?: string) {
  if (outcome === 'complete' || outcome === 'done') return 'bg-green-950/40 text-green-300 border-green-800/50'
  if (outcome === 'paused') return 'bg-violet-950/40 text-violet-300 border-violet-800/50'
  if (outcome === 'blocked' || outcome === 'failed') return 'bg-red-950/40 text-red-300 border-red-800/50'
  return 'bg-neutral-800 text-neutral-400 border-neutral-700'
}

function relative(ts?: number) {
  if (!ts) return 'unknown'
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 60 * 86400) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

export function MemoryTrajectoryTab({ taskId, title }: { taskId: string; title: string }) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; entries: Memory[] | null }>({ loading: true, error: null, entries: null })
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: null, entries: null })
    unwrap(commands.rufloMemorySearch(`${title} type:trajectory issue:${taskId}`))
      .then(stdout => {
        if (cancelled) return
        const parsed = JSON.parse(stdout)
        const results: Memory[] = Array.isArray(parsed) ? parsed : parsed?.results ?? []
        const trajectory = results.filter(r => parseTrajectoryKey(r.key))
        const strict = trajectory.filter(r => parseTrajectoryKey(r.key)?.issue === taskId)
        setState({ loading: false, error: null, entries: strict.length ? strict : trajectory })
      })
      .catch(e => !cancelled && setState({ loading: false, error: String(e), entries: [] }))
    return () => { cancelled = true }
  }, [taskId, title])

  const entries = useMemo(() => (state.entries ?? []).slice().sort((a, b) => (parseTrajectoryKey(b.key)?.ts ?? 0) - (parseTrajectoryKey(a.key)?.ts ?? 0)), [state.entries])

  if (state.loading) return <div className="px-4 py-3 text-xs text-neutral-600">Loading…</div>
  if (state.error) return <div className="px-4 py-3 text-xs text-red-400">Could not load memories</div>
  if (entries.length === 0) return <div className="px-4 py-3 text-xs text-neutral-600">No trajectory memories yet. Work through openspec-beads-work to create trajectory entries.</div>

  return (
    <div className="divide-y divide-neutral-800/40">
      {entries.map((entry, idx) => {
        const parsed = parseTrajectoryKey(entry.key)!
        const open = expanded.has(idx)
        return (
          <button key={entry.key} onClick={() => setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(idx)) next.delete(idx)
            else next.add(idx)
            return next
          })} className="w-full px-4 py-3 text-left hover:bg-neutral-800/20">
            <div className="flex items-center gap-2">
              <span title={parsed.ts ? new Date(parsed.ts * 1000).toISOString() : undefined} className="text-xs text-neutral-500">{relative(parsed.ts)}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${outcomeChipClass(parsed.outcome)}`}>{parsed.outcome ?? 'unknown'}</span>
            </div>
            <div className="mt-1 whitespace-pre-wrap text-xs text-neutral-400">{open ? entry.preview : entry.preview.slice(0, 120)}</div>
          </button>
        )
      })}
    </div>
  )
}
