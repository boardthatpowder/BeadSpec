import { useState, useEffect } from 'react'
import { commands, unwrap } from '../../ipc'

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
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' })
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set())

  // Reset when task changes
  useEffect(() => {
    setOpen(false)
    setHasOpened(false)
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
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-800/30 transition-colors"
      >
        <span className="text-xs font-medium text-neutral-400">Related memories</span>
        <svg
          className={`w-3.5 h-3.5 text-neutral-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-neutral-800/60">
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
                  <button
                    key={idx}
                    onClick={() => toggleExpanded(idx)}
                    className="w-full text-left px-4 py-3 hover:bg-neutral-800/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-neutral-300 truncate">{shortKey}</span>
                      <span className="text-[10px] text-neutral-600 shrink-0">{mem.namespace}</span>
                    </div>
                    <div className="text-xs text-neutral-500 whitespace-pre-wrap break-words">
                      {isExpanded ? mem.preview : excerpt(mem.preview)}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
