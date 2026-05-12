import { useCallback, useEffect, useState } from 'react'

export interface AppHashState {
  view?: 'all' | 'focus' | 'ready' | 'health' | 'changes'
  taskId?: string
  filters?: Record<string, string[] | string>  // e.g. { branch: ['main', 'fix'], search: 'foo' }
  groupBy?: string | null   // serialized GroupConfig, e.g. "field:status", "label:openspec", null
  healthTab?: 'checks' | 'formulas'  // sub-tab within health view
  workspaceScope?: 'off'  // omit from hash when 'on' (default); include as 'off' when disabled
}

function encode(state: AppHashState): string {
  return encodeURIComponent(JSON.stringify(state))
}

function decode(hash: string): AppHashState {
  try {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash
    return JSON.parse(decodeURIComponent(raw)) as AppHashState
  } catch {
    return {}
  }
}

const DEFAULT_STATE: AppHashState = { filters: { status: ['open', 'in_progress'] } }

export function useHashState(): [AppHashState, (patch: Partial<AppHashState>) => void] {
  const [state, setState] = useState<AppHashState>(() => {
    const hash = window.location.hash
    if (!hash || hash === '#') return DEFAULT_STATE
    return decode(hash)
  })

  // Sync to URL
  useEffect(() => {
    const newHash = '#' + encode(state)
    if (window.location.hash !== newHash) {
      window.history.pushState(null, '', newHash)
    }
  }, [state])

  // Listen for popstate (back/forward)
  useEffect(() => {
    const handler = () => setState(decode(window.location.hash))
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const setHashState = useCallback((patch: Partial<AppHashState>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  return [state, setHashState]
}
