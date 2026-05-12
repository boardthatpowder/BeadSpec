import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { commands, unwrap } from '../ipc'
import { useShortcut } from './shortcuts/ShortcutProvider'
import { useAppState } from '../contexts/HashStateContext'
import { useActiveProject } from '../hooks/useProject'

interface Result {
  type: 'task' | 'action' | 'view'
  id: string
  label: string
  sub?: string
  action: () => void
}

// Simple fuzzy match — true if all chars of query appear in order in str
function fuzzyMatch(str: string, query: string): boolean {
  if (!query) return true
  const s = str.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) qi++
  }
  return qi === q.length
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setState } = useAppState()
  const project = useActiveProject()
  const queryClient = useQueryClient()

  useShortcut('k', () => { setOpen(true); setQuery(''); setSelected(0) })

  const { data: taskResults = [] } = useQuery({
    queryKey: ['search', project, query],
    queryFn: () => unwrap(commands.searchTasks(project!, query)),
    enabled: !!project && query.length > 0,
    staleTime: 5_000,
  })

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  const actions: Result[] = [
    {
      type: 'action', id: 'refresh', label: 'Refresh',
      action: () => { close(); queryClient.invalidateQueries() }
    },
    {
      type: 'action', id: 'new-task', label: 'Create new task',
      action: () => { close(); /* TODO: open new task form */ }
    },
    {
      type: 'view', id: 'view-all', label: 'All tasks',
      action: () => { close(); setState({ view: 'all' }) }
    },
    {
      type: 'view', id: 'view-focus', label: 'Focus view — my urgent tasks',
      action: () => { close(); setState({ view: 'focus' }) }
    },
    {
      type: 'view', id: 'view-ready', label: 'Ready to Start view',
      action: () => { close(); setState({ view: 'ready' }) }
    },
  ]

  const filtered = actions.filter(r => fuzzyMatch(r.label, query))

  const taskActions: Result[] = taskResults.map(t => ({
    type: 'task' as const,
    id: t.id,
    label: t.title,
    sub: t.id,
    action: () => {
      close()
      setState({ taskId: t.id })
    },
  }))

  const allResults = [...filtered, ...taskActions]

  useEffect(() => { setSelected(0) }, [query])

  const runSelected = () => {
    allResults[selected]?.action()
  }

  if (!open) return null

  const groupLabel = (type: Result['type']) =>
    type === 'task' ? 'Tasks' : type === 'action' ? 'Actions' : 'Views'

  const groups = ['action', 'view', 'task'] as const

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-[560px] overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') close()
          if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allResults.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
          if (e.key === 'Enter') { e.preventDefault(); runSelected() }
        }}
      >
        <div className="flex items-center px-4 border-b border-neutral-800">
          <svg className="w-4 h-4 text-neutral-500 mr-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6.5" cy="6.5" r="4.5"/><path d="m10.5 10.5 3 3"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, actions, views…"
            className="flex-1 bg-transparent py-3.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {allResults.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-neutral-500">No results for "{query}"</div>
          )}
          {groups.map(type => {
            const group = allResults.filter(r => r.type === type)
            if (!group.length) return null
            return (
              <div key={type}>
                <div className="px-4 py-1.5 text-xs text-neutral-500 uppercase tracking-wider">
                  {groupLabel(type)}
                </div>
                {group.map(r => {
                  const i = allResults.indexOf(r)
                  return (
                    <button
                      key={r.id}
                      onClick={r.action}
                      className={[
                        'w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors',
                        i === selected ? 'bg-blue-600/20 text-blue-300' : 'text-neutral-200 hover:bg-neutral-800',
                      ].join(' ')}
                      onMouseEnter={() => setSelected(i)}
                    >
                      <span className="flex-1">{r.label}</span>
                      {r.sub && <span className="text-xs text-neutral-500">{r.sub}</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="px-4 py-2 border-t border-neutral-800 flex items-center gap-4 text-xs text-neutral-600">
          <span>↑↓ navigate</span><span>↵ select</span><span>Esc close</span>
        </div>
      </div>
    </div>
  )
}
