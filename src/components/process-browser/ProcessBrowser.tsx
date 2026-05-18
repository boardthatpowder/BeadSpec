import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { openPath } from '@tauri-apps/plugin-opener'
import { listen } from '@tauri-apps/api/event'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import { findIssuesTouchingProcess, getGitnexusIndexStatus, getGitnexusProcess, listGitnexusClusters, listGitnexusProcesses, triggerGitnexusReanalyze } from '../../ipc'
import type { IssueMatch, ProcessDetail as ProcessDetailType, ProcessSummary } from '../../bindings'
import { PanelHeader } from '../shared/PanelHeader'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { Popover } from '../ui/Popover'
import { TaskRowSkeleton } from '../ui/Skeleton'
import { useToast } from '../ui/useToast'

const iconButtonClass = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[--color-border] bg-[--color-surface-hi] text-[--color-fg-muted] hover:bg-[--color-surface-hi] hover:text-[--color-fg] disabled:opacity-50'

function messageFromError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}

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

  if (!project) return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader title="Processes" description="Browse GitNexus execution flows" />
      <EmptyState
        icon={<Icon name="FolderOpen" size="lg" />}
        title="No project connected"
        description="Connect a project to browse GitNexus processes."
      />
    </div>
  )
  if (processes.error) return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader title="Processes" description="Browse GitNexus execution flows" />
      <InstallHint error={messageFromError(processes.error, 'GitNexus process data could not be loaded.')} />
    </div>
  )

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <PanelHeader
        title="Processes"
        description="Browse GitNexus execution flows"
        actions={<ReanalyzeButton project={project} />}
      />
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
    <div className="flex-1">
      <ErrorState
        title="GitNexus CLI unavailable"
        description={`Install GitNexus and run npx gitnexus analyze. ${error}`}
      />
    </div>
  )
}

