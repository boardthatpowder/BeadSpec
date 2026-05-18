import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { openPath } from '@tauri-apps/plugin-opener'
import { listen } from '@tauri-apps/api/event'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import { findIssuesTouchingProcess, getGitnexusIndexStatus, getGitnexusProcess, listGitnexusClusters, listGitnexusProcesses, triggerGitnexusReanalyze } from '../../ipc'
import type { IssueMatch, ProcessDetail as ProcessDetailType, ProcessSummary } from '../../bindings'

export function ProcessBrowser() {
  const project = useActiveProject()
  const { state, setState } = useAppState()
  const selected = state.processId ?? null
  const processes = useQuery({
    queryKey: ['gitnexus-processes', project],
    queryFn: () => listGitnexusProcesses(project!),
    enabled: !!project,
    retry: false,
  })
  const clusters = useQuery({
    queryKey: ['gitnexus-clusters', project],
    queryFn: () => listGitnexusClusters(project!),
    enabled: !!project,
    retry: false,
  })

  if (!project) return <div className="p-6 text-sm text-neutral-500">Connect a project to browse GitNexus processes.</div>
  if (processes.error) return <InstallHint error={String(processes.error)} />

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <StaleIndexBanner project={project} />
      <div className="flex-1 min-h-0 grid grid-cols-[360px_1fr]">
        <ProcessList
          processes={processes.data ?? []}
          clusters={clusters.data?.map(c => c.name) ?? []}
          selected={selected}
          onSelect={(name) => {
            setState({ view: 'processes', processId: name })
            window.history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify({ ...state, view: 'processes', processId: name })))
          }}
          loading={processes.isLoading}
        />
        <ProcessDetail project={project} name={selected} />
      </div>
    </div>
  )
}

function InstallHint({ error }: { error: string }) {
  return (
    <div className="h-full p-6">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="text-sm font-medium text-neutral-200">GitNexus CLI unavailable</div>
        <div className="mt-2 text-sm text-neutral-500">Install GitNexus and run <code className="text-neutral-300">npx gitnexus analyze</code>.</div>
        <pre className="mt-3 whitespace-pre-wrap text-xs text-red-300">{error}</pre>
      </div>
    </div>
  )
}

function StaleIndexBanner({ project }: { project: string }) {
  const queryClient = useQueryClient()
  const status = useQuery({
    queryKey: ['gitnexus-index-status', project],
    queryFn: () => getGitnexusIndexStatus(project),
    enabled: !!project,
    refetchInterval: 60_000,
  })
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<{ stage: string; message: string }>('gitnexus_reanalyze_progress', (event) => {
      setMessage(event.payload.message)
      if (event.payload.stage === 'finished') {
        queryClient.invalidateQueries({ queryKey: ['gitnexus-processes', project] })
        queryClient.invalidateQueries({ queryKey: ['gitnexus-index-status', project] })
      }
    }).then(fn => { unlisten = fn }).catch(() => {})
    return () => unlisten?.()
  }, [project, queryClient])

  if (!status.data?.stale) return null
  return (
    <div className="flex items-center justify-between border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs text-amber-300">
      <span>GitNexus index is stale{message ? ` · ${message}` : ''}</span>
      <button onClick={() => triggerGitnexusReanalyze(project)} className="rounded border border-amber-800 px-2 py-1 hover:bg-amber-900/30">
        Re-analyze
      </button>
    </div>
  )
}

