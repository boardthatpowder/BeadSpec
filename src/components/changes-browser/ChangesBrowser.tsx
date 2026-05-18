import { useEffect, useState, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { listChanges, getChangeProgress } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { IconButton } from '../ui/IconButton'
import { useTasks } from '../../hooks/useTasks'
import { ChangeCard } from './ChangeCard'
import { fuzzyMatch } from '../../lib/fuzzyMatch'
import type { ChangeInfo, ChangeProgress } from '../../bindings'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Popover } from '../ui/Popover'

interface ChangesListChangedPayload {
  project: string
}

type ChangeStatus = 'draft' | 'not_started' | 'in_progress' | 'complete' | 'archived'

function deriveStatus(change: ChangeInfo, progress: ChangeProgress | undefined): ChangeStatus {
  if (change.is_archived) return 'archived'
  if (!progress || progress.total === 0) return 'draft'
  if (progress.done === progress.total) return 'complete'
  if (progress.done > 0) return 'in_progress'
  return 'not_started'
}

const STATUS_OPTIONS: Array<{ value: ChangeStatus; label: string }> = [
  { value: 'draft',       label: 'Draft' },
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete',    label: 'Complete' },
  { value: 'archived',    label: 'Archived' },
]

// ── Minimal status-filter pill ────────────────────────────────────────────────