function ReanalyzeButton({ project, className = iconButtonClass }: { project: string; className?: string }) {
  const { toast } = useToast()
  return (
    <IconButton
      label="Re-analyze index"
      onClick={() => {
        toast('Re-analysis started')
        triggerGitnexusReanalyze(project)
          .catch(error => toast(`Re-analysis failed: ${messageFromError(error, 'Could not start GitNexus re-analysis.')}`))
      }}
      className={className}
    >
      <Icon name="RefreshCw" size="sm" />
    </IconButton>
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
    }).then(fn => { unlisten = fn }).catch(() => { /* intentionally silent: progress events are best-effort */ })
    return () => unlisten?.()
  }, [project, queryClient])

  if (!status.data?.stale) return null
  return (
    <div className="flex items-center justify-between border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs text-amber-300">
      <span>GitNexus index is stale{message ? ` · ${message}` : ''}</span>
      <ReanalyzeButton
        project={project}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-800 bg-transparent text-amber-300 hover:bg-amber-900/30"
      />
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
    <aside className="min-h-0 border-r border-[--color-border] bg-[--color-bg] flex flex-col">
      <div className="space-y-2 border-b border-[--color-border] p-3">
        <label className="sr-only" htmlFor="process-search">Search processes</label>
        <input id="process-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search processes" className="w-full rounded border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm outline-none focus:border-blue-700" />
        <label className="sr-only" htmlFor="process-cluster">Filter by cluster</label>
        <select id="process-cluster" aria-label="Filter by cluster" value={cluster} onChange={e => setCluster(e.target.value)} className="w-full rounded border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm">
          <option value="">All clusters</option>
          {clusters.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div ref={parentRef[1]} className="flex-1 overflow-auto">
        {loading ? (
          <div className="divide-y divide-neutral-800/50">
            <TaskRowSkeleton />
            <TaskRowSkeleton />
            <TaskRowSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon name={processes.length === 0 ? 'GitBranch' : 'Search'} size="lg" />}
            title={processes.length === 0 ? 'No processes indexed' : 'No matching processes'}
            description={processes.length === 0 ? 'Run /gitnexus-cli to index the codebase.' : 'Try adjusting your process filters.'}
          />
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(item => {
              const row = rows[item.index]
              return (
                <Button
                  key={row.name}
                  variant="ghost"
                  size="md"
                  onClick={() => onSelect(row.name)}
                  className={`absolute left-0 right-0 h-11 justify-between rounded-none border-0 border-b border-[--color-border] px-3 text-left font-normal ${selected === row.name ? 'bg-blue-950/30 text-blue-200' : 'text-[--color-fg-muted] hover:bg-[--color-surface]/60'}`}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <span className="min-w-0 truncate text-sm">{row.name}</span>
                  <span className="rounded bg-[--color-surface] px-1.5 py-0.5 text-[10px] text-[--color-fg-subtle]">{row.step_count}</span>
                </Button>
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
  if (!name) return (
    <EmptyState
      icon={<Icon name="GitBranch" size="lg" />}
      title="Select a process"
      description="Choose a process from the list to inspect its steps."
    />
  )
  if (detail.isLoading) return (
    <div className="flex min-h-48 items-center justify-center">
      <Icon name="Loader2" size="lg" className="animate-spin text-[--color-fg-subtle]" />
    </div>
  )
  if (detail.error || !detail.data) return (
    <ErrorState
      title="Could not load process"
      description={messageFromError(detail.error, 'The selected process could not be loaded.')}
      retry={() => detail.refetch()}
    />
  )
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
  const { toast } = useToast()
  const parentRef = useState<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: detail.steps.length,
    getScrollElement: () => parentRef[0],
    estimateSize: () => 58,
  })
  const step = focused != null ? detail.steps[focused] : null
  return (
    <main className="min-h-0 flex flex-col">
      <div className="flex items-center justify-between border-b border-[--color-border] px-5 py-4">
        <div>
          <div className="text-base font-semibold text-[--color-fg]">{detail.name}</div>
          <div className="mt-1 text-xs text-[--color-fg-subtle]">{detail.cluster} · {detail.steps.length} steps</div>
        </div>
        <div className="flex gap-2">
          <IssueMatchesPopover project={project} processName={detail.name} />
          <IconButton
            label="Open in editor"
            disabled={!step}
            onClick={() => {
              if (!step) return
              openPath(`${step.file}:${step.line}:0`)
                .catch(error => toast(`Open failed: ${messageFromError(error, 'Could not open this process step.')}`))
            }}
            className={iconButtonClass}
          >
            <Icon name="ExternalLink" size="sm" />
          </IconButton>
        </div>
      </div>
      <div ref={parentRef[1]} role="listbox" className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(item => {
            const s = detail.steps[item.index]
            return (
              <Button
                key={`${s.symbol}-${item.index}`}
                variant="ghost"
                size="md"
                aria-label={`step ${item.index + 1}: ${s.symbol} at ${s.file} line ${s.line}`}
                onClick={() => setFocused(item.index)}
                className={`absolute left-0 right-0 min-h-14 flex-col items-stretch gap-0 rounded-none border-0 border-b border-[--color-border] px-5 py-2 text-left font-normal ${focused === item.index ? 'bg-blue-950/20' : 'hover:bg-[--color-surface]/40'}`}
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <div className="flex items-center gap-2 text-sm text-[--color-fg]">
                  <span className="w-8 text-xs text-[--color-fg-subtle]">#{item.index + 1}</span>
                  <span>{s.symbol}</span>
                  <span className="font-mono text-xs text-[--color-fg-subtle]">{s.file}:{s.line}</span>
                </div>
                <div className="mt-1 truncate pl-10 font-mono text-xs text-[--color-fg-subtle]">{s.snippet ?? s.symbol}</div>
              </Button>
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
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <IconButton label="Find issues" className={iconButtonClass}>
          <Icon name="Search" size="sm" />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content align="end" className="w-80 bg-[--color-bg] p-2">
        {query.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size="md" className="animate-spin text-[--color-fg-subtle]" />
          </div>
        ) : (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Icon name="Search" size="lg" />}
            title="No matching issues"
            description="No issues reference this process step."
          />
        ) : query.data!.map(match => (
          <Button
            key={match.id}
            variant="ghost"
            size="xs"
            onClick={() => { setState({ view: 'all', taskId: match.id }); setOpen(false) }}
            className="h-auto w-full justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-[--color-surface]"
          >
            <span className="truncate text-[--color-fg-muted]">{match.title}</span>
            <span className="rounded bg-[--color-surface-hi] px-1.5 text-[--color-fg-muted]">{match.overlap_count}</span>
          </Button>
        ))}
      </Popover.Content>
    </Popover.Root>
  )
}