function ProcessList({
  processes,
  clusters,
  selected,
  onSelect,
  loading,
}: {
  processes: ProcessSummary[]
  clusters: string[]
  selected: string | null
  onSelect: (name: string) => void
  loading: boolean
}) {
  const [search, setSearch] = useState('')
  const [cluster, setCluster] = useState('')
  const rows = useMemo(() => {
    return processes
      .filter(p => !cluster || p.cluster === cluster)
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.cluster.localeCompare(b.cluster) || a.name.localeCompare(b.name))
  }, [cluster, processes, search])
  const parentRef = useState<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef[0],
    estimateSize: () => 44,
  })

  return (
    <aside className="min-h-0 border-r border-neutral-800 bg-neutral-950 flex flex-col">
      <div className="space-y-2 border-b border-neutral-800 p-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search processes" className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-700" />
        <select value={cluster} onChange={e => setCluster(e.target.value)} className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
          <option value="">All clusters</option>
          {clusters.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div ref={parentRef[1]} className="flex-1 overflow-auto">
        {loading ? <div className="p-4 text-sm text-neutral-600">Loading…</div> : rows.length === 0 ? <div className="p-4 text-sm text-neutral-600">No processes</div> : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(item => {
              const row = rows[item.index]
              return (
                <button
                  key={row.name}
                  onClick={() => onSelect(row.name)}
                  className={`absolute left-0 right-0 flex h-11 items-center justify-between gap-3 border-b border-neutral-900 px-3 text-left ${selected === row.name ? 'bg-blue-950/30 text-blue-200' : 'text-neutral-300 hover:bg-neutral-900/60'}`}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <span className="min-w-0 truncate text-sm">{row.name}</span>
                  <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-neutral-500">{row.step_count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

function ProcessDetail({ project, name }: { project: string; name: string | null }) {
  const [focused, setFocused] = useState<number | null>(null)
  const detail = useQuery({
    queryKey: ['gitnexus-process', project, name],
    queryFn: () => getGitnexusProcess(project, name!),
    enabled: !!project && !!name,
    retry: false,
  })
  if (!name) return <div className="p-6 text-sm text-neutral-600">Select a process.</div>
  if (detail.isLoading) return <div className="p-6 text-sm text-neutral-600">Loading process…</div>
  if (detail.error || !detail.data) return <div className="p-6 text-sm text-red-300">Could not load process: {String(detail.error)}</div>
  return <ProcessDetailBody project={project} detail={detail.data} focused={focused} setFocused={setFocused} />
}

function ProcessDetailBody({
  project,
  detail,
  focused,
  setFocused,
}: {
  project: string
  detail: ProcessDetailType
  focused: number | null
  setFocused: (i: number | null) => void
}) {
  const parentRef = useState<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: detail.steps.length,
    getScrollElement: () => parentRef[0],
    estimateSize: () => 58,
  })
  const step = focused != null ? detail.steps[focused] : null
  return (
    <main className="min-h-0 flex flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
        <div>
          <div className="text-base font-semibold text-neutral-100">{detail.name}</div>
          <div className="mt-1 text-xs text-neutral-500">{detail.cluster} · {detail.steps.length} steps</div>
        </div>
        <div className="flex gap-2">
          <IssueMatchesPopover project={project} processName={detail.name} />
          <button
            disabled={!step}
            onClick={() => step && openPath(`${step.file}:${step.line}:0`).catch(() => {})}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:opacity-40"
          >
            Open in editor
          </button>
        </div>
      </div>
      <div ref={parentRef[1]} role="listbox" className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(item => {
            const s = detail.steps[item.index]
            return (
              <button
                key={`${s.symbol}-${item.index}`}
                aria-label={`step ${item.index + 1}: ${s.symbol} at ${s.file} line ${s.line}`}
                onClick={() => setFocused(item.index)}
                className={`absolute left-0 right-0 min-h-14 border-b border-neutral-900 px-5 py-2 text-left ${focused === item.index ? 'bg-blue-950/20' : 'hover:bg-neutral-900/40'}`}
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <div className="flex items-center gap-2 text-sm text-neutral-200">
                  <span className="w-8 text-xs text-neutral-600">#{item.index + 1}</span>
                  <span>{s.symbol}</span>
                  <span className="font-mono text-xs text-neutral-600">{s.file}:{s.line}</span>
                </div>
                <div className="mt-1 truncate pl-10 font-mono text-xs text-neutral-500">{s.snippet ?? s.symbol}</div>
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function IssueMatchesPopover({ project, processName }: { project: string; processName: string }) {
  const [open, setOpen] = useState(false)
  const { setState } = useAppState()
  const query = useQuery<IssueMatch[]>({
    queryKey: ['gitnexus-process-issues', project, processName],
    queryFn: () => findIssuesTouchingProcess(project, processName),
    enabled: open,
    retry: false,
  })
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300">
        Find issues
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded border border-neutral-700 bg-neutral-950 p-2 shadow-xl">
          {query.isLoading ? <div className="p-2 text-xs text-neutral-500">Loading…</div> : (query.data?.length ?? 0) === 0 ? (
            <div className="p-2 text-xs text-neutral-500">No matching issues.</div>
          ) : query.data!.map(match => (
            <button
              key={match.id}
              onClick={() => { setState({ view: 'all', taskId: match.id }); setOpen(false) }}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-900"
            >
              <span className="truncate text-neutral-300">{match.title}</span>
              <span className="rounded bg-neutral-800 px-1.5 text-neutral-400">{match.overlap_count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
