import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { listen } from '@tauri-apps/api/event'
import { listChanges, getChangeProgress } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { IconButton } from '../ui/IconButton'
import { useTasks } from '../../hooks/useTasks'
import { ChangeCard } from './ChangeCard'
import { fuzzyMatch } from '../../lib/fuzzyMatch'
import type { ChangeInfo, ChangeProgress } from '../../bindings'

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
  const ref = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const reposition = () => {
      const anchor = ref.current
      const popover = popoverRef.current
      if (!anchor || !popover) return
      const rect = anchor.getBoundingClientRect()
      const pw = popover.offsetWidth
      const left = Math.min(rect.left, window.innerWidth - pw - 8)
      popover.style.top = `${rect.bottom + 6}px`
      popover.style.left = `${Math.max(8, left)}px`
    }
    reposition()
    window.addEventListener('resize', reposition)
    return () => window.removeEventListener('resize', reposition)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
          active.length > 0
            ? 'border-blue-500/70 text-blue-300 bg-blue-900/20'
            : 'border-neutral-700/50 text-neutral-400 hover:border-neutral-500 hover:text-neutral-300 bg-neutral-800/20',
        ].join(' ')}
      >
        <span>Status</span>
        {active.length > 0 && (
          <span className="bg-blue-500 text-white rounded-full px-1.5 text-[10px] font-semibold leading-4">
            {active.length}
          </span>
        )}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L1 3h10L6 8z" />
        </svg>
      </button>

      {open && createPortal(
        <div ref={popoverRef} style={{ position: 'fixed', zIndex: 9999 }}>
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl py-1.5 min-w-40">
            {STATUS_OPTIONS.map(opt => {
              const isActive = active.includes(opt.value)
              const count = counts[opt.value] ?? 0
              return (
                <button
                  key={opt.value}
                  onClick={() => onToggle(opt.value)}
                  className={[
                    'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs transition-colors',
                    isActive ? 'text-blue-300 hover:bg-blue-900/20' : 'text-neutral-300 hover:bg-neutral-800/40',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-blue-500 border-blue-500' : 'border-neutral-600'}`}>
                      {isActive && (
                        <svg viewBox="0 0 10 10" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span>{opt.label}</span>
                  </div>
                  <span className="text-neutral-600 font-mono">{count}</span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
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
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-1 py-1.5 text-left group"
      >
        <svg
          className={[
            'w-3.5 h-3.5 text-neutral-600 transition-transform flex-shrink-0',
            collapsed ? '' : 'rotate-90',
          ].join(' ')}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
        </svg>
        <span className="text-xs font-medium text-neutral-500 group-hover:text-neutral-400 transition-colors">
          {changes.length} archived {changes.length === 1 ? 'change' : 'changes'}
        </span>
      </button>

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
          <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-neutral-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm font-medium text-neutral-400">No project connected</p>
          <p className="text-xs text-neutral-600 mt-1">Connect a project to see its OpenSpec changes</p>
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
          <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-neutral-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm font-medium text-neutral-400">No OpenSpec changes found</p>
          <p className="text-xs text-neutral-600 mt-1">Run <code className="font-mono bg-neutral-800 px-1 rounded">openspec new change</code> to create one</p>
        </div>
      </div>
    )
  }

  const hasActiveFilter = searchQuery || statusFilter.length > 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">OpenSpec Changes</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {changes.filter(c => !c.is_archived).length} active {changes.filter(c => !c.is_archived).length === 1 ? 'change' : 'changes'}
          </p>
        </div>
        {isLoading && (
          <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
        )}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-neutral-800 flex-shrink-0">
        <div className="flex flex-1 items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-800/40 border border-neutral-700/50 focus-within:border-neutral-500 transition-colors">
          <svg className="w-3 h-3 text-neutral-500 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l3 3" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Search changes…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-neutral-300 placeholder-neutral-600 outline-none flex-1 min-w-0"
          />
          {searchQuery && (
            <IconButton label="Clear search" onClick={() => setSearchQuery('')} className="text-neutral-600 hover:text-neutral-400 transition-colors">
              <svg className="w-3 h-3" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
              </svg>
            </IconButton>
          )}
        </div>
        <StatusFilterPill active={statusFilter} onToggle={toggleStatus} counts={statusCounts} />
        {hasActiveFilter && (
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter([]) }}
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeChanges.length === 0 && archivedChanges.length === 0 && hasActiveFilter ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-neutral-600">No changes match your filters</p>
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
