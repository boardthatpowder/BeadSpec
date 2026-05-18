import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import type { GitRefs, GitnexusImpactReport, TaskDetail } from '../../bindings'
import { extractDiffSymbols } from './extractDiffSymbols'
import { useAppState } from '../../contexts/HashStateContext'
import { RISK_PALETTE } from '../../lib/palettes'
import { Button } from '../ui/Button'

function riskClass(risk: string) {
  const palette = RISK_PALETTE[risk] ?? RISK_PALETTE.Unknown
  return `${palette.bg} ${palette.text} ${palette.border}`
}

export function ImpactPanel({ task, project }: { task: TaskDetail; project: string; paneId: string }) {
  const { state, setState } = useAppState()
  const [symbol, setSymbol] = useState('')
  const [lastSymbol, setLastSymbol] = useState('')
  const [result, setResult] = useState<GitnexusImpactReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: gitRefs } = useQuery<GitRefs>({
    queryKey: ['gitRefs', project, task.id],
    queryFn: () => unwrap(commands.getGitRefsForIssue(project, task.id)),
    enabled: !!project && !!task.id,
    staleTime: 60_000,
  })

  const candidates = useMemo(() => extractDiffSymbols(gitRefs?.diff ?? ''), [gitRefs?.diff])

  async function run(nextSymbol: string) {
    const trimmed = nextSymbol.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setResult(null)
    setLastSymbol(trimmed)
    try {
      const report = await unwrap(commands.runGitnexusImpact(project, trimmed))
      setResult(report)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (state.impactSymbol) {
      setSymbol(state.impactSymbol)
      run(state.impactSymbol)
      setState({ impactSymbol: undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.impactSymbol])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    run(symbol)
  }

  return (
    <div className="p-5 space-y-4">
      <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-neutral-200">GitNexus Impact</div>
            <div className="text-xs text-neutral-500">Run upstream impact for a symbol touched by this task.</div>
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => lastSymbol && run(lastSymbol)}
            disabled={!lastSymbol || loading}
          >
            Refresh
          </Button>
        </div>

        {candidates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {candidates.map(candidate => (
              <Button
                key={candidate}
                variant="secondary"
                size="xs"
                onClick={() => { setSymbol(candidate); run(candidate) }}
                className="border-blue-900/60 bg-blue-950/30 font-mono text-blue-300 hover:bg-blue-900/40"
              >
                {candidate}
              </Button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-3 flex gap-2">
          <input
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            placeholder="Symbol name"
            className="min-w-0 flex-1 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-blue-700"
          />
          <Button variant="primary" size="md" disabled={loading || !symbol.trim()}>
            {loading ? 'Running…' : 'Run'}
          </Button>
        </form>
      </div>

      {!result && !error && !loading && (
        <Callout tone="neutral">Select a candidate or enter a symbol to run impact analysis.</Callout>
      )}
      {error && <Callout tone="error">{errorHint(error)}</Callout>}
      {result && <ImpactResult report={result} />}
    </div>
  )
}

function errorHint(error: string) {
  if (error.startsWith('MissingCli')) return 'GitNexus CLI is unavailable. Install or configure it, then run npx gitnexus analyze.'
  if (error.startsWith('NoIndex')) return 'No GitNexus index was found. Run npx gitnexus analyze.'
  if (error.startsWith('SymbolNotFound')) return 'GitNexus could not resolve that symbol.'
  if (error.startsWith('Timeout')) return 'GitNexus impact timed out after 15 seconds.'
  return error
}

function Callout({ tone, children }: { tone: 'neutral' | 'error' | 'warn'; children: React.ReactNode }) {
  const cls = tone === 'error'
    ? 'border-red-900/50 bg-red-950/30 text-red-300'
    : tone === 'warn'
      ? 'border-amber-900/50 bg-amber-950/30 text-amber-300'
      : 'border-neutral-800 bg-neutral-900/50 text-neutral-400'
  return <div className={`rounded border px-3 py-2 text-sm ${cls}`}>{children}</div>
}

function ImpactResult({ report }: { report: GitnexusImpactReport }) {
  return (
    <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 p-4 space-y-4">
      {report.index_status === 'Stale' && <Callout tone="warn">GitNexus index appears stale. Results may miss recent edits.</Callout>}
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-neutral-200">{report.symbol}</span>
        <span className={`rounded border px-2 py-0.5 text-xs ${riskClass(report.risk)}`}>
          {report.risk}
        </span>
        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
          {report.affected_processes.length} processes
        </span>
      </div>

      <section>
        <div className="mb-2 text-xs font-medium text-neutral-400">Upstream callers</div>
        {report.upstream_by_process.length === 0 ? (
          <div className="text-xs text-neutral-600">No upstream callers reported.</div>
        ) : report.upstream_by_process.map(group => (
          <details key={group.process} className="mb-2 rounded border border-neutral-800/60 bg-neutral-950/40" open>
            <summary className="cursor-pointer px-3 py-2 text-xs text-neutral-300">{group.process} ({group.callers.length})</summary>
            <div className="border-t border-neutral-800/60 px-3 py-2 space-y-1">
              {group.callers.map((caller, idx) => (
                <div key={`${caller.name}-${idx}`} className="flex justify-between gap-3 text-xs">
                  <span className="text-neutral-300">{caller.name}</span>
                  <span className="truncate font-mono text-neutral-600">{caller.location}</span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </section>

      <section>
        <div className="mb-2 text-xs font-medium text-neutral-400">Downstream callees</div>
        {report.downstream.length === 0 ? (
          <div className="text-xs text-neutral-600">No downstream callees reported.</div>
        ) : report.downstream.map((callee, idx) => (
          <div key={`${callee.name}-${idx}`} className="flex justify-between gap-3 text-xs">
            <span className="text-neutral-300">{callee.name}</span>
            <span className="truncate font-mono text-neutral-600">{callee.location}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