function StatusFilterPill({
  active,
  onToggle,
  counts,
}: {
  active: ChangeStatus[]
  onToggle: (v: ChangeStatus) => void
  counts: Record<ChangeStatus, number>
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className={[
          'h-auto gap-1.5 px-2.5 py-1.5',
          active.length > 0
            ? 'border-blue-500/70 text-blue-300 bg-blue-900/20'
            : 'border-[--color-border-strong]/50 text-[--color-fg-muted] hover:border-neutral-500 hover:text-[--color-fg-muted] bg-[--color-surface-hi]/20',
        ].join(' ')}
      >
        <span>Status</span>
        {active.length > 0 && (
          <span className="bg-blue-500 text-white rounded-full px-1.5 text-[10px] font-semibold leading-4">
            {active.length}
          </span>
        )}
        <Icon name="ChevronDown" size="sm" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      </Popover.Trigger>

      <Popover.Content align="start" className="py-1.5 min-w-40 bg-[--color-bg]">
            {STATUS_OPTIONS.map(opt => {
              const isActive = active.includes(opt.value)
              const count = counts[opt.value] ?? 0
              return (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggle(opt.value)}
                  className={[
                    'h-auto w-full justify-between gap-2 rounded-none border-0 px-3 py-1.5',
                    isActive ? 'text-blue-300 hover:bg-blue-900/20' : 'text-[--color-fg-muted] hover:bg-[--color-surface-hi]/40',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-blue-500 border-blue-500' : 'border-neutral-600'}`}>
                      {isActive && (
                        <Icon name="Check" size="sm" className="text-white" />
                      )}
                    </span>
                    <span>{opt.label}</span>
                  </div>
                  <span className="text-[--color-fg-subtle] font-mono">{count}</span>
                </Button>
              )
            })}
      </Popover.Content>
    </Popover.Root>
  )
}

// ── ArchivedSection ───────────────────────────────────────────────────────────

function ArchivedSection({
  changes,
  allTasks,
  allChanges,
}: {
  changes: ChangeInfo[]
  allTasks: import('../../bindings').Task[]
  allChanges: ChangeInfo[]
}) {
  const [collapsed, setCollapsed] = useState(true)

  if (changes.length === 0) return null

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        aria-label={collapsed ? 'Show archived' : 'Hide archived'}
        onClick={() => setCollapsed(c => !c)}
        className="h-auto w-full justify-start gap-2 border-0 px-1 py-1.5 text-left group"
      >
        <Icon
          name="ChevronRight"
          size="sm"
          className={[
            'text-[--color-fg-subtle] transition-transform flex-shrink-0',
            collapsed ? '' : 'rotate-90',
          ].join(' ')}
        />
        <span className="text-xs font-medium text-[--color-fg-subtle] group-hover:text-[--color-fg-muted] transition-colors">
          {changes.length} archived {changes.length === 1 ? 'change' : 'changes'}
        </span>
      </Button>

      {!collapsed && (
        <div className="flex flex-col gap-2 mt-1">
          {changes.map(c => (
            <ChangeCard
              key={c.name}
              change={c}
              isReadOnly={true}
              allTasks={allTasks}
              allChanges={allChanges}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ChangesBrowser ────────────────────────────────────────────────────────────

export function ChangesBrowser() {
  const project = useActiveProject()
  const { allTasks } = useTasks()
  const [changes, setChanges] = useState<ChangeInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progresses, setProgresses] = useState<Record<string, ChangeProgress>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ChangeStatus[]>([])

  const fetchChanges = useCallback(async () => {
    if (!project) {
      setChanges([])
      return
    }
    setIsLoading(true)
    try {
      const result = await listChanges(project)
      setChanges(result)
    } catch {
      setChanges([])
    } finally {
      setIsLoading(false)
    }
  }, [project])

  // Initial load
  useEffect(() => {
    fetchChanges()
  }, [fetchChanges])

  // Fetch progress for all changes to enable status filtering
  useEffect(() => {
    if (!project || changes.length === 0) return
    Promise.all(
      changes.map(c =>
        getChangeProgress(project, c.name)
          .then(p => [c.name, p] as const)
          .catch(() => [c.name, { done: 0, total: 0 }] as const)
      )
    ).then(entries => setProgresses(Object.fromEntries(entries)))
  }, [project, changes])

  // Listen for filesystem events from OpenSpecWatcher
  useEffect(() => {
    if (!project) return
    let unlisten: (() => void) | undefined
    listen<ChangesListChangedPayload>('changes_list_changed', event => {
      if (event.payload.project === project) {
        fetchChanges()
      }
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [project, fetchChanges])

  const toggleStatus = (v: ChangeStatus) => {
    setStatusFilter(prev => prev.includes(v) ? prev.filter(s => s !== v) : [...prev, v])
  }

  const allChanges = changes
  const statusCounts = STATUS_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = allChanges.filter(c => deriveStatus(c, progresses[c.name]) === opt.value).length
    return acc
  }, {} as Record<ChangeStatus, number>)

  const filtered = allChanges.filter(c => {
    const status = deriveStatus(c, progresses[c.name])
    if (statusFilter.length > 0 && !statusFilter.includes(status)) return false
    if (searchQuery && !fuzzyMatch(c.name, searchQuery) && !(c.specs ?? []).some(s => fuzzyMatch(s, searchQuery))) return false
    return true
  })

  const activeChanges = filtered.filter(c => !c.is_archived)
  const archivedChanges = filtered.filter(c => c.is_archived)

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-[--color-surface-hi] flex items-center justify-center mx-auto mb-3">
            <Icon name="FileText" size="lg" className="text-[--color-fg-subtle]" />
          </div>
          <p className="text-sm font-medium text-[--color-fg-muted]">No project connected</p>
          <p className="text-xs text-[--color-fg-subtle] mt-1">Connect a project to see its OpenSpec changes</p>
        </div>
      </div>
    )
  }

  if (isLoading && changes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
      </div>
    )
  }

  if (changes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-[--color-surface-hi] flex items-center justify-center mx-auto mb-3">
            <Icon name="FileText" size="lg" className="text-[--color-fg-subtle]" />
          </div>
          <p className="text-sm font-medium text-[--color-fg-muted]">No OpenSpec changes found</p>
          <p className="text-xs text-[--color-fg-subtle] mt-1">Run <code className="font-mono bg-[--color-surface-hi] px-1 rounded">openspec new change</code> to create one</p>
        </div>
      </div>
    )
  }

  const hasActiveFilter = searchQuery || statusFilter.length > 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[--color-border] flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-[--color-fg]">OpenSpec Changes</h2>
          <p className="text-xs text-[--color-fg-subtle] mt-0.5">
            {changes.filter(c => !c.is_archived).length} active {changes.filter(c => !c.is_archived).length === 1 ? 'change' : 'changes'}
          </p>
        </div>
        {isLoading && (
          <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
        )}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[--color-border] flex-shrink-0">
        <div className="flex flex-1 items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[--color-surface-hi]/40 border border-[--color-border-strong]/50 focus-within:border-neutral-500 transition-colors">
          <Icon name="Search" size="sm" className="text-[--color-fg-subtle] flex-shrink-0" />
          <input
            placeholder="Search changes…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-[--color-fg-muted] placeholder-neutral-600 outline-none flex-1 min-w-0"
          />
          {searchQuery && (
            <IconButton label="Clear search" onClick={() => setSearchQuery('')} className="text-[--color-fg-subtle] hover:text-[--color-fg-muted] transition-colors">
              <Icon name="X" size="sm" />
            </IconButton>
          )}
        </div>
        <StatusFilterPill active={statusFilter} onToggle={toggleStatus} counts={statusCounts} />
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => { setSearchQuery(''); setStatusFilter([]) }}
            className="h-auto border-0 text-[--color-fg-subtle] hover:text-[--color-fg-muted]"
          >
            <Icon name="X" size="sm" />
            Clear
          </Button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeChanges.length === 0 && archivedChanges.length === 0 && hasActiveFilter ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[--color-fg-subtle]">No changes match your filters</p>
          </div>
        ) : (
          <>
            {activeChanges.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {activeChanges.map(c => (
                  <ChangeCard
                    key={c.name}
                    change={c}
                    isReadOnly={false}
                    allTasks={allTasks}
                    allChanges={allChanges}
                  />
                ))}
              </div>
            )}

            <ArchivedSection changes={archivedChanges} allTasks={allTasks} allChanges={allChanges} />
          </>
        )}
      </div>
    </div>
  )
}
