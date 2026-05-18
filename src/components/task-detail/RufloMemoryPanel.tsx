import { useState, useEffect } from 'react'
import { commands, unwrap } from '../../ipc'
import { useAppState } from '../../contexts/HashStateContext'
import { MemoryTrajectoryTab } from './MemoryTrajectoryTab'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

interface Props {
  taskId: string
  title: string
  labels: string[]
}

interface Memory {
  key: string
  score: number
  namespace: string
  preview: string
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; memories: Memory[] }
  | { status: 'error'; message: string }

const SYSTEM_PREFIXES = ['branch:', 'worktree:', 'repo:', 'openspec:']

function buildSearchQuery(title: string, labels: string[]): string {
  const userLabels = labels.filter(l => !SYSTEM_PREFIXES.some(p => l.startsWith(p)))
  return [title, ...userLabels].filter(Boolean).join(' ')
}

function excerpt(body: string, max = 120): string {
  if (!body) return ''
  const trimmed = body.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max) + '…'
}

export function RufloMemoryPanel({ taskId, title, labels }: Props) {
  const [open, setOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [subTab, setSubTab] = useState<'search' | 'trajectory'>('search')
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' })
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set())
  const { setState } = useAppState()

  // Reset when task changes
  useEffect(() => {
    setOpen(false)
    setHasOpened(false)
    setSubTab('search')
    setLoadState({ status: 'idle' })
    setExpandedSet(new Set())
  }, [taskId])

  async function handleToggle() {
    const nextOpen = !open
    setOpen(nextOpen)

    if (nextOpen && !hasOpened) {
      setHasOpened(true)
      const query = buildSearchQuery(title, labels)

      if (!query.trim()) {
        setLoadState({ status: 'loaded', memories: [] })
        return
      }

      setLoadState({ status: 'loading' })
      try {
        const stdout = await unwrap(commands.rufloMemorySearch(query))
        let memories: Memory[] = []
        try {
          const parsed = JSON.parse(stdout)
          const results = Array.isArray(parsed) ? parsed : (parsed?.results ?? [])
          memories = results.filter((r: Memory) => r.namespace !== 'session' && r.namespace !== 'default')
        } catch {
          memories = []
        }
        setLoadState({ status: 'loaded', memories })
      } catch (e) {
        setLoadState({ status: 'error', message: String(e) })
      }
    }
  }

  function toggleExpanded(idx: number) {
    setExpandedSet(prev => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  return (
    <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 overflow-hidden">
      {/* Section header */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="h-auto w-full justify-between rounded-none border-0 px-4 py-3 text-left font-normal hover:bg-neutral-800/30"
      >
        <span className="text-xs font-medium text-neutral-400">Related memories</span>
        <Icon
          name="ChevronDown"
          size="sm"
          className={`w-3.5 h-3.5 text-neutral-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </Button>

      {open && (
        <div className="border-t border-neutral-800/60">
          <div className="flex items-center justify-between border-b border-neutral-800/40 px-4 py-2">
            <div className="flex rounded border border-neutral-800 p-0.5">
              {(['search', 'trajectory'] as const).map(tab => (
                <Button
                  key={tab}
                  variant="ghost"
                  size="xs"
                  onClick={() => setSubTab(tab)}
                  className={`h-auto rounded-sm border-0 px-2 py-0.5 text-[10px] capitalize ${subTab === tab ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-500'}`}
                >
                  {tab}
                </Button>
              ))}
            </div>
            <Button
              variant="link"
              size="xs"
              onClick={() => setState({ view: 'memory', memoryNamespace: `issue:${taskId}` })}
              className="h-auto px-0 py-0 text-[10px] text-blue-400 hover:text-blue-300"
            >
              Open in Memory browser
            </Button>
          </div>

          {subTab === 'trajectory' ? (
            <MemoryTrajectoryTab taskId={taskId} title={title} />
          ) : (
            <>
          {loadState.status === 'loading' && (
            <div className="px-4 py-3 text-xs text-neutral-600">Loading…</div>
          )}

          {loadState.status === 'error' && (
            <div className="px-4 py-3 text-xs text-red-400">Could not load memories</div>
          )}

          {loadState.status === 'loaded' && loadState.memories.length === 0 && (
            <div className="px-4 py-3 text-xs text-neutral-600 italic">No related memories found</div>
          )}

          {loadState.status === 'loaded' && loadState.memories.length > 0 && (
            <div className="divide-y divide-neutral-800/40">
              {loadState.memories.map((mem, idx) => {
                const isExpanded = expandedSet.has(idx)
                const shortKey = mem.key.replace(/^[^-]+-/, '').replace(/-\d{13}$/, '')
                return (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(idx)}
                    className="h-auto w-full justify-start rounded-none border-0 px-4 py-3 text-left font-normal hover:bg-neutral-800/20"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-neutral-300 truncate">{shortKey}</span>
                      <span className="text-[10px] text-neutral-600 shrink-0">{mem.namespace}</span>
                    </div>
                    <div className="text-xs text-neutral-500 whitespace-pre-wrap break-words">
                      {isExpanded ? mem.preview : excerpt(mem.preview)}
                    </div>
                  </Button>
                )
              })}
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
